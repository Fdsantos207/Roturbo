import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

            // Define os botões dependendo do status do usuário
            const btnPlano = plano === "pro" 
                ? `<button class="btn-acao" style="background:#6c757d;" onclick="alterarUsuario('${uid}', 'plano', 'gratis')">Tirar PRO</button>` 
                : `<button class="btn-acao btn-pro" onclick="alterarUsuario('${uid}', 'plano', 'pro')">Dar PRO</button>`;

            const btnStatus = status === "bloqueado"
                ? `<button class="btn-acao btn-desbloquear" onclick="alterarUsuario('${uid}', 'status', 'ativo')">Desbloquear</button>`
                : `<button class="btn-acao btn-bloquear" onclick="alterarUsuario('${uid}', 'status', 'bloqueado')">Bloquear</button>`;

            tr.innerHTML = `
                <td><strong>${user.nome || "Sem Nome"}</strong></td>
                <td>${user.email || "Sem E-mail"}</td>
                <td><span class="badge ${plano}">${plano.toUpperCase()}</span></td>
                <td><span class="badge ${status}">${status.toUpperCase()}</span></td>
                <td>
                    ${btnPlano}
                    ${btnStatus}
                </td>
            `;
            tabelaCorpo.appendChild(tr);
        });

        // Atualiza os cards lá no topo
        document.getElementById("adm-total-usuarios").innerText = totalUsers;
        document.getElementById("adm-total-pro").innerText = totalPro;
        document.getElementById("adm-total-bloqueados").innerText = totalBloqueados;

    } catch (erro) {
        console.error("Erro ao carregar usuários:", erro);
        tabelaCorpo.innerHTML = `<tr><td colspan="5">Erro ao carregar dados. Verifique as permissões do Firebase.</td></tr>`;
    }
}

// Função global para os botões da tabela funcionarem
window.alterarUsuario = async (uid, campo, novoValor) => {
    const confirmacao = confirm(`Tem certeza que deseja alterar o ${campo} para ${novoValor}?`);
    if (!confirmacao) return;

    try {
        const userRef = doc(db, "usuarios", uid);
        await updateDoc(userRef, {
            [campo]: novoValor
        });
        alert(`Atualizado com sucesso!`);
        carregarUsuarios(); // Recarrega a tabela para mostrar a mudança
    } catch (erro) {
        console.error("Erro ao atualizar:", erro);
        alert("Erro ao atualizar o usuário.");
    }
};