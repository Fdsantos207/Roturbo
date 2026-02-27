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

// Essa função conecta o campo de texto ao banco de dados de lugares do Google
function configurarAutocomplete(inputElement) {
    new google.maps.places.Autocomplete(inputElement, {
        types: ['geocode', 'establishment'], // Procura ruas e comércios
        componentRestrictions: { country: "br" } // Foca no Brasil para ser mais rápido e preciso
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
        // Cria a caixinha que vai segurar o input e o botão X
        const div = document.createElement("div");
        div.className = "parada-grupo";

        // Cria o campo de texto
        const input = document.createElement("input");
        input.type = "text";
        input.className = "input-parada";
        input.placeholder = "Digite o endereço da parada...";

        // Cria o botão de excluir (X)
        const btnRemover = document.createElement("button");
        btnRemover.type = "button";
        btnRemover.className = "btn-remover";
        btnRemover.innerText = "X";
        // Se clicar no X, ele deleta a caixinha inteira da tela
        btnRemover.onclick = function() {
            containerParadas.removeChild(div);
        };

        // Coloca o input e o botão X dentro da caixinha, e joga na tela
        div.appendChild(input);
        div.appendChild(btnRemover);
        containerParadas.appendChild(div);

        // O SEGREDO: Ativa o Autocomplete neste novo campo que acabou de nascer!
        configurarAutocomplete(input);
    });
});

function calcularRotaOtimizada() {
    const origem = document.getElementById("origem").value;
    const destino = document.getElementById("destino").value;
    
    // Pega todos os campos de parada que o usuário criou dinamicamente
    const inputsParadas = document.querySelectorAll(".input-parada");

    if (origem === "" || destino === "") {
        alert("Por favor, preencha a origem e o destino final!");
        return;
    }

    let waypoints = [];
    
    // Passa por cada campo de parada e adiciona na lista (se não estiver vazio)
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
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING
    };

    directionsService.route(request, function(result, status) {
        if (status === google.maps.DirectionsStatus.OK) {
            // Desenha a linha azul no mapa
            directionsRenderer.setDirections(result);
            
            // NOVO: Chama a função que desenha a lista com os botões
            gerarBotoesDeNavegacao(result);
        } else {
            alert("Não foi possível calcular a rota. Erro: " + status);
        }
    });
    // Função para desenhar os botões de GPS
function gerarBotoesDeNavegacao(result) {
    const divLista = document.getElementById("lista-paradas");
    // Limpa a lista anterior e coloca um título
    divLista.innerHTML = "<h3 style='margin-top: 25px;'>📱 Rota Pronta para Navegar:</h3>"; 

    // O Google divide a rota em partes chamadas "legs" (pernas). 
    // A perna 0 é da Origem até a 1ª Parada. A perna 1 é da 1ª Parada até a 2ª...
    const legs = result.routes[0].legs; 

    for (let i = 0; i < legs.length; i++) {
        const enderecoParada = legs[i].end_address; // O endereço onde essa parte termina
        const numero = i + 1;
        
        // Se for a última etapa da viagem, escrevemos "Destino Final"
        const titulo = (numero === legs.length) ? "🏁 Destino Final" : `🛑 Parada ${numero}`;

        // Cria a caixinha branca para o item
        const divItem = document.createElement("div");
        divItem.className = "parada-item";

        // Adiciona o texto do endereço
        const texto = document.createElement("p");
        texto.innerHTML = `<strong>${titulo}:</strong> ${enderecoParada}`;

        // Cria o botão que aciona o app de GPS do usuário
        const btnNavegar = document.createElement("a");
        btnNavegar.className = "btn-navegar";
        btnNavegar.innerText = "Navegar 🚗";
        
        // O comando 'geo:' diz ao sistema do celular para abrir o app de mapas padrão
        const enderecoFormatado = encodeURIComponent(enderecoParada);
        btnNavegar.href = `geo:0,0?q=${enderecoFormatado}`;

        // Junta tudo e joga na tela
        divItem.appendChild(texto);
        divItem.appendChild(btnNavegar);
        divLista.appendChild(divItem);
    }
}
}