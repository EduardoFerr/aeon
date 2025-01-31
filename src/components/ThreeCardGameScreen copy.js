import { saveToHistory } from '../utils/storage.js';
import { loadCards } from '../utils/cardsUtil.js';

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

                <button class="nav-button" id="drawCards">
                    <svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 150 40" class="icon">
                        <!-- Primeira carta -->
                        <rect x="5" y="5" width="20" height="30" rx="2" ry="2" fill="#4A2C6F" stroke="#ffffff" stroke-width="1.5" />
                        <text x="12" y="25" font-size="7" fill="#ffffff" font-family="Arial">A</text>

                        <!-- Segunda carta ligeiramente deslocada -->
                        <rect x="15" y="10" width="20" height="30" rx="2" ry="2" fill="#6A3595" stroke="#ffffff" stroke-width="1.5" />
                        <text x="22" y="30" font-size="7" fill="#ffffff" font-family="Arial">K</text>

                        <!-- Terceira carta ligeiramente deslocada -->
                        <rect x="25" y="15" width="20" height="30" rx="2" ry="2" fill="#8E44AD" stroke="#ffffff" stroke-width="1.5" />
                        <text x="32" y="35" font-size="7" fill="#ffffff" font-family="Arial">Q</text>

                        <!-- Texto "Tirar Cartas" ao lado das cartas -->
                        <text x="55" y="25" font-size="12" fill="#ffffff" font-family="Arial" font-weight="bold">
                        Tirar Cartas
                        </text>
                    </svg>
                </button>

                <button onclick="navigateTo('home')">Voltar</button>
            </section>
        `;
        document.querySelector('header>h1').textContent = "Jogo das 3 Cartas"
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
            // Rótulos das posições
            const labels = ['Passado', 'Presente', 'Futuro'];
            // Renderiza as cartas no container usando o TarotCard
            container.innerHTML = shuffled
                .map(
                    (card, index) => `
                    <div  class="card-three">
                        <h3>${labels[index]}</h3>
                        <tarot-card data-card='${JSON.stringify(card)}' show-back></tarot-card>
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
