import { criarLeitura, pedirFoco } from '../utils/diario.js';
import { navigateTo } from '../utils/navigation.js';
import { loadCards, shuffle } from '../utils/cardsUtil.js';
import('./TarotCardInfo.js');

const POSICOES = ['passado', 'presente', 'futuro'];

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

                <p class="sr" role="status" aria-live="polite" data-anuncio></p>
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
        this.querySelector('#cards').addEventListener('carta-virada', () => this.aoVirar());
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

            // Registra a leitura no diario (v2). O historico antigo deixou de ser gravado: o diario o le e converte,
            // e gravar nos dois faria cada leitura nova aparecer duas vezes.
            const registro = criarLeitura(shuffled.map((card, index) => ({ order: Number(card.order), pos: POSICOES[index] })));
            this.entradaId = registro.id;
            this.reveladas = 0;
            this.querySelector('#escrever-diario')?.remove();
        } catch (error) {
            console.error('Erro ao carregar as cartas:', error);
        }
    }

    /** Conta as cartas viradas; ao revelar as 3, oferece abrir a nota daquela leitura no diario. */
    aoVirar() {
        this.reveladas = (this.reveladas || 0) + 1;
        if (this.reveladas < 3 || !this.entradaId || this.querySelector('#escrever-diario')) return;
        const id = this.entradaId;
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.id = 'escrever-diario';
        botao.className = 'btn btn-primary';
        botao.textContent = 'Escrever no diário';
        botao.addEventListener('click', () => {
            pedirFoco(id);
            navigateTo('history');
        });
        this.querySelector('.game-actions').prepend(botao);
        const aviso = this.querySelector('[data-anuncio]');
        if (aviso) aviso.textContent = 'As três cartas foram reveladas. Você pode escrever no diário.';
    }
}

customElements.define('three-card-game-screen', ThreeCardGameScreen);
