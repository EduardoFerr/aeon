import { saveToHistory } from '../utils/storage.js';
import { loadCards } from '../utils/cardsUtil.js';

/**
 * Componente para o jogo das 3 cartas de tarot.
 */
export class ThreeCardGameScreen extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <div class="three-card-game">
                <h1>Jogo das 3 Cartas</h1>
                <div class="card-container" id="cards"></div>
                <button id="drawCards">Sortear Cartas</button>
                <button onclick="navigateTo('home')">Voltar</button>
            </div>
        `;

        document.getElementById('drawCards').addEventListener('click', this.drawThreeCards.bind(this));
    }

    /**
     * Função para sortear 3 cartas do JSON e exibi-las.
     */
    async drawThreeCards() {
        try {
            const cards = await loadCards();

            // Embaralha e seleciona 3 cartas
            const shuffled = cards.sort(() => 0.5 - Math.random()).slice(0, 3);
            const container = this.querySelector('#cards');

            // Renderiza as cartas no container usando o TarotCard
            container.innerHTML = shuffled
                .map(
                    (card) => `
                        <tarot-card data-card='${JSON.stringify(card)}' show-back></tarot-card>
                    `
                )
                .join('');

            // Salva a leitura no histórico
            saveToHistory(shuffled);
        } catch (error) {
            console.error('Erro ao carregar as cartas:', error);
        }
    }
}

customElements.define('three-card-game-screen', ThreeCardGameScreen);
