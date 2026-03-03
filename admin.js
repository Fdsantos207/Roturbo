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

        querySnapshot.forEach((documento) => {
            const user = documento.data();
            const uid = documento.id;
            totalUsers++;

            const plano = user.plano || "gratis";
            const status = user.status || "ativo";

            if (plano === "pro") totalPro++;
            if (status === "bloqueado") totalBloqueados++;

            const tr = document.createElement("tr");

            // Botões de Ação
            const btnPlano = plano === "pro" 
                ? `<button class="btn-acao" style="background:#6c757d;" onclick="alterarUsuario('${uid}', 'plano', 'gratis')">Tirar PRO</button>` 
                : `<button class="btn-acao btn-pro" onclick="alterarUsuario('${uid}', 'plano', 'pro')">Dar PRO</button>`;

            const btnStatus = status === "bloqueado"
                ? `<button class="btn-acao btn-desbloquear" onclick="alterarUsuario('${uid}', 'status', 'ativo')">Desbloquear</button>`
                : `<button class="btn-acao btn-bloquear" onclick="alterarUsuario('${uid}', 'status', 'bloqueado')">Bloquear</button>`;

            // Novo botão de excluir
            const btnExcluir = `<button class="btn-acao btn-excluir" onclick="excluirUsuario('${uid}', '${user.nome || 'este usuário'}')">🗑️ Excluir</button>`;

            tr.innerHTML = `
                <td><strong>${user.nome || "Sem Nome"}</strong></td>
                <td>${user.email || "Sem E-mail"}</td>
                <td><span class="badge ${plano}">${plano.toUpperCase()}</span></td>
                <td><span class="badge ${status}">${status.toUpperCase()}</span></td>
                <td>
                    ${btnPlano}
                    ${btnStatus}
                    ${btnExcluir}
                </td>
            `;
            tabelaCorpo.appendChild(tr);
        });

        // Atualiza os cards numéricos
        document.getElementById("adm-total-usuarios").innerText = totalUsers;
        document.getElementById("adm-total-pro").innerText = totalPro;
        document.getElementById("adm-total-bloqueados").innerText = totalBloqueados;

    } catch (erro) {
        console.error("Erro ao carregar usuários:", erro);
        tabelaCorpo.innerHTML = `<tr><td colspan="5">Erro ao carregar dados. Verifique o console.</td></tr>`;
    }
}

// Função para Bloquear / Dar PRO
window.alterarUsuario = async (uid, campo, novoValor) => {
    const confirmacao = confirm(`Tem certeza que deseja alterar o ${campo} para ${novoValor}?`);
    if (!confirmacao) return;

    try {
        const userRef = doc(db, "usuarios", uid);
        await updateDoc(userRef, {
            [campo]: novoValor
        });
        carregarUsuarios();
    } catch (erro) {
        console.error("Erro ao atualizar:", erro);
        alert("Erro ao atualizar o usuário.");
    }
};

// --- NOVA FUNÇÃO: EXCLUIR USUÁRIO ---
window.excluirUsuario = async (uid, nome) => {
    // Confirmação dupla para evitar acidentes
    const confirmacao = confirm(`⚠️ ATENÇÃO: Tem certeza que deseja EXCLUIR DEFINITIVAMENTE os dados do motorista ${nome}? Esta ação apagará o histórico dele e não pode ser desfeita.`);
    if (!confirmacao) return;

    try {
        const userRef = doc(db, "usuarios", uid);
        await deleteDoc(userRef); // Comando que apaga o documento do Firestore
        alert(`O usuário ${nome} foi excluído com sucesso do banco de dados!`);
        carregarUsuarios(); // Recarrega a tabela na mesma hora
    } catch (erro) {
        console.error("Erro ao excluir:", erro);
        alert("Erro ao excluir o usuário. Verifique as permissões do Firebase.");
    }
};