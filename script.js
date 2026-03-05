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
let enderecosOtimizadosGlobal = []; 

function usuarioEhPro() {
    if (!dadosUsuario) return false; 
    if (!dadosUsuario.plano) return false;
    return dadosUsuario.plano.toLowerCase().trim() === "pro";
}

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

        const EMAIL_ADMIN = "fdsantos.melo@hotmail.com";
        const emailSeguro = user.email ? user.email.toLowerCase().trim() : "";
        const isAdmin = (emailSeguro === EMAIL_ADMIN);
        
        if (isAdmin) {
            dadosUsuario.plano = "pro";
            dadosUsuario.nome = "Danilo (Admin)";
            await setDoc(docRef, { nome: "Danilo (Admin)", email: user.email, plano: "pro", status: "ativo" }, { merge: true });
        }

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

window.iniciarMapa = function() {
    const centroInicial = { lat: -23.55052, lng: -46.633309 };
    mapa = new google.maps.Map(document.getElementById("mapa"), {
        zoom: 12,
        center: centroInicial,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        disableDefaultUI: true, 
        zoomControl: true
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

async function abrirFinanceiro() {
    if (!usuarioEhPro()) return alert("🔒 Recurso VIP: Exclusivo para PRO.");
    resetarTelas(); document.getElementById("aba-financeiro").style.display = "block"; carregarResumoFinanceiro();
}
async function carregarResumoFinanceiro() { /* Mantido */ }
async function carregarHistorico() { /* Mantido */ }

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

function extrairEnderecoAvancado(textoBruto) {
    let txt = textoBruto.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const regexCEP = /\b\d{5}-?\d{3}\b/;
    const matchCEP = txt.match(regexCEP);
    const regexRua = /(Rua|R\.|Av\.|Avenida|Travessa|Trav\.|Alameda|Al\.|Estrada|Rodovia|Praça|Praca|Vila|Vl\.)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+?)(?:[,|-]?\s*n?º?°?\s*)(\d{1,5})/i;
    const matchRua = txt.match(regexRua);
    const regexEstado = /\b(SP|RJ|MG|RS|PR|SC|BA|PE|CE|PA|GO|AM|MT|MS|ES|DF|PB|RN|AL|SE|PI|RO|RR|AP|AC|TO|MA)\b/i;
    const matchEstado = txt.match(regexEstado);

    let enderecoMontado = "";
    if (matchRua) {
        enderecoMontado = matchRua[0].trim();
        if (matchCEP) { enderecoMontado += ", " + matchCEP[0]; } 
        else if (matchEstado) { enderecoMontado += " - " + matchEstado[0].toUpperCase(); }
        return enderecoMontado;
    }

    const regexPlanoB = /([A-Za-zÀ-ÖØ-öø-ÿ\s]{6,40})(?:[,|-]?\s*n?º?°?\s*)(\d{1,5})/i;
    const matchB = txt.match(regexPlanoB);
    if (matchB && matchCEP) { return matchB[0].trim() + ", " + matchCEP[0]; }
    if (matchCEP) { return matchCEP[0]; }
    return null; 
}

function buscarPacoteNaRota(enderecoLido) {
    const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\w\s]/gi, ' ');
    const buscaNorm = normalize(enderecoLido);
    const palavrasLidas = buscaNorm.split(/\s+/).filter(p => p.length > 2 || /\d/.test(p)); 

    let melhorIndice = -1;
    let maiorPontuacao = 0;

    for (let i = 0; i < enderecosOtimizadosGlobal.length; i++) {
        const endAlvo = normalize(enderecosOtimizadosGlobal[i]);
        let pontuacao = 0;
        
        palavrasLidas.forEach(palavra => {
            if (endAlvo.includes(palavra)) {
                pontuacao += /\d/.test(palavra) ? 3 : 1; 
            }
        });

        if (pontuacao > maiorPontuacao) {
            maiorPontuacao = pontuacao;
            melhorIndice = i;
        }
    }

    if (maiorPontuacao < 3) { melhorIndice = -1; }
    mostrarResultadoBusca(melhorIndice, enderecoLido);
}

