import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBceowtEvmh9YJTLpeGR2rYnOSjmXRjH_U",
    authDomain: "roturbo.firebaseapp.com",
    projectId: "roturbo",
    storageBucket: "roturbo.firebasestorage.app",
    messagingSenderId: "356395708767",
    appId: "1:356395708767:web:4b4bb608ef29ee2a67c6ea"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const EMAIL_ADMIN = "fdsantos.melo@hotmail.com"; 

// Variável global para armazenar os usuários e exportar depois
let listaDeUsuariosExportacao = [];
const VALOR_MENSALIDADE = 29.90; // Defina aqui o preço do seu plano PRO

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.email !== EMAIL_ADMIN) {
            alert("Acesso Negado! Você não é um administrador.");
            window.location.href = "index.html";
        } else {
            carregarUsuarios(); 
            carregarConfiguracoesGlobais(); // Carrega o texto do aviso
        }
    } else {
        window.location.href = "login.html";
    }
});

document.getElementById("btn-sair-adm").onclick = () => {
    signOut(auth).then(() => window.location.href = "login.html");
};

// --- NAVEGAÇÃO ENTRE ABAS ---
window.mudarAba = (abaId, elementoClicado) => {
    // Esconde todas as abas
    document.querySelectorAll('.conteudo-aba').forEach(aba => aba.classList.remove('ativa'));
    // Remove a classe 'active' de todos os itens do menu
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    // Mostra a aba escolhida e marca o menu
    document.getElementById(`aba-${abaId}`).classList.add('ativa');
    elementoClicado.classList.add('active');
};

