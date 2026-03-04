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

// Seu e-mail de administrador
const EMAIL_ADMIN = "fdsantos.melo@hotmail.com"; 

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.email !== EMAIL_ADMIN) {
            alert("Acesso Negado! Você não é um administrador.");
            window.location.href = "index.html";
        } else {
            carregarUsuarios(); // Carrega os dados se for você
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

        querySnapshot.forEach((documento) => {
            const user = documento.data();
            const uid = documento.id;
            totalUsers++;

            const plano = user.plano || "gratis";
            const status = user.status || "ativo";

            if (plano === "pro") totalPro++;
            if (status === "bloqueado") totalBloqueados++;

            const tr = document.createElement("tr");

            // Botões de Ação COM ÍCONES PROFISSIONAIS
            const btnPlano = plano === "pro" 
                ? `<button class="btn-acao btn-remover-pro" onclick="alterarUsuario('${uid}', 'plano', 'gratis')"><i class="fa-solid fa-arrow-down"></i> Tirar PRO</button>` 
                : `<button class="btn-acao btn-pro" onclick="alterarUsuario('${uid}', 'plano', 'pro')"><i class="fa-solid fa-star"></i> Dar PRO</button>`;

            const btnStatus = status === "bloqueado"
                ? `<button class="btn-acao btn-desbloquear" onclick="alterarUsuario('${uid}', 'status', 'ativo')"><i class="fa-solid fa-unlock"></i> Desbloquear</button>`
                : `<button class="btn-acao btn-bloquear" onclick="alterarUsuario('${uid}', 'status', 'bloqueado')"><i class="fa-solid fa-lock"></i> Bloquear</button>`;

            const btnExcluir = `<button class="btn-acao btn-excluir" onclick="excluirUsuario('${uid}', '${user.nome || 'Usuário Sem Nome'}')"><i class="fa-solid fa-trash"></i> Excluir</button>`;

            tr.innerHTML = `
                <td><strong>${user.nome || "Sem Nome"}</strong></td>
                <td>${user.email || "Sem E-mail"}</td>
                <td><span class="badge ${plano}">${plano.toUpperCase()}</span></td>
                <td><span class="badge ${status}">${status.toUpperCase()}</span></td>
                <td>
                    <div class="acoes-flex">
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
        tabelaCorpo.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Erro ao carregar dados do banco.</td></tr>`;
    }
}

// NOVA FUNÇÃO: Barra de Pesquisa (Filtro em Tempo Real)
window.filtrarUsuarios = () => {
    const inputPesquisa = document.getElementById("input-pesquisa").value.toLowerCase();
    const linhasTabela = document.querySelectorAll("#tabela-corpo tr");

    linhasTabela.forEach(linha => {
        // Pega o texto da coluna Nome (índice 0) e E-mail (índice 1)
        const nome = linha.cells[0]?.innerText.toLowerCase() || "";
        const email = linha.cells[1]?.innerText.toLowerCase() || "";
        
        // Se o nome ou email conter o que foi digitado, mostra a linha, senão esconde
        if (nome.includes(inputPesquisa) || email.includes(inputPesquisa)) {
            linha.style.display = "";
        } else {
            linha.style.display = "none";
        }
    });
};

// Funções de Gerenciamento
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