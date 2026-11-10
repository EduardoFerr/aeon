import { saveToHistory } from '../utils/storage.js';
import { loadCards, shuffle } from '../utils/cardsUtil.js';
import('./TarotCardInfo.js');

/**
 * Componente para o jogo das 3 cartas de tarot.
 */
export class ThreeCardGameScreen extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <section class="three-card-game">

                <div class="card-container" id="cards">
                    <div class="card-three">
                        <h3>Passado</h3>
                        <tarot-card  show-back="">
                            <div class="tarot-card flipped arcano-maior">
                            
                            </div>
                        </tarot-card>
                    </div>
                    <div class="card-three">
                        <h3>Presente</h3>
                        <tarot-card  show-back="">
                            <div class="tarot-card flipped arcano-maior">
                            
                            </div>
                        </tarot-card>
                    </div>
                    <div class="card-three">
                        <h3>Futuro</h3>
                        <tarot-card  show-back="">
                            <div class="tarot-card flipped arcano-maior">
                            
                            </div>
                        </tarot-card>
                    </div>
                </div>

                <div class="game-actions">
                    <button class="btn btn-primary" id="drawCards">
                        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="9" height="13" rx="1.5"/><rect x="7.5" y="4" width="9" height="13" rx="1.5"/><rect x="11.5" y="6" width="9" height="13" rx="1.5"/></svg>
                        <span>Tirar Cartas</span>
                    </button>
                    <button class="btn btn-ghost" onclick="navigateTo('home')">Voltar</button>
                </div>
            </section>
        `;
        document.querySelector('#page-title').textContent = "Jogo das 3 Cartas"
        document.getElementById('drawCards').addEventListener('click', this.drawThreeCards.bind(this));
    }

    /**
     * Função para sortear 3 cartas do JSON e exibi-las.
     */
    async drawThreeCards() {
        try {
            const cards = await loadCards();

            // Embaralha (sem viés e sem alterar o cache) e seleciona 3 cartas
            const shuffled = shuffle(cards).slice(0, 3);
            const container = this.querySelector('#cards');
            // Rótulos das posições
            const labels = ['Passado', 'Presente', 'Futuro'];
            // Renderiza as cartas no container usando o TarotCard
            container.innerHTML = shuffled
                .map(
                    (card, index) => `
                    <div  class="card-three">
                        <h3>${labels[index]}</h3>
                        <tarot-card data-order="${Number(card.order)}" show-back></tarot-card>
                    </div>
                    `
                )
                .join('');

            // Salva a leitura no histórico
            saveToHistory({
                passado: shuffled[0],
                presente: shuffled[1],
                futuro: shuffled[2],
            });
        } catch (error) {
            console.error('Erro ao carregar as cartas:', error);
        }
    }
}

customElements.define('three-card-game-screen', ThreeCardGameScreen);
