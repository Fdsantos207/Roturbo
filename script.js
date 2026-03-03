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

// --- NAVEGAÇÃO ENTRE TELAS ---
function resetarTelas() {
    document.getElementById("painel-principal").style.display = "none";
    document.getElementById("aba-historico").style.display = "none";
    document.getElementById("aba-financeiro").style.display = "none";
    document.getElementById("menu-lateral").classList.remove("aberto");
}

window.voltarParaMapa = () => {
    resetarTelas();
    document.getElementById("painel-principal").style.display = "block";
};

// --- LOGICA FINANCEIRA PROFISSIONAL (MEU CORRE) ---
async function abrirFinanceiro() {
    resetarTelas();
    document.getElementById("aba-financeiro").style.display = "block";
    carregarResumoFinanceiro();
}

async function carregarResumoFinanceiro() {
    const lista = document.getElementById("lista-financeiro");
    const saldoTxt = document.getElementById("saldo-dia");
    const ganhosTxt = document.getElementById("total-ganhos");
    const gastosTxt = document.getElementById("total-gastos");

    if (!usuarioLogado) return;

    try {
        const q = query(collection(db, "usuarios", usuarioLogado.uid, "financeiro"), orderBy("data", "desc"));
        const snap = await getDocs(q);
        
        let somaGanhos = 0;
        let somaGastos = 0;
        lista.innerHTML = "<h4>Histórico de Lançamentos:</h4>";

        snap.forEach(doc => {
            const d = doc.data();
            somaGanhos += d.ganho;
            somaGastos += d.gasto;

            const div = document.createElement("div");
            div.className = "item-financeiro";
            div.style = "display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; font-size: 14px;";
            
            // Ícone por categoria
            const icones = { combustivel: "⛽", alimentacao: "🍔", manutencao: "🛠️", outros: "📦" };
            const categoriaIcone = icones[d.categoria] || "💰";

            div.innerHTML = `
                <div>
                    <small>${d.data.toDate().toLocaleDateString()}</small><br>
                    <span>${categoriaIcone} ${d.categoria.toUpperCase()}</span>
                </div>
                <div style="text-align: right;">
                    <span style="color: #28a745;">+ R$ ${d.ganho.toFixed(2)}</span><br>
                    <span style="color: #dc3545;">- R$ ${d.gasto.toFixed(2)}</span>
                </div>
            `;
            lista.appendChild(div);
        });

        ganhosTxt.innerText = `R$ ${somaGanhos.toFixed(2)}`;
        gastosTxt.innerText = `R$ ${somaGastos.toFixed(2)}`;
        saldoTxt.innerText = `R$ ${(somaGanhos - somaGastos).toFixed(2)}`;
    } catch (e) { console.error(e); }
}

// --- LÓGICA DE KM RODADOS ---
async function carregarHistorico() {
    resetarTelas();
    document.getElementById("aba-historico").style.display = "block";
    const lista = document.getElementById("lista-historico");
    const totalElemento = document.getElementById("total-km");

    if (!usuarioLogado) return;

    try {
        const q = query(collection(db, "usuarios", usuarioLogado.uid, "historico_rotas"), orderBy("data", "desc"));
        const querySnapshot = await getDocs(q);
        lista.innerHTML = "";
        let somaKm = 0;

        querySnapshot.forEach((doc) => {
            const rota = doc.data();
            somaKm += parseFloat(rota.distancia);
            const dataFormatada = rota.data.toDate().toLocaleDateString('pt-BR');
            const div = document.createElement("div");
            div.className = "item-rota";
            div.innerHTML = `
                <small>📅 ${dataFormatada}</small>
                <p><strong>🏁 ${rota.distancia} KM</strong></p>
                <p style="font-size: 12px; color: #555;">📍 De: ${rota.origem.substring(0, 30)}...</p>
            `;
            lista.appendChild(div);
        });
        totalElemento.innerText = `${somaKm.toFixed(2)} KM`;
    } catch (e) { console.error(e); }
}