function mostrarResultadoBusca(indice, lido) {
    let div = document.createElement('div');
    div.style = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.95);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;text-align:center;padding:20px;";
    
    if (indice !== -1) {
        let textoParada = (indice === enderecosOtimizadosGlobal.length - 1) ? "DESTINO FINAL" : `PARADA ${indice + 1}`;
        div.innerHTML = `
            <div style="font-size: 60px; margin-bottom: 20px;">📦</div>
            <h2 style="color:#22c55e;font-size:24px;margin:0;">Pacote Encontrado na Rota!</h2>
            <h1 style="font-size:70px;margin:20px 0;color:#facc15;text-shadow: 2px 2px 0 #000;">${textoParada}</h1>
            <p style="font-size:16px;color:#cbd5e1;background:#333;padding:10px;border-radius:8px;"><strong>Lido:</strong> ${lido}</p>
            <button style="margin-top:40px;padding:15px 50px;font-size:20px;background:#2563eb;border:none;border-radius:12px;color:white;cursor:pointer;font-weight:bold;box-shadow: 0 4px 10px rgba(37, 99, 235, 0.4);" onclick="this.parentElement.remove()">OK, PRÓXIMO</button>
        `;
    } else {
        div.innerHTML = `
            <div style="font-size: 60px; margin-bottom: 20px;">❓</div>
            <h2 style="color:#ef4444;font-size:24px;margin:0;">Pacote Não Identificado</h2>
            <p style="font-size:16px;color:#cbd5e1;margin:20px 0;">O endereço lido (${lido}) não parece pertencer a nenhuma parada da sua rota atual.</p>
            <button style="margin-top:40px;padding:15px 40px;font-size:20px;background:#64748b;border:none;border-radius:12px;color:white;cursor:pointer;font-weight:bold;" onclick="this.parentElement.remove()">Tentar Novamente</button>
        `;
    }
    document.body.appendChild(div);
}

