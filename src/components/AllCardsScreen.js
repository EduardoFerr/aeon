import('./TarotCard.js');
import { loadCards } from '../utils/cardsUtil.js';

export class AllCardsScreen extends HTMLElement {
    async connectedCallback() {
        this.innerHTML = `
            <section class="all-cards-screen">
                <div class="card-container" id="all-cards"></div>
                <button onclick="navigateTo('home')">Voltar</button>
            </section>
        `;

        document.querySelector('header>h1').textContent = "Todas as Cartas"
        // Carregar e renderizar as cartas
        await this.renderCards();
    }

    async renderCards() {
        try {
            // Obtém as cartas do utilitário (usando o cache)
            const cards = await loadCards();
            cards.sort((a, b) => a.order - b.order);
            const container = this.querySelector('#all-cards');

            // Renderiza as cartas no container usando TarotCard
            container.innerHTML = cards
                .map(
                    (card) => `
                        <tarot-card data-card='${JSON.stringify(card)}'></tarot-card>
                    `
                )
                .join('');
        } catch (error) {
            console.error('Erro ao carregar as cartas:', error);
        }
    }
}

customElements.define('all-cards-screen', AllCardsScreen);
