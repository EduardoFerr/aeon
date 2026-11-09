import { getCardByOrder } from '../utils/cardsUtil.js';

export class TarotCard extends HTMLElement {
    /**
     * Lê os dados da carta. Preferência para data-order (busca no cache de
     * cartas, sem duplicar o JSON no HTML); data-card continua aceito.
     */
    lerDados() {
        if (this.hasAttribute('data-order')) {
            return getCardByOrder(this.getAttribute('data-order'));
        }
        const bruto = this.getAttribute('data-card');
        return bruto ? JSON.parse(bruto) : null;
    }

    /**
     * Função chamada quando o componente é conectado ao DOM.
     */
    connectedCallback() {
        this.cardData = this.lerDados(); // Dados da carta
        const showBack = this.hasAttribute('show-back'); // Mostrar verso
        // A carta só está "virada para baixo" quando nasce com o verso à mostra.
        // Antes isso era sempre true e o primeiro toque numa carta já revelada
        // não fazia nada.
        this.isFlipped = showBack;

        // Define o conteúdo inicial
        const cardInnerContent = this.cardData
        ? `
            <div class="card-inner">
                <div class="card-front">
                    <img src="assets/cards/crowley-${this.cardData.order}.jpg" alt="${this.cardData.name}">
                    <p class="card-element ${this.cardData.element}">${this.cardData.name}</p>
                </div>
                <div class="card-back"></div>
            </div>
        `
        : '';
        this.innerHTML = `
        <div class="tarot-card ${showBack ? 'flipped' : ''} ${this.cardData?.isMajorArcana ? 'arcano-maior' : ''} ${this.cardData?.element || ''}">
            ${cardInnerContent}
        </div>
        `;

        if (!this.cardData) return; // Espaço reservado (sem carta sorteada): sem interação

        // Acessível por teclado e leitor de tela
        this.tabIndex = 0;
        this.setAttribute('role', 'button');
        this.atualizarRotulo();

        this.addEventListener('click', () => this.flipCard());
        this.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault(); // espaço não deve rolar a página
                this.flipCard();
            }
        });
    }

    atualizarRotulo() {
        this.setAttribute(
            'aria-label',
            this.isFlipped
                ? 'Carta virada para baixo. Ative para revelar.'
                : `${this.cardData.name}. Ative para ver os detalhes.`
        );
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
            this.atualizarRotulo();
        } else {
            // Acessa o modal global e passa o cardData
            const infoComponent = document.querySelector('tarot-card-info');
            if (infoComponent) {
                infoComponent.showInfo(this.cardData, this); // Passa o cardData e quem abriu, para devolver o foco
            }
        }
    }
}

customElements.define('tarot-card', TarotCard);