async function abrirScannerInteligente(inputAlvo, modo = 'input') {
    let modal = document.getElementById("modal-scanner");
    let emPausa = false; 
    
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "modal-scanner";
        modal.innerHTML = `
            <div style="position: relative; width: 100%; height: 100%; background: #000; overflow: hidden;">
                <video id="video-scanner" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
                
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-shadow: inset 0 0 0 2000px rgba(0,0,0,0.5); pointer-events: none;">
                    <div style="position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); width: 80%; height: 250px; background: transparent;">
                        <div style="position:absolute; top:0; left:0; width:40px; height:40px; border-top: 4px solid white; border-left: 4px solid white; border-top-left-radius: 16px;"></div>
                        <div style="position:absolute; top:0; right:0; width:40px; height:40px; border-top: 4px solid white; border-right: 4px solid white; border-top-right-radius: 16px;"></div>
                        <div style="position:absolute; bottom:0; left:0; width:40px; height:40px; border-bottom: 4px solid white; border-left: 4px solid white; border-bottom-left-radius: 16px;"></div>
                        <div style="position:absolute; bottom:0; right:0; width:40px; height:40px; border-bottom: 4px solid white; border-right: 4px solid white; border-bottom-right-radius: 16px;"></div>
                    </div>
                    <div id="status-scanner" style="position: absolute; top: 15%; width: 100%; text-align: center; color: white; font-weight: bold; font-size: 16px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">Mire no endereço do pacote...</div>
                </div>
                
                <button id="btn-fechar-camera" style="position: absolute; top: 40px; left: 20px; width: 45px; height: 45px; border-radius: 50%; background: rgba(0,0,0,0.4); color: white; border: none; font-size: 20px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);">✕</button>

                <div id="banner-confirmacao" style="position: absolute; bottom: 0; left: 0; width: 100%; background: white; border-radius: 20px 20px 0 0; padding: 24px 20px 40px 20px; box-sizing: border-box; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 -10px 20px rgba(0,0,0,0.15);">
                    <div style="display: flex; gap: 15px; align-items: flex-start; margin-bottom: 20px;">
                        <div style="font-size: 24px; color: #64748b; background: #f1f5f9; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="#64748b"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                        </div>
                        <div style="flex: 1;">
                            <h3 id="texto-endereco-lido" style="margin: 0; color: #0f172a; font-size: 18px; font-weight: 700; line-height: 1.2;">-</h3>
                            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Capturado pelo Scanner</p>
                        </div>
                    </div>
                    <button id="btn-confirmar-parada" style="background: #2563eb; color: white; border: none; border-radius: 12px; padding: 16px; font-size: 16px; font-weight: bold; width: 100%; cursor: pointer; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);">Adicionar parada</button>
                    <div style="text-align: center; margin-top: 15px;">
                        <span id="btn-recusar-parada" style="color: #64748b; font-size: 14px; font-weight: bold; cursor: pointer; padding: 10px;">Endereço incorreto? Tentar de novo 👇</span>
                    </div>
                </div>
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
    emPausa = false; 
    document.getElementById("banner-confirmacao").style.transform = "translateY(100%)"; 
    
    const video = document.getElementById("video-scanner");
    const btnFechar = document.getElementById("btn-fechar-camera");
    const textStatus = document.getElementById("status-scanner");
    const btnConfirmar = document.getElementById("btn-confirmar-parada");
    const btnRecusar = document.getElementById("btn-recusar-parada");

    btnConfirmar.innerText = modo === 'busca' ? "Localizar este Pacote" : "Adicionar parada";

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
        textStatus.innerText = "Mire no endereço do pacote...";
    } catch(e) { textStatus.innerText = "Erro ao carregar IA."; return; }

    const processarQuadroAoVivo = async () => {
        if (!scannerAtivo || !workerTesseract || emPausa) return;

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
            if (!scannerAtivo || emPausa) return; 

            const enderecoLocalizado = extrairEnderecoAvancado(text);

            if (enderecoLocalizado) {
                tocarBeep(); 
                emPausa = true; 
                
                const textoFinal = enderecoLocalizado.charAt(0).toUpperCase() + enderecoLocalizado.slice(1);
                
                document.getElementById("texto-endereco-lido").innerText = textoFinal;
                document.getElementById("banner-confirmacao").style.transform = "translateY(0)";

                btnConfirmar.onclick = () => {
                    fecharTudo();
                    if (modo === 'input') {
                        inputAlvo.value = textoFinal;
                        inputAlvo.focus(); 
                        const event = new Event('input', { bubbles: true });
                        inputAlvo.dispatchEvent(event);
                    } else if (modo === 'busca') {
                        buscarPacoteNaRota(textoFinal);
                    }
                };

                btnRecusar.onclick = () => {
                    document.getElementById("banner-confirmacao").style.transform = "translateY(100%)"; 
                    emPausa = false; 
                    setTimeout(processarQuadroAoVivo, 500); 
                };

            } else {
                setTimeout(processarQuadroAoVivo, 500); 
            }
        } catch (err) {
            if (scannerAtivo && !emPausa) setTimeout(processarQuadroAoVivo, 1000);
        }
    };
    
    setTimeout(processarQuadroAoVivo, 1500);
}

// ========================================================
// BARRA DE PESQUISA 
// ========================================================
function criarNovaParada() {
    const containerParadas = document.getElementById("container-paradas");
    const numeroDeParadasAtuais = containerParadas.children.length;

    if (!usuarioEhPro() && numeroDeParadasAtuais >= 5) {
        alert("🔒 Limite Atingido: O plano Grátis permite otimizar até 5 paradas por rota. Faça o upgrade para o PRO para ter paradas ilimitadas!");
        return; 
    }

    const div = document.createElement("div");
    div.className = "parada-grupo";
    
    const barra = document.createElement("div");
    barra.className = "barra-pesquisa-moderna";

    const iconLupa = document.createElement("div");
    iconLupa.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;
    
    const input = document.createElement("input");
    input.type = "text";
    // ⚠️ A CLASSE ABAIXO FOI RECUPERADA! É ELA QUE FAZ A ROTA FUNCIONAR ⚠️
    input.className = "input-parada"; 
    input.placeholder = "Toque para adicionar";

    const btnCam = document.createElement("button");
    btnCam.className = "btn-acao-icone";
    btnCam.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z"/><path d="M7 11h10v2H7z"/></svg>`;
    btnCam.onclick = () => {
        if (!usuarioEhPro()) return alert("📸 Recurso VIP: Exclusivo plano PRO!");
        iniciarAudioMobile(); 
        abrirScannerInteligente(input, 'input'); 
    };

    const btnVoz = document.createElement("button");
    btnVoz.className = "btn-acao-icone";
    btnVoz.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`;
    btnVoz.onclick = () => {
        if (!usuarioEhPro()) return alert("🎤 Recurso VIP: Exclusivo plano PRO!");
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return alert("Seu navegador não suporta voz nativa.");
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.onstart = () => { input.placeholder = "Ouvindo..."; };
        recognition.onresult = (event) => { input.value = event.results[0][0].transcript; input.focus(); };
        recognition.onerror = () => { input.placeholder = "Toque para adicionar"; };
        recognition.start();
    };

    const btnRemover = document.createElement("button");
    btnRemover.className = "btn-acao-icone";
    btnRemover.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`;
    btnRemover.onclick = () => containerParadas.removeChild(div);

    barra.append(iconLupa, input, btnCam, btnVoz, btnRemover);

    const linhaExtras = document.createElement("div");
    linhaExtras.className = "linha-extras";
    
    const inputTempo = document.createElement("input");
    inputTempo.type = "time";
    inputTempo.className = "input-tempo";
    inputTempo.title = "Horário Limite";
    inputTempo.style.background = "#e2e8f0";
    inputTempo.style.padding = "4px 8px";
    inputTempo.style.borderRadius = "12px";
    inputTempo.style.border = "none";
    inputTempo.style.fontSize = "13px";
    inputTempo.style.color = "#475569";

    inputTempo.addEventListener("click", (e) => {
        if (!usuarioEhPro()) {
            e.preventDefault(); 
            inputTempo.blur(); 
            alert("⏰ Recurso VIP: Agendar o horário limite de chegada é exclusivo do plano PRO!");
        }
    });

    linhaExtras.append(inputTempo);

    div.append(barra, linhaExtras);
    containerParadas.appendChild(div);
    configurarAutocomplete(input);
}

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
    
    enderecosOtimizadosGlobal = result.routes[0].legs.map(leg => leg.end_address);

    const btnBusca = document.createElement("button");
    btnBusca.innerHTML = "📦 Bipar e Localizar Pacote";
    btnBusca.style = "background: linear-gradient(90deg, #f59e0b, #d97706); color: white; padding: 18px; border: none; border-radius: 8px; font-weight: bold; width: 100%; margin-bottom: 20px; font-size: 16px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex; justify-content: center; align-items: center; gap: 10px;";
    btnBusca.onclick = () => {
        if (!usuarioEhPro()) return alert("🔒 Recurso VIP: O Localizador de Pacotes é exclusivo do plano PRO!");
        iniciarAudioMobile();
        abrirScannerInteligente(null, 'busca'); 
    };
    divLista.appendChild(btnBusca);
    
    result.routes[0].legs.forEach((leg, i) => {
        let prazoTexto = "";
        if (i < ordemOtimizada.length) {
            const indiceOriginal = ordemOtimizada[i]; 
            const prazo = temposOriginais[indiceOriginal]; 
            if (prazo !== "Sem prazo") { prazoTexto = ` (Até ${prazo})`; }
        } else { prazoTexto = " (Destino Final)"; }

        // A MÁGICA DA NAVEGAÇÃO INDIVIDUAL À PROVA DE FALHAS
        // Puxa o GPS nativo do celular apontando direto pra parada que ele clicou
        const linkMapsOficial = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(leg.end_address)}&travelmode=driving`;

        const btn = document.createElement("a");
        btn.className = "btn-navegar";
        btn.innerText = `Navegar para Parada ${i+1} 🚗 ${prazoTexto}`;
        btn.href = linkMapsOficial;
        btn.target = "_blank";
        
        btn.onclick = function() { 
            this.classList.add("visitado"); 
            this.innerText = `✅ Parada ${i+1} Finalizada`; 
        };
        divLista.appendChild(btn);
    });
}