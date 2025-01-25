export class TarotCardInfo extends HTMLElement {
    connectedCallback() {
        // Define o conteúdo inicial vazio
        this.innerHTML = `
            <div class="tarot-card-info">
                <div class="info-content">
                    <h2 id="card-title"></h2>
                    <img id="card-image">
                    <p id="card-name"></p>
                    <p id="card-description"></p>
                    <p id="card-numero"></p>
                    <p id="card-arcano"></p>
                    <p id="card-maior"></p>
                    <p id="card-menor"></p>
                    <p id="card-element"></p>
                    <p id="card-sign"></p>
                    <p id="card-planet"></p>
                    <button id="close-info">Fechar</button>
                </div>
            </div>
        `;

        // Adiciona o evento de fechar
        this.querySelector('#close-info').addEventListener('click', () => this.hideInfo());
    }

    /**
     * Exibe as informações da carta.
     * @param {Object} cardData - Dados da carta a serem exibidos.
     */
    showInfo(cardData) {
        // Atualiza os elementos do modal com os dados da carta
        this.querySelector('#card-title').textContent = cardData.title || 'Não disponível.';
        this.querySelector('#card-image').src = `assets/cards/crowley-${cardData.order}.jpg`|| 'assets/back.jpg';

        this.querySelector('#card-name').textContent = cardData.name || 'Não disponível.';
        this.querySelector('#card-numero').textContent = `Número: ${cardData.number}` || 'Número não disponível.';
        

        this.querySelector('#card-description').textContent = cardData.description || 'Descrição não disponível.';
        this.querySelector('#card-arcano').textContent = cardData.isMajorArcana? 'Arcana Maior' : 'Arcana Menor'
        this.querySelector('#card-maior').textContent =  `Oitava Maior: ${cardData.eighth_greater}`
        this.querySelector('#card-menor').textContent =  `Oitava Menor: ${cardData.eighth_lesser}`

        // Exibe o elemento, signo e planeta, caso disponíveis
        this.querySelector('#card-element').textContent = cardData.element ? `Elemento: ${cardData.element}` : 'Elemento: Não definido';
        this.querySelector('#card-sign').textContent = cardData.sign ? `Signo: ${cardData.sign}` : 'Signo: Não definido';
        this.querySelector('#card-planet').textContent = cardData.planet ? `Planeta: ${cardData.planet}` : 'Planeta: Não definido';

        this.removeAttribute('hidden', true); // Exibe o modal
    }

    /**
     * Esconde o modal.
     */
    hideInfo() {
        this.setAttribute('hidden', true);
    }
}

customElements.define('tarot-card-info', TarotCardInfo);
