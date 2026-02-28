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

        // --- LÓGICA TURBINADA DE LEITURA DE FOTO ---
        inputFoto.addEventListener("change", function(evento) {
            const arquivo = evento.target.files[0];
            if (arquivo) {
                input.value = "Tratando imagem... ⏳";

                // Pega o arquivo e transforma em imagem na memória
                const leitor = new FileReader();
                leitor.onload = function(e) {
                    const img = new Image();
                    img.onload = function() {
                        // Cria uma "tela" invisível para tratar a foto
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        // O SEGREDO: Aumenta a imagem em 2x para a IA conseguir ler notas pequenas!
                        const escala = 2; 
                        canvas.width = img.width * escala;
                        canvas.height = img.height * escala;

                        // Desenha a imagem gigante
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                        // Transforma o canvas de volta em imagem de alta qualidade
                        const imagemMelhorada = canvas.toDataURL('image/jpeg');

                        input.value = "Iniciando IA... ⏳";

                        // Manda a imagem gigante pro Tesseract!
                        Tesseract.recognize(
                            imagemMelhorada,
                            'por',
                            { 
                                logger: info => {
                                    if (info.status === 'recognizing text') {
                                        const progresso = Math.round(info.progress * 100);
                                        input.value = `Lendo imagem: ${progresso}% ⏳`;
                                    }
                                }
                            }
                        ).then(({ data: { text } }) => {
                            const linhas = text.split('\n');
                            let enderecoEncontrado = "";

                            const regraEndereco = /(rua|avenida|av\.|av|travessa|alameda|praça|rodovia|estrada)\s+.*?\d+/i;

                            for (let i = 0; i < linhas.length; i++) {
                                let linha = linhas[i].trim();
                                if (regraEndereco.test(linha)) {
                                    enderecoEncontrado = linha;
                                    break;
                                }
                            }

                            if (enderecoEncontrado !== "") {
                                enderecoEncontrado = enderecoEncontrado.replace(/[|_[\]{}<>]/g, '').trim();
                                input.value = enderecoEncontrado;
                            } else {
                                // Se ainda assim falhar, mostra o que ele achou pra gente diagnosticar
                                input.value = "Não encontrou Rua/Av na leitura.";
                                console.log("TEXTO PURO DA IA:", text); 
                            }

                            input.focus();

                        }).catch(erro => {
                            input.value = "";
                            alert("Erro ao ler imagem.");
                        });
                    };
                    img.src = e.target.result;
                };
                leitor.readAsDataURL(arquivo);
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