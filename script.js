let mapa;
let directionsService;
let directionsRenderer;

function iniciarMapa() {
    const centroInicial = { lat: -23.55052, lng: -46.633309 };

    mapa = new google.maps.Map(document.getElementById("mapa"), {
        zoom: 12,
        center: centroInicial,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(mapa);

    // Ativa o Autocomplete para a Origem e o Destino logo que o app carrega
    configurarAutocomplete(document.getElementById("origem"));
    configurarAutocomplete(document.getElementById("destino"));
}

// Essa função conecta o campo de texto ao banco de dados do Google
function configurarAutocomplete(inputElement) {
    new google.maps.places.Autocomplete(inputElement, {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: "br" }
    });
}

document.addEventListener("DOMContentLoaded", function() {
    const btnCalcular = document.getElementById("btn-calcular");
    const btnAddParada = document.getElementById("btn-add-parada");
    const containerParadas = document.getElementById("container-paradas");

    // AÇÃO DE CALCULAR
    btnCalcular.addEventListener("click", calcularRotaOtimizada);

    // AÇÃO DE ADICIONAR NOVA PARADA (+)
    btnAddParada.addEventListener("click", function() {
        // Cria a caixinha principal
        const div = document.createElement("div");
        div.className = "parada-grupo";

        // 1. BOTÃO SUBIR ↑
        const btnSubir = document.createElement("button");
        btnSubir.type = "button";
        btnSubir.className = "btn-mover";
        btnSubir.innerHTML = "↑";
        btnSubir.onclick = function() {
            if (div.previousElementSibling) {
                containerParadas.insertBefore(div, div.previousElementSibling);
            }
        };

        // 2. BOTÃO DESCER ↓
        const btnDescer = document.createElement("button");
        btnDescer.type = "button";
        btnDescer.className = "btn-mover";
        btnDescer.innerHTML = "↓";
        btnDescer.onclick = function() {
            if (div.nextElementSibling) {
                containerParadas.insertBefore(div.nextElementSibling, div);
            }
        };

        // 3. CAMPO DE TEXTO
        const input = document.createElement("input");
        input.type = "text";
        input.className = "input-parada";
        input.placeholder = "Digite o endereço...";

        // 4. BOTÃO DA CÂMERA 📸
        const idUnico = "foto-" + Date.now(); 
        const labelCamera = document.createElement("label");
        labelCamera.className = "btn-camera";
        labelCamera.htmlFor = idUnico;
        labelCamera.innerText = "📸";

        const inputFoto = document.createElement("input");
        inputFoto.type = "file";
        inputFoto.id = idUnico;
        inputFoto.accept = "image/*";
        inputFoto.capture = "environment";
        inputFoto.style.display = "none";

       // Lógica para ler a foto com a IA (Tesseract) + FILTRO INTELIGENTE
        inputFoto.addEventListener("change", function(evento) {
            const arquivo = evento.target.files[0];
            if (arquivo) {
                input.value = "Iniciando motor da câmera... ⏳";
                
                Tesseract.recognize(
                    arquivo,
                    'por',
                    { 
                        logger: info => {
                            if (info.status === 'recognizing text') {
                                const progresso = Math.round(info.progress * 100);
                                input.value = `Lendo imagem: ${progresso}% ⏳`;
                            } else {
                                input.value = "Preparando IA... ⏳";
                            }
                        }
                    }
                ).then(({ data: { text } }) => {
                    // --- INÍCIO DO FILTRO DE NOTA FISCAL ---
                    const linhas = text.split('\n');
                    let linhasValidas = [];
                    const regraEndereco = /rua|avenida|av\.|travessa|alameda|praça|rodovia|cep/i;

                    linhas.forEach(linha => {
                        // Exige a palavra chave E algum número na linha
                        if (regraEndereco.test(linha) && /\d/.test(linha)) {
                            linhasValidas.push(linha.trim());
                        }
                    });

                    let textoFinal = "";

                    if (linhasValidas.length > 0) {
                        textoFinal = linhasValidas.join(', ');
                    } else {
                        // Plano B: Se não achou rua, pega o começo do texto limpo
                        textoFinal = text.replace(/\n/g, ' ').substring(0, 60);
                    }

                    // Joga no campo e foca para abrir as sugestões do Google
                    input.value = textoFinal;
                    input.focus(); 
                    // --- FIM DO FILTRO ---

                }).catch(erro => {
                    input.value = "";
                    alert("Erro ao tentar ler a imagem. Tente tirar a foto mais de perto.");
                });
            }
        });

        // 5. BOTÃO EXCLUIR X
        const btnRemover = document.createElement("button");
        btnRemover.type = "button";
        btnRemover.className = "btn-remover";
        btnRemover.innerText = "X";
        btnRemover.onclick = function() {
            containerParadas.removeChild(div);
        };

        // Coloca todos os botões e o campo de texto dentro da linha na ordem certa!
        div.appendChild(btnSubir);
        div.appendChild(btnDescer);
        div.appendChild(input);
        div.appendChild(labelCamera);
        div.appendChild(inputFoto);
        div.appendChild(btnRemover);
        
        containerParadas.appendChild(div);
        
        // Ativa o Autocomplete no campo que acabou de nascer
        configurarAutocomplete(input);
    });
});

function calcularRotaOtimizada() {
    const origem = document.getElementById("origem").value;
    const destino = document.getElementById("destino").value;
    const inputsParadas = document.querySelectorAll(".input-parada");

    // Verifica se o usuário quer otimizar (se o checkbox não existir no HTML, otimiza por padrão)
    const checkboxOtimizar = document.getElementById("otimizar-rota");
    const querOtimizar = checkboxOtimizar ? checkboxOtimizar.checked : true;

    if (origem === "" || destino === "") {
        alert("Por favor, preencha a origem e o destino final!");
        return;
    }

    let waypoints = [];
    
    inputsParadas.forEach(function(input) {
        if (input.value.trim() !== "") {
            waypoints.push({
                location: input.value.trim(),
                stopover: true
            });
        }
    });

    const request = {
        origin: origem,
        destination: destino,
        waypoints: waypoints,
        optimizeWaypoints: querOtimizar,
        travelMode: google.maps.TravelMode.DRIVING
    };

    directionsService.route(request, function(result, status) {
        if (status === google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result);
            
            // Chama a função da lista de botões
            gerarBotoesDeNavegacao(result);
        } else {
            alert("Não foi possível calcular a rota. Erro: " + status);
        }
    });
}

// Função separada e organizada para gerar a lista final de botões
function gerarBotoesDeNavegacao(result) {
    const divLista = document.getElementById("lista-paradas");
    divLista.innerHTML = "<h3 style='margin-top: 25px;'>📱 Rota Pronta para Navegar:</h3>"; 

    const legs = result.routes[0].legs; 

    for (let i = 0; i < legs.length; i++) {
        const enderecoParada = legs[i].end_address; 
        const numero = i + 1;
        
        const titulo = (numero === legs.length) ? "🏁 Destino Final" : `🛑 Parada ${numero}`;

        const divItem = document.createElement("div");
        divItem.className = "parada-item";

        const texto = document.createElement("p");
        texto.innerHTML = `<strong>${titulo}:</strong> ${enderecoParada}`;

        const btnNavegar = document.createElement("a");
        btnNavegar.className = "btn-navegar";
        btnNavegar.innerText = "Navegar 🚗";
        
        const enderecoFormatado = encodeURIComponent(enderecoParada);
        btnNavegar.href = `geo:0,0?q=${enderecoFormatado}`;

        divItem.appendChild(texto);
        divItem.appendChild(btnNavegar);
        divLista.appendChild(divItem);
    }
}