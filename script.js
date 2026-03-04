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

// --- VERIFICAÇÃO DE LOGIN E BLOQUEIO VISUAL ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogado = user;
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);
        
        // Se a ficha existir no banco, puxa ela. Se não existir, cria uma vazia.
        if (docSnap.exists()) {
            dadosUsuario = docSnap.data(); 
        } else {
            dadosUsuario = { plano: "gratis", nome: "Motorista" };
        }

        // 🔥 MASTER OVERRIDE: O passe livre do Dono do App
        const EMAIL_ADMIN = "fdsantos.melo@hotmail.com";
        if (user.email === EMAIL_ADMIN) {
            dadosUsuario.plano = "pro";
            dadosUsuario.nome = "Danilo (Admin)";
            
            // Salva você de forma forçada no banco de dados para aparecer no Painel ADM
            await setDoc(docRef, {
                nome: "Danilo (Admin)",
                email: user.email,
                plano: "pro",
                status: "ativo"
            }, { merge: true });
        }
        // ------------------------------------------------

        // Preenche o menu lateral
        const pPerfil = document.querySelector(".menu-perfil p");
        if (pPerfil) {
            const planoTexto = dadosUsuario.plano === "pro" ? "⭐ Plano PRO" : "Plano Grátis";
            const corPlano = dadosUsuario.plano === "pro" ? "#ffc107" : "#6c757d";
            pPerfil.innerHTML = `Olá, ${dadosUsuario.nome || 'Motorista'}!<br><small style="color: ${corPlano}; font-weight: bold;">${planoTexto}</small>`;
        }

        // Tranca os menus se não for PRO
        if (dadosUsuario.plano !== "pro") {
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

// --- LOGICA FINANCEIRA E HISTÓRICO ---
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

// --- FUNÇÃO PARA CRIAR PARADAS NO MAPA (COM VOZ, CÂMERA E RELÓGIO) ---
function criarNovaParada() {
    const containerParadas = document.getElementById("container-paradas");
    const numeroDeParadasAtuais = containerParadas.children.length;

    let isPro = false;
    if (dadosUsuario && dadosUsuario.plano === "pro") {
        isPro = true;
    }

    if (isPro === false && numeroDeParadasAtuais >= 5) {
        alert("🔒 Limite Atingido: O plano Grátis permite otimizar até 5 paradas por rota. Faça o upgrade para o PRO para ter paradas ilimitadas!");
        return; 
    }

    const div = document.createElement("div");
    div.className = "parada-grupo";
    
    // Campo de Endereço
    const input = document.createElement("input");
    input.type = "text";
    input.className = "input-parada";
    input.placeholder = "Endereço...";

    // --- NOVO: Campo de Janela de Tempo ---
    const inputTempo = document.createElement("input");
    inputTempo.type = "time";
    inputTempo.className = "input-tempo";
    inputTempo.title = "Horário Limite de Chegada";

    // Trava do tempo para usuário grátis
    if (isPro === false) {
        inputTempo.onclick = (e) => {
            e.preventDefault(); 
            inputTempo.blur(); // Tira o foco para ele não conseguir abrir o relógio
            alert("⏰ Recurso VIP: Agendar o horário limite de chegada é exclusivo do plano PRO!");
        };
        inputTempo.readOnly = true;
    }

    // Botão Microfone (Voz)
    const btnVoz = document.createElement("button");
    btnVoz.innerText = "🎤";
    btnVoz.className = "btn-microfone";
    btnVoz.type = "button";
    
    btnVoz.onclick = () => {
        if (isPro === false) {
            alert("🎤 Recurso VIP: A digitação por voz é exclusiva do plano PRO!");
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Seu navegador ou celular não suporta reconhecimento de voz nativo.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        
        recognition.onstart = () => {
            input.placeholder = "Ouvindo... 🔴";
            btnVoz.style.backgroundColor = "#ef4444";
            btnVoz.style.color = "#fff";
        };

        recognition.onresult = (event) => {
            input.value = event.results[0][0].transcript;
            btnVoz.style.backgroundColor = "transparent";
            btnVoz.style.color = "#64748b";
            input.focus(); 
        };

        recognition.onerror = () => {
            input.placeholder = "Endereço...";
            btnVoz.style.backgroundColor = "transparent";
            btnVoz.style.color = "#64748b";
            alert("Não conseguimos ouvir. Tente novamente.");
        };

        recognition.start();
    };

    // Botão Câmera (Tesseract)
    const idUnico = "foto-" + Date.now();
    const labelCam = document.createElement("label");
    labelCam.className = "btn-camera";
    labelCam.htmlFor = idUnico;
    labelCam.innerText = "📸";

    labelCam.onclick = (e) => {
        if (isPro === false) {
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

    // Botão de Remover (X)
    const btnRemover = document.createElement("button");
    btnRemover.innerText = "×";
    btnRemover.className = "btn-remover-parada";
    btnRemover.onclick = () => containerParadas.removeChild(div);

    // Coloca todos os elementos dentro da linha na ordem certa
    div.append(inputTempo, input, btnVoz, labelCam, inputFoto, btnRemover);
    containerParadas.appendChild(div);
    configurarAutocomplete(input);
}

// --- EVENTOS DE INTERFACE ---
document.addEventListener("DOMContentLoaded", function() {
    const btnMenu = document.getElementById("btn-menu");
    const btnFecharMenu = document.getElementById("btn-fechar-menu");
    const menuLateral = document.getElementById("menu-lateral");
    const btnCalcular = document.getElementById("btn-calcular");
    const btnAddParada = document.getElementById("btn-add-parada");
    const btnSair = document.querySelector(".menu-item.sair");
    const btnSalvarFinanceiro = document.getElementById("btn-salvar-financeiro");

    const btnUnico = document.getElementById("btn-financeiro-unico");
    const btnVarios = document.getElementById("btn-financeiro-varios");
    const divUnico = document.getElementById("financeiro-input-unico");
    const divVarios = document.getElementById("financeiro-input-varios");

    const linkKM = document.querySelector('.menu-links a:nth-child(2)');
    const linkFinanceiro = document.querySelector('.menu-links a:nth-child(3)');

    if (btnUnico) btnUnico.onclick = () => { divUnico.style.display = "block"; divVarios.style.display = "none"; };
    if (btnVarios) btnVarios.onclick = () => { divUnico.style.display = "none"; divVarios.style.display = "block"; };

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
            const gasto = parseFloat(document.getElementById("gasto-valor").value) || 0;
            const categoria = document.getElementById("categoria-gasto").value;
            let totalGanhoLancado = 0;

            if (divVarios.style.display === "block") {
                const texto = document.getElementById("lista-ganhos-colados").value.trim();
                if (texto) {
                    const listaGanhos = texto.split('\n').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
                    totalGanhoLancado = listaGanhos.reduce((a, b) => a + b, 0);
                }
            } else {
                totalGanhoLancado = parseFloat(document.getElementById("ganho-valor").value) || 0;
            }

            if (totalGanhoLancado === 0 && gasto === 0) return alert("Insira algum valor!");
            
            try {
                await addDoc(collection(db, "usuarios", usuarioLogado.uid, "financeiro"), {
                    ganho: totalGanhoLancado, 
                    gasto: gasto, 
                    categoria: categoria, 
                    lucro: totalGanhoLancado - gasto, 
                    data: new Date()
                });
                alert("Corre salvo com sucesso! 🚀");
                document.getElementById("ganho-valor").value = "";
                document.getElementById("gasto-valor").value = "";
                document.getElementById("lista-ganhos-colados").value = "";
                carregarResumoFinanceiro();
            } catch (e) { console.error(e); }
        };
    }

    if (btnAddParada) btnAddParada.onclick = () => criarNovaParada();
    if (btnCalcular) btnCalcular.addEventListener("click", calcularRotaOtimizada);
});

// --- ROTA E NAVEGAÇÃO COM RASTREIO DE TEMPO ---
async function calcularRotaOtimizada() {
    const origem = document.getElementById("origem").value;
    const destino = document.getElementById("destino").value;
    
    const inputsEnderecos = document.querySelectorAll(".input-parada");
    const inputsTempos = document.querySelectorAll(".input-tempo"); // Captura os relógios

    if (!origem || !destino) return alert("Origem e Destino são obrigatórios!");

    let waypoints = [];
    let temposOriginais = []; // Lista para gravar a ordem original dos horários

    inputsEnderecos.forEach((input, index) => { 
        if (input.value) { 
            waypoints.push({ location: input.value, stopover: true }); 
            temposOriginais.push(inputsTempos[index].value || "Sem prazo"); // Grava o horário correspondente
        } 
    });

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
            
            // Pega a nova ordem misturada pelo Google e gera os botões com os prazos corretos
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
        
        // Verifica se é uma parada ou o destino final (o último "leg" é a chegada ao destino)
        if (i < ordemOtimizada.length) {
            const indiceOriginal = ordemOtimizada[i]; // Acha de onde essa parada veio
            const prazo = temposOriginais[indiceOriginal]; // Pega o horário original dela
            
            if (prazo !== "Sem prazo") {
                prazoTexto = ` (Até ${prazo})`;
            }
        } else {
            prazoTexto = " (Destino Final)";
        }

        const btn = document.createElement("a");
        btn.className = "btn-navegar";
        btn.innerText = `Navegar para Parada ${i+1} 🚗 ${prazoTexto}`;
        btn.href = `geo:0,0?q=${encodeURIComponent(leg.end_address)}`;
        btn.onclick = function() {
            this.classList.add("visitado");
            this.innerText = `✅ Parada ${i+1} Finalizada`;
        };
        divLista.appendChild(btn);
    });
}