// --- CARREGAR USUÁRIOS E RELATÓRIOS ---
window.carregarUsuarios = async () => {
    const tabelaCorpo = document.getElementById("tabela-corpo");
    
    try {
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        tabelaCorpo.innerHTML = "";
        listaDeUsuariosExportacao = []; // Zera a lista
        
        let totalUsers = 0;
        let totalPro = 0;
        let totalBloqueados = 0;
        const dataAtual = new Date().getTime(); 

        querySnapshot.forEach((documento) => {
            const user = documento.data();
            const uid = documento.id;
            
            // Salva na lista global para o CSV
            listaDeUsuariosExportacao.push({
                Nome: user.nome || "Sem Nome",
                Email: user.email || "Sem Email",
                Plano: user.plano || "gratis",
                Status: user.status || "ativo",
                Vencimento: user.vencimento ? new Date(user.vencimento).toLocaleDateString('pt-BR') : "Sem data"
            });

            totalUsers++;
            const plano = user.plano || "gratis";
            const status = user.status || "ativo";

            if (plano === "pro") totalPro++;
            if (status === "bloqueado") totalBloqueados++;

            let vencimentoTexto = "<span style='color: #94a3b8; font-size: 13px;'>Sem data</span>";
            if (user.vencimento) {
                const dataVenc = new Date(user.vencimento);
                const dataFormatada = dataVenc.toLocaleDateString('pt-BR');
                if (user.vencimento < dataAtual && plano === "pro") {
                    vencimentoTexto = `<span style='color: #ef4444; font-weight: bold;'><i class="fa-solid fa-circle-exclamation"></i> Vencido (${dataFormatada})</span>`;
                } else if (plano === "pro") {
                    vencimentoTexto = `<span style='color: #22c55e; font-weight: bold;'><i class="fa-solid fa-circle-check"></i> ${dataFormatada}</span>`;
                } else {
                    vencimentoTexto = `<span style='color: #64748b;'>${dataFormatada}</span>`;
                }
            }

            const tr = document.createElement("tr");

            const btnPlano = plano === "pro" 
                ? `<button class="btn-acao btn-remover-pro" onclick="alterarUsuario('${uid}', 'plano', 'gratis')"><i class="fa-solid fa-arrow-down"></i> Tirar PRO</button>` 
                : `<button class="btn-acao btn-pro" onclick="alterarUsuario('${uid}', 'plano', 'pro')"><i class="fa-solid fa-star"></i> Dar PRO</button>`;

            const btnStatus = status === "bloqueado"
                ? `<button class="btn-acao btn-desbloquear" onclick="alterarUsuario('${uid}', 'status', 'ativo')"><i class="fa-solid fa-unlock"></i> Desbloquear</button>`
                : `<button class="btn-acao btn-bloquear" onclick="alterarUsuario('${uid}', 'status', 'bloqueado')"><i class="fa-solid fa-lock"></i> Bloquear</button>`;

            const btnExcluir = `<button class="btn-acao btn-excluir" onclick="excluirUsuario('${uid}', '${user.nome || 'Usuário'}')"><i class="fa-solid fa-trash"></i></button>`;
            const btnRenovar = `<button class="btn-acao" style="background: #0ea5e9;" onclick="renovarPlano('${uid}')"><i class="fa-solid fa-calendar-plus"></i> +30 Dias</button>`;

            tr.innerHTML = `
                <td><strong>${user.nome || "Sem Nome"}</strong></td>
                <td>${user.email || "Sem E-mail"}</td>
                <td><span class="badge ${plano}">${plano.toUpperCase()}</span></td>
                <td>${vencimentoTexto}</td>
                <td><span class="badge ${status}">${status.toUpperCase()}</span></td>
                <td>
                    <div class="acoes-flex">
                        ${btnRenovar}
                        ${btnPlano}
                        ${btnStatus}
                        ${btnExcluir}
                    </div>
                </td>
            `;
            tabelaCorpo.appendChild(tr);
        });

        // Atualiza Cards
        document.getElementById("adm-total-usuarios").innerText = totalUsers;
        document.getElementById("adm-total-pro").innerText = totalPro;
        document.getElementById("adm-total-bloqueados").innerText = totalBloqueados;
        
        // Atualiza Faturamento (Aba Relatórios)
        const faturamento = totalPro * VALOR_MENSALIDADE;
        document.getElementById("adm-faturamento").innerText = `R$ ${faturamento.toFixed(2).replace('.', ',')}`;

    } catch (erro) {
        console.error("Erro ao carregar:", erro);
        tabelaCorpo.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Erro ao carregar dados.</td></tr>`;
    }
}

// --- PESQUISA ---
window.filtrarUsuarios = () => {
    const inputPesquisa = document.getElementById("input-pesquisa").value.toLowerCase();
    const linhasTabela = document.querySelectorAll("#tabela-corpo tr");
    linhasTabela.forEach(linha => {
        const nome = linha.cells[0]?.innerText.toLowerCase() || "";
        const email = linha.cells[1]?.innerText.toLowerCase() || "";
        linha.style.display = (nome.includes(inputPesquisa) || email.includes(inputPesquisa)) ? "" : "none";
    });
};

// --- AÇÕES DO USUÁRIO ---
window.alterarUsuario = async (uid, campo, novoValor) => {
    if (!confirm("Confirmar alteração para este usuário?")) return;
    try {
        await updateDoc(doc(db, "usuarios", uid), { [campo]: novoValor });
        carregarUsuarios(); 
    } catch (erro) { alert("Erro ao atualizar."); }
};

window.excluirUsuario = async (uid, nome) => {
    if (!confirm(`⚠️ ALERTA: Apagar ${nome} do banco de dados?`)) return;
    try {
        await deleteDoc(doc(db, "usuarios", uid));
        carregarUsuarios();
    } catch (erro) { alert("Erro ao excluir."); }
};

window.renovarPlano = async (uid) => {
    if (!confirm("Renovar plano PRO deste usuário por +30 dias?")) return;
    const dataFutura = new Date();
    dataFutura.setDate(dataFutura.getDate() + 30);
    try {
        await updateDoc(doc(db, "usuarios", uid), { plano: "pro", vencimento: dataFutura.getTime() });
        alert(`Sucesso! Liberado até ${dataFutura.toLocaleDateString('pt-BR')}`);
        carregarUsuarios(); 
    } catch (erro) { alert("Erro ao renovar."); }
};

// ==========================================
// NOVAS FUNÇÕES: RELATÓRIOS E CONFIGURAÇÕES
// ==========================================

// EXPORTAR PARA CSV
window.exportarParaCSV = () => {
    if (listaDeUsuariosExportacao.length === 0) return alert("Nenhum usuário para exportar.");
    
    // Cria o cabeçalho do CSV
    let csvContent = "data:text/csv;charset=utf-8,Nome,Email,Plano,Status,Vencimento\n";
    
    // Adiciona os dados
    listaDeUsuariosExportacao.forEach(u => {
        const linha = `"${u.Nome}","${u.Email}","${u.Plano}","${u.Status}","${u.Vencimento}"`;
        csvContent += linha + "\n";
    });

    // Cria o arquivo e faz o download automático
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `roturbo_motoristas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// AVISO GLOBAL NO APP
async function carregarConfiguracoesGlobais() {
    try {
        const docRef = doc(db, "configuracoes", "geral");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().avisoGlobal) {
            document.getElementById("aviso-global").value = docSnap.data().avisoGlobal;
        }
    } catch (erro) { console.log("Erro ao carregar configurações", erro); }
}

window.salvarAvisoGlobal = async () => {
    const aviso = document.getElementById("aviso-global").value.trim();
    try {
        // Usa setDoc para criar o documento caso ele não exista ainda
        await setDoc(doc(db, "configuracoes", "geral"), { avisoGlobal: aviso }, { merge: true });
        alert(aviso ? "Aviso global publicado com sucesso!" : "Aviso global apagado com sucesso!");
    } catch (erro) {
        console.error(erro);
        alert("Erro ao salvar o aviso.");
    }
};

window.limparAvisoGlobal = () => {
    document.getElementById("aviso-global").value = "";
    salvarAvisoGlobal(); // Salva vazio no banco
};