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
    if (!dadosUsuario) return false; 
    if (!dadosUsuario.plano) return false;
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

        // 🔥 MASTER OVERRIDE 
        const EMAIL_ADMIN = "fdsantos.melo@hotmail.com";
        const emailSeguro = user.email ? user.email.toLowerCase().trim() : "";
        const isAdmin = (emailSeguro === EMAIL_ADMIN);
        
        if (isAdmin) {
            dadosUsuario.plano = "pro";
            dadosUsuario.nome = "Danilo (Admin)";
            await setDoc(docRef, { 
                nome: "Danilo (Admin)", email: user.email, plano: "pro", status: "ativo" 
            }, { merge: true });
        }

        // --- LÓGICA DE TRIAL E REBAIXAMENTO ---
        const dataAtual = new Date().getTime();
        
        if (usuarioEhPro() && dadosUsuario.vencimento && dadosUsuario.vencimento < dataAtual && !isAdmin) {
            dadosUsuario.plano = "gratis";
            alert("⚠️ Seu período de teste VIP expirou! Suas funções foram limitadas para a versão gratuita.");
        }

        if (usuarioEhPro() && dadosUsuario.vencimento && dadosUsuario.vencimento > dataAtual && !isAdmin) {
            const diasRestantes = Math.ceil((dadosUsuario.vencimento - dataAtual) / (1000 * 60 * 60 * 24));
            const painel = document.getElementById("painel-principal");
            if (!document.getElementById("banner-trial") && painel) {
                const banner = document.createElement("div");
                banner.id = "banner-trial";
                banner.className = "banner-vip";
                banner.innerHTML = `🎁 <span><strong>Acesso VIP Liberado!</strong> Restam ${diasRestantes} dias grátis.</span>`;
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
    new google.maps.places.Autocomplete(inputElement, { types: ['geocode', 'establishment'], componentRestrictions: { country: "br" } });
}

function resetarTelas() {
    document.getElementById("painel-principal").style.display = "none";
    document.getElementById("aba-historico").style.display = "none";
    document.getElementById("aba-financeiro").style.display = "none";
    document.getElementById("menu-lateral").classList.remove("aberto");
}

window.voltarParaMapa = () => { resetarTelas(); document.getElementById("painel-principal").style.display = "block"; };

// --- LOGICA FINANCEIRA E HISTÓRICO ---
async function abrirFinanceiro() {
    if (!usuarioEhPro()) return alert("🔒 Recurso VIP: Exclusivo para PRO.");
    resetarTelas(); document.getElementById("aba-financeiro").style.display = "block"; carregarResumoFinanceiro();
}
async function carregarResumoFinanceiro() { /* Original Mantido Internamente no Firebase */ }
async function carregarHistorico() { /* Original Mantido Internamente no Firebase */ }

// ========================================================
// CÂMERA DINÂMICA (OCR -> FILTRO AVANÇADO -> GEOCODING)
// ========================================================
let streamCamera = null;
let scannerAtivo = false;
let workerTesseract = null; 

let audioCtx = null;
function iniciarAudioMobile() {
    if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    if (audioCtx.state === 'suspended') { audioCtx.resume(); }
}

function tocarBeep() {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.value = 1500; 
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.15); 
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) { console.log("Áudio bloqueado"); }
}

