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

    configurarAutocomplete(document.getElementById("origem"));
    configurarAutocomplete(document.getElementById("destino"));
}

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

    btnCalcular.addEventListener("click", calcularRotaOtimizada);

    btnAddParada.addEventListener("click", function() {
        const div = document.createElement("div");
        div.className = "parada-grupo";

        const btnSubir = document.createElement("button");
        btnSubir.type = "button";
        btnSubir.className = "btn-mover";
        btnSubir.innerHTML = "↑";
        btnSubir.onclick = function() {
            if (div.previousElementSibling) {
                containerParadas.insertBefore(div, div.previousElementSibling);
            }
        };

        const btnDescer = document.createElement("button");
        btnDescer.type = "button";
        btnDescer.className = "btn-mover";
        btnDescer.innerHTML = "↓";
        btnDescer.onclick = function() {
            if (div.nextElementSibling) {
                containerParadas.insertBefore(div.nextElementSibling, div);
            }
        };

        const input = document.createElement("input");
        input.type = "text";
        input.className = "input-parada";
        input.placeholder = "Digite o endereço...";

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

       // Lógica da Câmera com o FILTRO PURO DE ENDEREÇO
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
                    // --- FILTRO ROBUSTO ---
                    const linhas = text.split('\n');
                    let enderecoEncontrado = "";

                    // Procura uma linha que tenha Rua/Av/etc E pelo menos um número nela
                    const regraEndereco = /(rua|avenida|av\.|av|travessa|alameda|praça|rodovia|estrada)\s+.*?\d+/i;

                    for (let i = 0; i < linhas.length; i++) {
                        let linha = linhas[i].trim();
                        if (regraEndereco.test(linha)) {
                            enderecoEncontrado = linha;
                            break; // Achou a primeira linha boa, para de procurar!
                        }
                    }

                    if (enderecoEncontrado !== "") {
                        // Limpa "sujeiras" que o OCR costuma ler errado tipo | ou _
                        enderecoEncontrado = enderecoEncontrado.replace(/[|_[\]{}<>]/g, '').trim();
                        input.value = enderecoEncontrado;
                    } else {
                        // Se não achar nada, coloca pelo menos um pedaço do texto pra você ver o que ele leu
                        input.value = text.replace(/\n/g, ' ').substring(0, 50);
                    }

                    // Foca no campo para você poder dar um "espaço" e o Google sugerir
                    input.focus();
                    // --- FIM DO FILTRO ---

                }).catch(erro => {
                    input.value = "";
                    alert("Erro ao tentar ler a imagem. Tente tirar a foto mais de perto.");
                });
            }
        });

        const btnRemover = document.createElement("button");
        btnRemover.type = "button";
        btnRemover.className = "btn-remover";
        btnRemover.innerText = "X";
        btnRemover.onclick = function() {
            containerParadas.removeChild(div);
        };

        div.appendChild(btnSubir);
        div.appendChild(btnDescer);
        div.appendChild(input);
        div.appendChild(labelCamera);
        div.appendChild(inputFoto);
        div.appendChild(btnRemover);
        
        containerParadas.appendChild(div);
        
        configurarAutocomplete(input);
    });
});

function calcularRotaOtimizada() {
    const origem = document.getElementById("origem").value;
    const destino = document.getElementById("destino").value;
    const inputsParadas = document.querySelectorAll(".input-parada");

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
            gerarBotoesDeNavegacao(result);
        } else {
            alert("Não foi possível calcular a rota. Erro: " + status);
        }
    });
}

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