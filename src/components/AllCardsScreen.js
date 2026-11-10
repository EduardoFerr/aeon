import('./TarotCard.js');
import('./TarotCardInfo.js');

import { loadCards } from '../utils/cardsUtil.js';

export class AllCardsScreen extends HTMLElement {
    async connectedCallback() {
        this.innerHTML = `
            <section class="all-cards-screen">
                <div class="card-container" id="all-cards"></div>
                <div class="screen-actions"><button class="btn btn-ghost" onclick="navigateTo('home')">Voltar</button></div>
            </section>
        `;

        document.querySelector('#page-title').textContent = "Tarot de Thoth"
        // Carregar e renderizar as cartas
        await this.renderCards()
    }

    async renderCards() {
        try {
            // Obtém as cartas do utilitário (usando o cache)
            const cards = [...(await loadCards())].sort((a, b) => a.order - b.order); // cópia: não reordena o cache
            const container = this.querySelector('#all-cards');

            // Renderiza as cartas no container usando TarotCard (só o número de ordem vai no HTML)
            container.innerHTML = cards
                .map(
                    (card) => `
                        <tarot-card data-order="${Number(card.order)}"></tarot-card>
                    `
                )
                .join('');
        } catch (error) {
            console.error('Erro ao carregar as cartas:', error);
        }
    }
}

customElements.define('all-cards-screen', AllCardsScreen);
