export class TarotCardInfo extends HTMLElement {
    connectedCallback() {
        // Define o conteúdo inicial vazio
        this.innerHTML = `
            <div class="tarot-card-info">
                <div class="info-content">
                    <h3 id="card-title"></h3>
                    <img id="card-image" src="assets/back.jpg" alt="Carta não revelada">
                    <p id="card-name"></p>
                    <p id="card-description"></p>
                    <div class="card-border">
                        <p>
                            <strong>Descrição Simbólica: </strong><br><spam id="card-symbolic-description"></spam>
                        </p>
                        <p>
                            <strong>Mensagem Esotérica: </strong><br><spam id="card-message-esoteric"></spam>
                        </p>
                    </div>
                    <div class="card-border">
                        <p >
                            <strong>Oitava Maior: </strong><spam id="card-maior"></spam>
                        </p>
                        <p >    
                            <strong>Oitava Menor: </strong><spam id="card-menor"></spam>
                        </p>                    
                    </div>
                    <div class="card-border non-wrap">
                        <p id="card-numero">
                            <strong>Número: </strong><spam></spam>
                        </p>
                        <p id="card-arcano">
                            <strong>Arcano: </strong><spam></spam>
                        </p>
                        <p id="card-suit">
                            <strong>Naipe: </strong><spam></spam>
                        </p>
                        <p id="card-element">
                            <strong>Elemento: </strong><spam></spam>
                        </p>
                        <p id="card-astrology">
                            <strong>Astrologia: </strong><spam></spam>
                        </p>
                    </div>
                    <div class="card-border">
                        <p><strong>Alquimia Interna: </strong><spam id="card-internal-alchemy"></spam></p>
                        <p><strong>Prática Mágica: </strong><spam id="card-magical-practice"></spam></p>
                    </div>
                    <div id="card-meditation-reflection"></div>
                    <div id="card-past-present-future"></div>
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
        let not_found = 'Não disponível'

        // Atualiza os elementos do modal com os dados da carta
        this.querySelector('.info-content').dataset.element =  cardData.element 
        this.querySelector('#card-image').src = `assets/cards/crowley-${cardData.order}.jpg` || backImage;
        this.querySelector('#card-image').alt = cardData.name || not_found;

        this.querySelector('#card-title').textContent = cardData.title || not_found;


        this.querySelector('#card-name').textContent = cardData.name || not_found;
        this.querySelector('#card-description').textContent = cardData.description || not_found;
        this.querySelector('#card-symbolic-description').textContent = cardData.description_symbolic || not_found;
        this.querySelector('#card-message-esoteric').textContent = cardData.message_esoteric || not_found;
        
        this.querySelector('#card-numero').lastChild.textContent = `${cardData.number}` || not_found;;
        this.querySelector('#card-arcano').lastChild.textContent = cardData.isMajorArcana ? 'Maior' : 'Menor';
        this.querySelector('#card-suit').setAttribute('hidden', false)
        this.querySelector('#card-suit').lastChild.textContent = cardData.suit ? cardData.suit : this.querySelector('#card-suit').setAttribute('hidden', true);
        this.querySelector('#card-element').lastChild.textContent = cardData.element ? cardData.element :not_found;
        this.querySelector('#card-astrology').lastChild.textContent = cardData.astrology ? cardData.astrology :'' ;
        
        this.querySelector('#card-maior').textContent = cardData.eighth_greater || not_found;
        this.querySelector('#card-menor').textContent = cardData.eighth_lesser || not_found;
        this.querySelector('#card-internal-alchemy').textContent = cardData.internal_alchemy || not_found;
        this.querySelector('#card-magical-practice').textContent = cardData.magical_practice || not_found;

        // Meditação e reflexão
        const meditationContainer = this.querySelector('#card-meditation-reflection');
        meditationContainer.innerHTML = '<strong>Meditação e Reflexão:</strong>';
        if (cardData.meditation_reflection) {
            const list = document.createElement('ul');
            cardData.meditation_reflection.forEach(item => {
                const listItem = document.createElement('li');
                listItem.textContent = item;
                list.appendChild(listItem);
            });
            meditationContainer.appendChild(list);
        } else {
            meditationContainer.textContent += ' Não disponível.';
        }

        // Passado, presente e futuro
        const pastPresentFutureContainer = this.querySelector('#card-past-present-future');
        pastPresentFutureContainer.innerHTML = `
            <p><strong>Passado:</strong> <br> ${cardData.past_present_future?.past || 'Não disponível.'}</p>
            <p><strong>Presente:</strong> <br> ${cardData.past_present_future?.present || 'Não disponível.'}</p>
            <p><strong>Futuro:</strong> <br> ${cardData.past_present_future?.future || 'Não disponível.'}</p>
        `;

        this.removeAttribute('hidden'); // Exibe o modal
    }

    /**
     * Esconde o modal.
     */
    hideInfo() {
        this.setAttribute('hidden', true);
    }
}

customElements.define('tarot-card-info', TarotCardInfo);
