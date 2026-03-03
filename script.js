import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
            const pPerfil = document.querySelector(".menu-perfil p");
            if (pPerfil) pPerfil.innerText = `Olá, ${docSnap.data().nome}!`;
        }
    } else {
        window.location.href = "login.html";
    }
});

// --- FUNÇÃO DO MAPA (Tornada Global para o Callback do Google) ---
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
    if (!inputElement) return;
    new google.maps.places.Autocomplete(inputElement, {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: "br" }
    });
}

// --- LOGICA DE INTERFACE (MENU E BOTÕES) ---
document.addEventListener("DOMContentLoaded", function() {
    const btnMenu = document.getElementById("btn-menu");
    const btnFecharMenu = document.getElementById("btn-fechar-menu");
    const menuLateral = document.getElementById("menu-lateral");
    const btnCalcular = document.getElementById("btn-calcular");
    const btnAddParada = document.getElementById("btn-add-parada");
    const containerParadas = document.getElementById("container-paradas");
    const btnSair = document.querySelector(".menu-item.sair");

    // Abrir/Fechar Menu
    if (btnMenu && menuLateral) {
        btnMenu.onclick = () => menuLateral.classList.add("aberto");
    }
    if (btnFecharMenu && menuLateral) {
        btnFecharMenu.onclick = () => menuLateral.classList.remove("aberto");
    }

    // Botão Sair
    if (btnSair) {
        btnSair.onclick = (e) => {
            e.preventDefault();
            signOut(auth).then(() => window.location.href = "login.html");
        };
    }

    // Botão Calcular
    if (btnCalcular) {
        btnCalcular.onclick = calcularRotaOtimizada;
    }

    // Adicionar Paradas
    if (btnAddParada) {
        btnAddParada.onclick = function() {
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

            inputFoto.onchange = function(evento) {
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
            };

            const btnRemover = document.createElement("button");
            btnRemover.innerText = "X";
            btnRemover.onclick = () => containerParadas.removeChild(div);

            div.appendChild(input);
            div.appendChild(labelCamera);
            div.appendChild(inputFoto);
            div.appendChild(btnRemover);
            containerParadas.appendChild(div);
            configurarAutocomplete(input);
        };
    }
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
            
            const distanciaTotal = result.routes[0].legs.reduce((acc, leg) => acc + leg.distance.value, 0);
            const distanciaKm = (distanciaTotal / 1000).toFixed(2);

            if (usuarioLogado) {
                try {
                    await addDoc(collection(db, "usuarios", usuarioLogado.uid, "historico_rotas"), {
                        distancia: distanciaKm,
                        data: new Date(),
                        origem: origem,
                        destino: destino
                    });
                    console.log("KM salvo!");
                } catch (erro) {
                    console.error("Erro ao salvar:", erro);
                }
            }
            gerarBotoesDeNavegacao(result);
        }
    });
}

function gerarBotoesDeNavegacao(result) {
    const divLista = document.getElementById("lista-paradas");
    if (!divLista) return;
    divLista.innerHTML = "<h3>📱 Rota Pronta:</h3>"; 
    result.routes[0].legs.forEach((leg, i) => {
        const btn = document.createElement("a");
        btn.className = "btn-navegar";
        btn.innerText = `Navegar para Parada ${i+1} 🚗`;
        btn.href = `geo:0,0?q=${encodeURIComponent(leg.end_address)}`;
        divLista.appendChild(btn);
    });
}

// --- PWA ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalacao = e;
    const banner = document.createElement('div');
    banner.id = "banner-instalacao";
    banner.style = "background: #000; color: #fff; padding: 15px; text-align: center; position: fixed; top: 60px; left: 0; width: 100%; z-index: 999; cursor: pointer; border-bottom: 2px solid #007bff; font-weight: bold;";
    banner.innerText = "📲 Toque aqui para instalar o Roturbo no seu celular!";
    document.body.appendChild(banner);
    banner.onclick = () => {
        banner.remove();
        e.prompt();
    };
});