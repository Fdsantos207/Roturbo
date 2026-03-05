import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc, getDocs, query, orderBy, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// --- REGRA DE OURO: CHECAGEM DINÂMICA DE PLANO ---
function usuarioEhPro() {
    if (!dadosUsuario) return false; // Se ainda não carregou do banco, bloqueia por segurança
    if (!dadosUsuario.plano) return false;
    // Transforma tudo em minúsculo e tira espaços para evitar bugs como "PRO" ou "pro "
    return dadosUsuario.plano.toLowerCase().trim() === "pro";
}

// --- VERIFICAÇÃO DE LOGIN E BLOQUEIO VISUAL ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogado = user;
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            dadosUsuario = docSnap.data(); 
        } else {
            dadosUsuario = { plano: "gratis", nome: "Motorista" };
        }

        // 🔥 MASTER OVERRIDE: O passe livre do Dono (Agora à prova de letras maiúsculas)
        const EMAIL_ADMIN = "fdsantos.melo@hotmail.com";
        if (user.email && user.email.toLowerCase() === EMAIL_ADMIN) {
            dadosUsuario.plano = "pro";
            dadosUsuario.nome = "Danilo (Admin)";
            await setDoc(docRef, { nome: "Danilo (Admin)", email: user.email, plano: "pro", status: "ativo" }, { merge: true });
        }

        // --- LÓGICA DE TRIAL (DEGUSTAÇÃO) E REBAIXAMENTO ---
        const dataAtual = new Date().getTime();
        
        if (usuarioEhPro() && dadosUsuario.vencimento && dadosUsuario.vencimento < dataAtual && user.email.toLowerCase() !== EMAIL_ADMIN) {
            dadosUsuario.plano = "gratis";
            alert("⚠️ Seu período de teste VIP expirou! Suas funções foram limitadas para a versão gratuita. Entre em contato para assinar o Roturbo PRO.");
        }

        if (usuarioEhPro() && dadosUsuario.vencimento && dadosUsuario.vencimento > dataAtual && user.email.toLowerCase() !== EMAIL_ADMIN) {
            const diasRestantes = Math.ceil((dadosUsuario.vencimento - dataAtual) / (1000 * 60 * 60 * 24));
            const painel = document.getElementById("painel-principal");
            if (!document.getElementById("banner-trial") && painel) {
                const banner = document.createElement("div");
                banner.id = "banner-trial";
                banner.className = "banner-vip";
                banner.innerHTML = `🎁 <span><strong>Acesso VIP Liberado!</strong> Restam ${diasRestantes} dias de teste grátis.</span>`;
                painel.insertBefore(banner, painel.firstChild);
            }
        }

        const pPerfil = document.querySelector(".menu-perfil p");
        if (pPerfil) {
            const planoTexto = usuarioEhPro() ? "⭐ Plano PRO" : "Plano Grátis";
            const corPlano = usuarioEhPro() ? "#ffc107" : "#6c757d";
            pPerfil.innerHTML = `Olá, ${dadosUsuario.nome || 'Motorista'}!<br><small style="color: ${corPlano}; font-weight: bold;">${planoTexto}</small>`;
        }

        if (!usuarioEhPro()) {
            const linkKM = document.querySelector('.menu-links a:nth-child(2)'); 
            const linkFinanceiro = document.querySelector('.menu-links a:nth-child(3)'); 
            if (linkKM && !linkKM.innerText.includes("🔒")) linkKM.innerText += " 🔒";
            if (linkFinanceiro && !linkFinanceiro.innerText.includes("🔒")) linkFinanceiro.innerText += " 🔒";
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

// --- LOGICA FINANCEIRA E HISTÓRICO ---
async function abrirFinanceiro() {
    if (!usuarioEhPro()) {
        alert("🔒 Recurso VIP: A Gestão do Corre é exclusiva para motoristas PRO. Faça o upgrade para acessar!");
        return; 
    }
    resetarTelas();
    document.getElementById("aba-financeiro").style.display = "block";
    carregarResumoFinanceiro();
}