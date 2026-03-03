import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// --- FUNÇÃO DO MAPA ---
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

// --- LÓGICA DE INTERFACE E HISTÓRICO ---
async function carregarHistorico() {
    const painelPrincipal = document.getElementById("painel-principal");
    const abaHistorico = document.getElementById("aba-historico");
    const lista = document.getElementById("lista-historico");
    const totalElemento = document.getElementById("total-km");
    const menuLateral = document.getElementById("menu-lateral");

    // Alterna telas
    painelPrincipal.style.display = "none";
    abaHistorico.style.display = "block";
    menuLateral.classList.remove("aberto");

    if (!usuarioLogado) return;

    try {
        const q = query(
            collection(db, "usuarios", usuarioLogado.uid, "historico_rotas"),
            orderBy("data", "desc")
        );

        const querySnapshot = await getDocs(q);
        lista.innerHTML = "";
        let somaKm = 0;

        querySnapshot.forEach((doc) => {
            const rota = doc.data();
            somaKm += parseFloat(rota.distancia);

            // Formata a data do Firebase
            const dataFormatada = rota.data.toDate().toLocaleDateString('pt-BR');
            
            const div = document.createElement("div");
            div.className = "item-rota";
            div.innerHTML = `
                <small>📅 ${dataFormatada}</small>
                <p><strong>🏁 ${rota.distancia} KM</strong></p>
                <p style="font-size: 12px; color: #555;">📍 De: ${rota.origem.substring(0, 35)}...</p>
                <p style="font-size: 12px; color: #555;">🏁 Para: ${rota.destino.substring(0, 35)}...</p>
            `;
            lista.appendChild(div);
        });

        totalElemento.innerText = `${somaKm.toFixed(2)} KM`;

    } catch (e) {
        console.error("Erro ao carregar histórico:", e);
        lista.innerHTML = "<p style='text-align:center;'>Erro ao carregar dados.</p>";
    }
}

// Torna global para o botão "Voltar" do HTML
window.voltarParaMapa = () => {
    document.getElementById("aba-historico").style.display = "none";
    document.getElementById("painel-principal").style.display = "block";
};

document.addEventListener("DOMContentLoaded", function() {
    const btnMenu = document.getElementById("btn-menu");
    const btnFecharMenu = document.getElementById("btn-fechar-menu");
    const menuLateral = document.getElementById("menu-lateral");
    const btnCalcular = document.getElementById("btn-calcular");
    const btnAddParada = document.getElementById("btn-add-parada");
    const containerParadas = document.getElementById("container-paradas");
    const btnSair = document.querySelector(".menu-item.sair");
    
    // Link "Minhas Rotas" no menu
    const linkHistorico = document.querySelector('.menu-links a:nth-child(2)');
    if (linkHistorico) {
        linkHistorico.onclick = (e) => {
            e.preventDefault();
            carregarHistorico();
        };
    }

    // Navegação do Menu
    if (btnMenu) btnMenu.addEventListener("click", () => menuLateral.classList.add("aberto"));
    if (btnFecharMenu) btnFecharMenu.addEventListener("click", () => menuLateral.classList.remove("aberto"));

    if (btnSair) {
        btnSair.onclick = (e) => {
            e.preventDefault();
            signOut(auth).then(() => window.location.href = "login.html");
        };
    }

    if (btnCalcular) btnCalcular.addEventListener("click", calcularRotaOtimizada);

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
            btnRemover.innerText = "×";
            btnRemover.className = "btn-remover-parada";
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