// --- EVENTOS DE INTERFACE ---
document.addEventListener("DOMContentLoaded", function() {
    const btnMenu = document.getElementById("btn-menu");
    const btnFecharMenu = document.getElementById("btn-fechar-menu");
    const menuLateral = document.getElementById("menu-lateral");
    const btnCalcular = document.getElementById("btn-calcular");
    const btnAddParada = document.getElementById("btn-add-parada");
    const containerParadas = document.getElementById("container-paradas");
    const btnSair = document.querySelector(".menu-item.sair");
    const btnSalvarFinanceiro = document.getElementById("btn-salvar-financeiro");

    const linkKM = document.querySelector('.menu-links a:nth-child(2)');
    const linkFinanceiro = document.querySelector('.menu-links a:nth-child(3)');

    if (linkKM) linkKM.onclick = (e) => { e.preventDefault(); carregarHistorico(); };
    if (linkFinanceiro) linkFinanceiro.onclick = (e) => { e.preventDefault(); abrirFinanceiro(); };
    if (btnMenu) btnMenu.addEventListener("click", () => menuLateral.classList.add("aberto"));
    if (btnFecharMenu) btnFecharMenu.addEventListener("click", () => menuLateral.classList.remove("aberto"));

    if (btnSair) {
        btnSair.onclick = (e) => {
            e.preventDefault();
            signOut(auth).then(() => window.location.href = "login.html");
        };
    }

    if (btnSalvarFinanceiro) {
        btnSalvarFinanceiro.onclick = async () => {
            const ganho = parseFloat(document.getElementById("ganho-valor").value) || 0;
            const gasto = parseFloat(document.getElementById("gasto-valor").value) || 0;
            const categoria = document.getElementById("categoria-gasto").value;

            if (ganho === 0 && gasto === 0) return alert("Insira valores!");
            
            try {
                await addDoc(collection(db, "usuarios", usuarioLogado.uid, "financeiro"), {
                    ganho, gasto, categoria, lucro: ganho - gasto, data: new Date()
                });
                alert("Corre salvo com sucesso! 🚀");
                document.getElementById("ganho-valor").value = "";
                document.getElementById("gasto-valor").value = "";
                carregarResumoFinanceiro();
            } catch (e) { console.error(e); }
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
            input.placeholder = "Endereço...";

            const idUnico = "foto-" + Date.now();
            const labelCam = document.createElement("label");
            labelCam.className = "btn-camera";
            labelCam.htmlFor = idUnico;
            labelCam.innerText = "📸";

            const inputFoto = document.createElement("input");
            inputFoto.type = "file";
            inputFoto.id = idUnico;
            inputFoto.accept = "image/*";
            inputFoto.capture = "environment";
            inputFoto.style.display = "none";

            inputFoto.onchange = (e) => {
                const arq = e.target.files[0];
                if (arq) {
                    input.value = "Lendo... ⏳";
                    Tesseract.recognize(arq, 'por').then(({ data: { text } }) => {
                        input.value = text.substring(0, 45);
                        input.focus();
                    });
                }
            };

            const btnRemover = document.createElement("button");
            btnRemover.innerText = "×";
            btnRemover.className = "btn-remover-parada";
            btnRemover.onclick = () => containerParadas.removeChild(div);

            div.append(input, labelCam, inputFoto, btnRemover);
            containerParadas.appendChild(div);
            configurarAutocomplete(input);
        };
    }
});

// --- ROTA E NAVEGAÇÃO ---
async function calcularRotaOtimizada() {
    const origem = document.getElementById("origem").value;
    const destino = document.getElementById("destino").value;
    const inputs = document.querySelectorAll(".input-parada");
    if (!origem || !destino) return alert("Origem e Destino são obrigatórios!");

    let waypoints = [];
    inputs.forEach(i => { if (i.value) waypoints.push({ location: i.value, stopover: true }); });

    const request = {
        origin: origem,
        destination: destino,
        waypoints: waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING
    };

    directionsService.route(request, async (result, status) => {
        if (status === "OK") {
            directionsRenderer.setDirections(result);
            const dist = result.routes[0].legs.reduce((acc, leg) => acc + leg.distance.value, 0);
            const km = (dist / 1000).toFixed(2);

            if (usuarioLogado) {
                await addDoc(collection(db, "usuarios", usuarioLogado.uid, "historico_rotas"), {
                    distancia: km, data: new Date(), origem, destino
                });
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
        btn.onclick = function() {
            this.classList.add("visitado");
            this.innerText = `✅ Parada ${i+1} Finalizada`;
        };
        divLista.appendChild(btn);
    });
}

// --- PWA ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    const banner = document.createElement('div');
    banner.style = "background: #000; color: #fff; padding: 15px; text-align: center; position: fixed; top: 60px; left: 0; width: 100%; z-index: 999; cursor: pointer; border-bottom: 2px solid #007bff; font-weight: bold;";
    banner.innerText = "📲 Instalar Roturbo";
    document.body.appendChild(banner);
    banner.onclick = () => { banner.remove(); e.prompt(); };
});