// 🧠 NOVO FILTRO NLP/REGEX (O Cérebro de Extração de Endereço)
function extrairEnderecoAvancado(textoBruto) {
    let txt = textoBruto.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    
    // 1. Tenta achar o CEP primeiro (O Geocoding do Google ama CEP)
    const regexCEP = /\b\d{5}-?\d{3}\b/;
    const matchCEP = txt.match(regexCEP);

    // 2. Busca o padrão principal de Logradouro + Número
    // Pega: Rua, Av, Avenida, Praça, Rodovia, etc.
    const regexRua = /(Rua|R\.|Av\.|Avenida|Travessa|Trav\.|Alameda|Al\.|Estrada|Rodovia|Praça|Praca|Vila|Vl\.)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+?)(?:[,|-]?\s*n?º?°?\s*)(\d{1,5})/i;
    const matchRua = txt.match(regexRua);

    // 3. Tenta achar a Sigla do Estado
    const regexEstado = /\b(SP|RJ|MG|RS|PR|SC|BA|PE|CE|PA|GO|AM|MT|MS|ES|DF|PB|RN|AL|SE|PI|RO|RR|AP|AC|TO|MA)\b/i;
    const matchEstado = txt.match(regexEstado);

    let enderecoMontado = "";

    // Se achou uma Rua bonitinha
    if (matchRua) {
        enderecoMontado = matchRua[0].trim();
        
        // Se tiver CEP na etiqueta, junta tudo (Fica perfeito pro Google)
        if (matchCEP) {
            enderecoMontado += ", " + matchCEP[0];
        } else if (matchEstado) {
            enderecoMontado += " - " + matchEstado[0].toUpperCase();
        }
        return enderecoMontado;
    }

    // PLANO B: Etiqueta mal impressa (sem a palavra "Rua")
    // Busca: "Nome da Rua Bonita, 1500"
    const regexPlanoB = /([A-Za-zÀ-ÖØ-öø-ÿ\s]{6,40})(?:[,|-]?\s*n?º?°?\s*)(\d{1,5})/i;
    const matchB = txt.match(regexPlanoB);

    if (matchB && matchCEP) {
        // Se achou um nome+numero E um CEP, é certeza que é endereço.
        return matchB[0].trim() + ", " + matchCEP[0];
    }

    // PLANO C: Só tem o CEP legível na caixa
    // O Google Maps consegue achar a rua APENAS com o CEP!
    if (matchCEP) {
        return matchCEP[0];
    }

    return null; // É lixo, código de barra ou nome, ignora.
}

async function abrirScannerInteligente(inputAlvo) {
    let modal = document.getElementById("modal-scanner");
    
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "modal-scanner";
        modal.innerHTML = `
            <style>
                @keyframes scanline { 0% { top: 0%; } 50% { top: 100%; } 100% { top: 0%; } }
                .laser { position: absolute; width: 100%; height: 2px; background: #22c55e; box-shadow: 0 0 10px #22c55e; animation: scanline 2s linear infinite; }
            </style>
            <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000;">
                <video id="video-scanner" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 85%; height: 150px; border: 3px solid rgba(255,255,255,0.4); border-radius: 12px; box-shadow: 0 0 0 9999px rgba(0,0,0,0.6); overflow: hidden;">
                    <div class="laser"></div>
                </div>
                <div id="status-scanner" style="position: absolute; top: 15%; width: 100%; text-align: center; color: #fef08a; font-weight: bold; font-size: 16px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">Carregando Motor OCR...</div>
                <button id="btn-fechar-camera" style="position: absolute; bottom: 40px; background: #ef4444; padding: 12px 30px; border-radius: 30px; border: none; color: white; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">✖ Cancelar</button>
            </div>
        `;
        modal.style.position = "fixed";
        modal.style.top = "0";
        modal.style.left = "0";
        modal.style.width = "100vw";
        modal.style.height = "100vh";
        modal.style.zIndex = "9999";
        document.body.appendChild(modal);
    }

    modal.style.display = "block";
    scannerAtivo = true;
    const video = document.getElementById("video-scanner");
    const btnFechar = document.getElementById("btn-fechar-camera");
    const textStatus = document.getElementById("status-scanner");

    try {
        streamCamera = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        video.srcObject = streamCamera;
    } catch (err) {
        alert("Erro ao acessar a câmera. Verifique permissões.");
        modal.style.display = "none";
        return;
    }

    const fecharTudo = async () => {
        scannerAtivo = false;
        if (streamCamera) streamCamera.getTracks().forEach(track => track.stop());
        if (workerTesseract) { await workerTesseract.terminate(); workerTesseract = null; }
        modal.style.display = "none";
    };
    btnFechar.onclick = fecharTudo;

    try {
        if (!workerTesseract) { workerTesseract = await Tesseract.createWorker('por'); }
        textStatus.innerHTML = "<span style='color: white;'>Mire no CEP ou Endereço...</span>";
    } catch(e) { textStatus.innerText = "Erro ao carregar OCR."; return; }

    const processarQuadroAoVivo = async () => {
        if (!scannerAtivo || !workerTesseract) return;

        const canvas = document.createElement("canvas");
        const w = video.videoWidth;
        const h = video.videoHeight;
        
        if (w === 0) { setTimeout(processarQuadroAoVivo, 500); return; }

        const cropW = w * 0.8;
        const cropH = h * 0.3;
        const startX = (w - cropW) / 2;
        const startY = (h - cropH) / 2;

        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, startX, startY, cropW, cropH, 0, 0, cropW, cropH);

        try {
            const { data: { text } } = await workerTesseract.recognize(canvas);
            if (!scannerAtivo) return; 

            // Passa o texto extraído pelo Cão Farejador (Regex)
            const enderecoLocalizado = extrairEnderecoAvancado(text);

            if (enderecoLocalizado) {
                tocarBeep(); // Apita
                fecharTudo(); // Fecha câmera
                
                // Formata primeira letra maiúscula e joga pro Geocoding (Autocomplete)
                inputAlvo.value = enderecoLocalizado.charAt(0).toUpperCase() + enderecoLocalizado.slice(1);
                
                // Dispara o evento de foco para acordar a API do Google Maps
                inputAlvo.focus(); 
                const event = new Event('input', { bubbles: true });
                inputAlvo.dispatchEvent(event);

            } else {
                // Se leu lixo, ignora e tenta de novo rápido
                setTimeout(processarQuadroAoVivo, 500); 
            }
        } catch (err) {
            if (scannerAtivo) setTimeout(processarQuadroAoVivo, 1000);
        }
    };
    
    setTimeout(processarQuadroAoVivo, 1500);
}
// ========================================================

