import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- CONFIGURAÇÃO DO FIREBASE (Certifique-se de que estas chaves são as suas) ---
const firebaseConfig = {
  apiKey: "AIzaSyBceowtEvmh9YJTLpeGR2rYnOSjmXRjH_U",
  authDomain: "roturbo.firebaseapp.com",
  projectId: "roturbo",
  storageBucket: "roturbo.firebasestorage.app",
  messagingSenderId: "356395708767",
  appId: "1:356395708767:web:4b4bb608ef29ee2a67c6ea",
  measurementId: "G-HPRKEGBZK3"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let usuarioLogado = null;

let mapa;
let directionsService;
let directionsRenderer;

// --- VERIFICAÇÃO DE LOGIN ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogado = user;
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            document.querySelector(".menu-perfil p").innerText = `Olá, ${docSnap.data().nome}!`;
        }
    } else {
        window.location.href = "login.html";
    }
});

window.iniciarMapa = function() {
    const centroInicial = { lat: -23.55052, lng: -46.633309 };
    mapa = new google.maps.Map(document.getElementById("mapa"), {
        zoom: 12,
        center: centroInicial,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    });
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(mapa);

    configurarAutocomplete(document.getElementById("origem"));
    configurarAutocomplete(document.getElementById("destino"));
}

function configurarAutocomplete(inputElement) {
    new google.maps.places.Autocomplete(inputElement, {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: "br" }
    });
}

document.addEventListener("DOMContentLoaded", function() {
    const btnMenu = document.getElementById("btn-menu");
    const btnFecharMenu = document.getElementById("btn-fechar-menu");
    const menuLateral = document.getElementById("menu-lateral");
    const btnCalcular = document.getElementById("btn-calcular");
    const btnAddParada = document.getElementById("btn-add-parada");
    const containerParadas = document.getElementById("container-paradas");

    // Navegação do Menu
    btnMenu.addEventListener("click", () => menuLateral.classList.add("aberto"));
    btnFecharMenu.addEventListener("click", () => menuLateral.classList.remove("aberto"));

    btnCalcular.addEventListener("click", calcularRotaOtimizada);

    btnAddParada.addEventListener("click", function() {
        const div = document.createElement("div");
        div.className = "parada-grupo";
        
        const input = document.createElement("input");
        input.type = "text";
        input.className = "input-parada";
        input.placeholder = "Digite o endereço...";

        const idUnico = "foto-" + Date.now(); 
        const labelCamera = document.createElement("label");
        labelCamera.className = "btn-camera";
        labelCamera.htmlFor = idUnico;
        labelCamera.innerText = "📸";

        const inputFoto = document.createElement("input");
        inputFoto.type = "file";
        inputFoto.id = idUnico;
        inputFoto.accept = "image/*";
        inputFoto.capture = "environment";
        inputFoto.style.display = "none";

        inputFoto.addEventListener("change", function(evento) {
            const arquivo = evento.target.files[0];
            if (arquivo) {
                input.value = "Lendo imagem... ⏳";
                Tesseract.recognize(arquivo, 'por').then(({ data: { text } }) => {
                    const linhas = text.split('\n');
                    let rua = "";
                    const regra = /(rua|avenida|av\.|travessa|praça|rodovia)/i;
                    for (let l of linhas) {
                        if (regra.test(l) && /\d/.test(l)) {
                            rua = l.replace(/[|_[\]{}<>]/g, '').trim();
                            break;
                        }
                    }
                    input.value = rua || text.substring(0, 40);
                    input.focus();
                });
            }
        });

        const btnRemover = document.createElement("button");
        btnRemover.innerText = "X";
        btnRemover.onclick = () => containerParadas.removeChild(div);

        div.appendChild(input);
        div.appendChild(labelCamera);
        div.appendChild(inputFoto);
        div.appendChild(btnRemover);
        containerParadas.appendChild(div);
        configurarAutocomplete(input);
    });
});

async function calcularRotaOtimizada() {
    const origem = document.getElementById("origem").value;
    const destino = document.getElementById("destino").value;
    const inputsParadas = document.querySelectorAll(".input-parada");

    if (!origem || !destino) {
        alert("Preencha origem e destino!");
        return;
    }

    let waypoints = [];
    inputsParadas.forEach(input => {
        if (input.value) waypoints.push({ location: input.value, stopover: true });
    });

    const request = {
        origin: origem,
        destination: destino,
        waypoints: waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING
    };

    directionsService.route(request, async function(result, status) {
        if (status === google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result);
            
            // Cálculo de distância para o banco de dados
            const distanciaTotal = result.routes[0].legs.reduce((acc, leg) => acc + leg.distance.value, 0);
            const distanciaKm = (distanciaTotal / 1000).toFixed(2);

            // --- SALVAMENTO NO HISTÓRICO DO FIREBASE ---
            if (usuarioLogado) {
                try {
                    await addDoc(collection(db, "usuarios", usuarioLogado.uid, "historico_rotas"), {
                        distancia: distanciaKm,
                        data: new Date(),
                        origem: origem,
                        destino: destino
                    });
                    console.log("KM salvo no banco de dados!");
                } catch (erro) {
                    console.error("Erro ao salvar rota:", erro);
                }
            }
            gerarBotoesDeNavegacao(result);
        }
    });
}

function gerarBotoesDeNavegacao(result) {
    const divLista = document.getElementById("lista-paradas");
    divLista.innerHTML = "<h3>📱 Rota Pronta:</h3>"; 
    result.routes[0].legs.forEach((leg, i) => {
        const btn = document.createElement("a");
        btn.className = "btn-navegar";
        btn.innerText = `Navegar para Parada ${i+1} 🚗`;
        btn.href = `geo:0,0?q=${encodeURIComponent(leg.end_address)}`;
        divLista.appendChild(btn);
    });
}

// --- PASSO 4: LÓGICA DE INSTALAÇÃO PWA ---
let eventoInstalacao;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalacao = e;
    const banner = document.createElement('div');
    banner.id = "banner-instalacao";
    banner.innerHTML = `
        <div style="background: #000; color: #fff; padding: 15px; text-align: center; position: fixed; top: 60px; left: 0; width: 100%; z-index: 999; cursor: pointer; border-bottom: 2px solid #007bff; font-weight: bold;">
            📲 Toque aqui para instalar o Roturbo no seu celular!
        </div>
    `;
    document.body.appendChild(banner);
    banner.addEventListener('click', () => {
        banner.style.display = 'none';
        eventoInstalacao.prompt();
    });
});