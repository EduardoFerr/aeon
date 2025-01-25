export class TarotCard extends HTMLElement {
    constructor() {
        super();
        this.isFlipped = true; // Controle do estado da carta
    }

    /**
     * Função chamada quando o componente é conectado ao DOM.
     */
    connectedCallback() {
        this.cardData = JSON.parse(this.getAttribute('data-card')); // Dados da carta
        const showBack = this.hasAttribute('show-back'); // Mostrar verso

        // Define o conteúdo inicial
        this.innerHTML = `
            <div class="tarot-card ${showBack ? 'flipped' : ''} ${this.cardData.isMajorArcana? 'arcano-maior': ''} ${this.cardData.element}" >
                <div class="card-inner">
                    <div class="card-front">
                        <img src="assets/cards/crowley-${this.cardData.order}.jpg" alt="${this.cardData.name}">
                    </div>
                    <div class="card-back">
                        <img src="assets/back.jpg" alt="Verso da Carta">
                    </div>
                </div>
            </div>
        `;

        // Adiciona o evento de clique
        this.addEventListener('click', () => this.flipCard());
    }

    /**
     * Função para virar a carta.
     */
    flipCard() {
        const cardElement = this.querySelector('.tarot-card');

        // Se a carta está virada para baixo, realiza o flip
        if (this.isFlipped) {
            this.isFlipped = false;
            cardElement.classList.remove('flipped');
        } else {
            // Acessa o modal global e passa o cardData
            const infoComponent = document.querySelector('tarot-card-info');
            if (infoComponent) {
                infoComponent.showInfo(this.cardData); // Passa o cardData para o modal
            }
        }
    }
}

customElements.define('tarot-card', TarotCard);
