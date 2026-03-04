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
let dadosUsuario = null; 

let mapa;
let directionsService;
let directionsRenderer;

// --- VERIFICAÇÃO DE LOGIN E BLOQUEIO VISUAL ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogado = user;
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            dadosUsuario = docSnap.data(); 
            
            const pPerfil = document.querySelector(".menu-perfil p");
            if (pPerfil) {
                const planoTexto = dadosUsuario.plano === "pro" ? "⭐ Plano PRO" : "Plano Grátis";
                const corPlano = dadosUsuario.plano === "pro" ? "#ffc107" : "#6c757d";
                pPerfil.innerHTML = `Olá, ${dadosUsuario.nome || 'Motorista'}!<br><small style="color: ${corPlano}; font-weight: bold;">${planoTexto}</small>`;
            }

            if (dadosUsuario.plano !== "pro") {
                const linkKM = document.querySelector('.menu-links a:nth-child(2)'); 
                const linkFinanceiro = document.querySelector('.menu-links a:nth-child(3)'); 
                if (linkKM && !linkKM.innerText.includes("🔒")) linkKM.innerText += " 🔒";
                if (linkFinanceiro && !linkFinanceiro.innerText.includes("🔒")) linkFinanceiro.innerText += " 🔒";
            }
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
    if (!dadosUsuario || dadosUsuario.plano !== "pro") {
        alert("🔒 Recurso VIP: A Gestão do Corre é exclusiva para motoristas PRO. Faça o upgrade para acessar!");
        return; 
    }

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
            div.style = "display: flex; justify-content: space-between; padding: 12px; border-bottom: 1px solid #eee; background: #fff;";
            
            const icones = { combustivel: "⛽", alimentacao: "🍔", manutencao: "🛠️", outros: "📦" };
            const categoriaIcone = icones[d.categoria] || "💰";

            div.innerHTML = `
                <div>
                    <small>${d.data.toDate().toLocaleDateString()}</small><br>
                    <span style="font-size: 12px; background: #eee; padding: 2px 5px; border-radius: 4px;">${categoriaIcone} ${d.categoria.toUpperCase()}</span>
                </div>
                <div style="text-align: right;">
                    <span style="color: #28a745; font-weight: bold;">+ R$ ${d.ganho.toFixed(2)}</span><br>
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
    if (!dadosUsuario || dadosUsuario.plano !== "pro") {
        alert("🔒 Recurso VIP: O Histórico de KM é exclusivo para motoristas PRO. Faça o upgrade para acessar!");
        return; 
    }

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

// --- FUNÇÃO PARA CRIAR PARADAS NO MAPA (COM LIMITE PARA GRÁTIS) ---
function criarNovaParada() {
    const containerParadas = document.getElementById("container-paradas");
    
    // VERIFICA QUANTAS PARADAS JÁ EXISTEM NA TELA
    const numeroDeParadasAtuais = containerParadas.querySelectorAll('.parada-grupo').length;

    // TRAVA DE SEGURANÇA: Se não for PRO e tentar passar de 5 paradas
    if ((!dadosUsuario || dadosUsuario.plano !== "pro") && numeroDeParadasAtuais >= 5) {
        alert("🔒 Limite Atingido: O plano Grátis permite otimizar até 5 paradas por rota. Faça o upgrade para o PRO para ter paradas ilimitadas!");
        return; 
    }

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

    labelCam.onclick = (e) => {
        if (!dadosUsuario || dadosUsuario.plano !== "pro") {
            e.preventDefault(); 
            alert("📸 Recurso VIP: A leitura de endereço por foto é exclusiva do plano PRO!");
        }
    };

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
    container