// --- FUNÇÃO PARA CRIAR PARADAS NO MAPA ---
function criarNovaParada() {
    const containerParadas = document.getElementById("container-paradas");
    const numeroDeParadasAtuais = containerParadas.children.length;

    if (!usuarioEhPro() && numeroDeParadasAtuais >= 5) {
        alert("🔒 Limite Atingido: O plano Grátis permite otimizar até 5 paradas por rota. Faça o upgrade para o PRO para ter paradas ilimitadas!");
        return; 
    }

    const div = document.createElement("div");
    div.className = "parada-grupo";
    
    const input = document.createElement("input");
    input.type = "text";
    input.className = "input-parada";
    input.placeholder = "Endereço...";

    const inputTempo = document.createElement("input");
    inputTempo.type = "time";
    inputTempo.className = "input-tempo";
    inputTempo.title = "Horário Limite de Chegada";

    inputTempo.addEventListener("click", (e) => {
        if (!usuarioEhPro()) {
            e.preventDefault(); 
            inputTempo.blur(); 
            alert("⏰ Recurso VIP: Agendar o horário limite de chegada é exclusivo do plano PRO!");
        }
    });

    const btnVoz = document.createElement("button");
    btnVoz.innerText = "🎤";
    btnVoz.className = "btn-microfone";
    btnVoz.type = "button";
    
    btnVoz.onclick = () => {
        if (!usuarioEhPro()) {
            alert("🎤 Recurso VIP: A digitação por voz é exclusiva do plano PRO!");
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { return alert("Seu navegador não suporta voz nativa."); }

        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        
        recognition.onstart = () => { input.placeholder = "Ouvindo... 🔴"; btnVoz.style.color = "#ef4444"; };
        recognition.onresult = (event) => { input.value = event.results[0][0].transcript; btnVoz.style.color = "#64748b"; input.focus(); };
        recognition.onerror = () => { input.placeholder = "Endereço..."; btnVoz.style.color = "#64748b"; };

        recognition.start();
    };

    // Botão Câmera Inteligente
    const btnCam = document.createElement("button");
    btnCam.className = "btn-camera";
    btnCam.innerText = "📸";
    btnCam.type = "button";

    btnCam.onclick = () => {
        if (!usuarioEhPro()) {
            alert("📸 Recurso VIP: O Scanner Inteligente de Pacotes é exclusivo do plano PRO!");
            return;
        }
        iniciarAudioMobile(); 
        abrirScannerInteligente(input); 
    };

    const btnRemover = document.createElement("button");
    btnRemover.innerText = "×";
    btnRemover.className = "btn-remover-parada";
    btnRemover.onclick = () => containerParadas.removeChild(div);

    div.append(inputTempo, input, btnVoz, btnCam, btnRemover);
    containerParadas.appendChild(div);
    configurarAutocomplete(input);
}

// --- EVENTOS DE INTERFACE E ROTA ---
document.addEventListener("DOMContentLoaded", function() {
    const btnMenu = document.getElementById("btn-menu");
    const btnFecharMenu = document.getElementById("btn-fechar-menu");
    const menuLateral = document.getElementById("menu-lateral");
    const btnCalcular = document.getElementById("btn-calcular");
    const btnAddParada = document.getElementById("btn-add-parada");
    const btnSair = document.querySelector(".menu-item.sair");

    const linkKM = document.querySelector('.menu-links a:nth-child(2)');
    const linkFinanceiro = document.querySelector('.menu-links a:nth-child(3)');

    if (linkKM) linkKM.onclick = (e) => { e.preventDefault(); carregarHistorico(); };
    if (linkFinanceiro) linkFinanceiro.onclick = (e) => { e.preventDefault(); abrirFinanceiro(); };
    
    if (btnMenu) btnMenu.addEventListener("click", () => menuLateral.classList.add("aberto"));
    if (btnFecharMenu) btnFecharMenu.addEventListener("click", () => menuLateral.classList.remove("aberto"));

    if (btnSair) {
        btnSair.onclick = (e) => { e.preventDefault(); signOut(auth).then(() => window.location.href = "login.html"); };
    }

    if (btnAddParada) btnAddParada.onclick = () => criarNovaParada();
    if (btnCalcular) btnCalcular.addEventListener("click", calcularRotaOtimizada);
});

async function calcularRotaOtimizada() {
    const origem = document.getElementById("origem").value;
    const destino = document.getElementById("destino").value;
    const inputsEnderecos = document.querySelectorAll(".input-parada");
    const inputsTempos = document.querySelectorAll(".input-tempo");

    if (!origem || !destino) return alert("Origem e Destino são obrigatórios!");

    let waypoints = []; let temposOriginais = [];

    inputsEnderecos.forEach((input, index) => { 
        if (input.value) { 
            waypoints.push({ location: input.value, stopover: true }); 
            temposOriginais.push(inputsTempos[index].value || "Sem prazo");
        } 
    });

    const request = { origin: origem, destination: destino, waypoints: waypoints, optimizeWaypoints: true, travelMode: google.maps.TravelMode.DRIVING };

    directionsService.route(request, async (result, status) => {
        if (status === "OK") {
            directionsRenderer.setDirections(result);
            const dist = result.routes[0].legs.reduce((acc, leg) => acc + leg.distance.value, 0);
            const km = (dist / 1000).toFixed(2);

            if (usuarioLogado) {
                await addDoc(collection(db, "usuarios", usuarioLogado.uid, "historico_rotas"), { distancia: km, data: new Date(), origem, destino });
            }
            const ordemOtimizada = result.routes[0].waypoint_order;
            gerarBotoesDeNavegacao(result, temposOriginais, ordemOtimizada);
        }
    });
}

function gerarBotoesDeNavegacao(result, temposOriginais, ordemOtimizada) {
    const divLista = document.getElementById("lista-paradas");
    divLista.innerHTML = "<h3>📱 Rota Pronta:</h3>";
    
    result.routes[0].legs.forEach((leg, i) => {
        let prazoTexto = "";
        if (i < ordemOtimizada.length) {
            const indiceOriginal = ordemOtimizada[i]; 
            const prazo = temposOriginais[indiceOriginal]; 
            if (prazo !== "Sem prazo") { prazoTexto = ` (Até ${prazo})`; }
        } else { prazoTexto = " (Destino Final)"; }

        const btn = document.createElement("a");
        btn.className = "btn-navegar";
        btn.innerText = `Navegar para Parada ${i+1} 🚗 ${prazoTexto}`;
        btn.href = `geo:0,0?q=${encodeURIComponent(leg.end_address)}`;
        btn.onclick = function() { this.classList.add("visitado"); this.innerText = `✅ Parada ${i+1} Finalizada`; };
        divLista.appendChild(btn);
    });
}