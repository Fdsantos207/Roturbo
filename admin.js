import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Seu e-mail de administrador (Trava de segurança!)
const EMAIL_ADMIN = "fdsantos.melo@hotmail.com"; 

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.email !== EMAIL_ADMIN) {
            alert("Acesso Negado! Você não é um administrador.");
            window.location.href = "index.html";
        } else {
            carregarUsuarios(); // Se for você, carrega o painel
        }
    } else {
        window.location.href = "login.html";
    }
});

document.getElementById("btn-sair-adm").onclick = () => {
    signOut(auth).then(() => window.location.href = "login.html");
};

async function carregarUsuarios() {
    const tabelaCorpo = document.getElementById("tabela-corpo");
    
    try {
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        tabelaCorpo.innerHTML = "";
        
        let totalUsers = 0;
        let totalPro = 0;
        let totalBloqueados = 0;
        const dataAtual = new Date().getTime(); // Pega a data de hoje em milissegundos

        querySnapshot.forEach((documento) => {
            const user = documento.data();
            const uid = documento.id;
            totalUsers++;

            const plano = user.plano || "gratis";
            const status = user.status || "ativo";

            if (plano === "pro") totalPro++;
            if (status === "bloqueado") totalBloqueados++;

            // --- LÓGICA DE VENCIMENTO ---
            let vencimentoTexto = "<span style='color: #94a3b8; font-size: 13px;'>Sem data</span>";
            
            if (user.vencimento) {
                const dataVenc = new Date(user.vencimento);
                const dataFormatada = dataVenc.toLocaleDateString('pt-BR');
                
                if (user.vencimento < dataAtual && plano === "pro") {
                    // Está vencido! (Vermelho)
                    vencimentoTexto = `<span style='color: #ef4444; font-weight: bold;'><i class="fa-solid fa-circle-exclamation"></i> Vencido (${dataFormatada})</span>`;
                } else if (plano === "pro") {
                    // Em dia! (Verde)
                    vencimentoTexto = `<span style='color: #22c55e; font-weight: bold;'><i class="fa-solid fa-circle-check"></i> ${dataFormatada}</span>`;
                } else {
                    // Plano grátis, mas com data antiga salva (Cinza)
                    vencimentoTexto = `<span style='color: #64748b;'>${dataFormatada}</span>`;
                }
            }

            const tr = document.createElement("tr");

            // Botões de Ação COM ÍCONES PROFISSIONAIS
            const btnPlano = plano === "pro" 
                ? `<button class="btn-acao btn-remover-pro" onclick="alterarUsuario('${uid}', 'plano', 'gratis')"><i class="fa-solid fa-arrow-down"></i> Tirar PRO</button>` 
                : `<button class="btn-acao btn-pro" onclick="alterarUsuario('${uid}', 'plano', 'pro')"><i class="fa-solid fa-star"></i> Dar PRO</button>`;

            const btnStatus = status === "bloqueado"
                ? `<button class="btn-acao btn-desbloquear" onclick="alterarUsuario('${uid}', 'status', 'ativo')"><i class="fa-solid fa-unlock"></i> Desbloquear</button>`
                : `<button class="btn-acao btn-bloquear" onclick="alterarUsuario('${uid}', 'status', 'bloqueado')"><i class="fa-solid fa-lock"></i> Bloquear</button>`;

            const btnExcluir = `<button class="btn-acao btn-excluir" onclick="excluirUsuario('${uid}', '${user.nome || 'Usuário Sem Nome'}')"><i class="fa-solid fa-trash"></i> Excluir</button>`;

            // NOVO BOTÃO: Renovar 30 dias
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

        // Atualiza os cards numéricos no topo
        document.getElementById("adm-total-usuarios").innerText = totalUsers;
        document.getElementById("adm-total-pro").innerText = totalPro;
        document.getElementById("adm-total-bloqueados").innerText = totalBloqueados;

    } catch (erro) {
        console.error("Erro ao carregar usuários:", erro);
        tabelaCorpo.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Erro ao carregar dados do banco.</td></tr>`;
    }
}

// NOVA FUNÇÃO: Barra de Pesquisa (Filtro em Tempo Real)
window.filtrarUsuarios = () => {
    const inputPesquisa = document.getElementById("input-pesquisa").value.toLowerCase();
    const linhasTabela = document.querySelectorAll("#tabela-corpo tr");

    linhasTabela.forEach(linha => {
        // Pega o texto da coluna Nome e E-mail
        const nome = linha.cells[0]?.innerText.toLowerCase() || "";
        const email = linha.cells[1]?.innerText.toLowerCase() || "";
        
        // Esconde ou mostra baseado no que foi digitado
        if (nome.includes(inputPesquisa) || email.includes(inputPesquisa)) {
            linha.style.display = "";
        } else {
            linha.style.display = "none";
        }
    });
};

// Funções de Gerenciamento Padrão
window.alterarUsuario = async (uid, campo, novoValor) => {
    const acaoTexto = campo === 'plano' ? (novoValor === 'pro' ? 'DAR PRO' : 'TIRAR PRO') : (novoValor === 'ativo' ? 'DESBLOQUEAR' : 'BLOQUEAR');
    const confirmacao = confirm(`Você deseja confirmar a ação de ${acaoTexto} para este usuário?`);
    if (!confirmacao) return;

    try {
        const userRef = doc(db, "usuarios", uid);
        await updateDoc(userRef, {
            [campo]: novoValor
        });
        carregarUsuarios(); // Atualiza a tabela imediatamente
    } catch (erro) {
        console.error("Erro ao atualizar:", erro);
        alert("Erro ao comunicar com o banco de dados.");
    }
};

window.excluirUsuario = async (uid, nome) => {
    const confirmacao = confirm(`⚠️ ALERTA DE EXCLUSÃO: Tem certeza que deseja APAGAR ${nome} do banco de dados? Os históricos também serão perdidos.`);
    if (!confirmacao) return;

    try {
        const userRef = doc(db, "usuarios", uid);
        await deleteDoc(userRef);
        carregarUsuarios();
    } catch (erro) {
        console.error("Erro ao excluir:", erro);
        alert("Erro ao excluir o usuário do Firebase.");
    }
};

// --- NOVA FUNÇÃO: RENOVAR PLANO (+30 DIAS) ---
window.renovarPlano = async (uid) => {
    const confirmacao = confirm("Deseja ativar/renovar o plano PRO deste usuário por +30 dias?");
    if (!confirmacao) return;

    // Calcula a data de hoje + 30 dias
    const dataFutura = new Date();
    dataFutura.setDate(dataFutura.getDate() + 30);
    const vencimentoEmMilissegundos = dataFutura.getTime();

    try {
        const userRef = doc(db, "usuarios", uid);
        await updateDoc(userRef, {
            plano: "pro", // Já garante que ele vira PRO
            vencimento: vencimentoEmMilissegundos
        });
        alert(`Sucesso! Acesso liberado até ${dataFutura.toLocaleDateString('pt-BR')}`);
        carregarUsuarios(); // Atualiza a tabela com a data verdinha
    } catch (erro) {
        console.error("Erro ao renovar:", erro);
        alert("Erro ao aplicar a renovação.");
    }
};