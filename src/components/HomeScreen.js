import { navigateTo } from '../utils/navigation.js';
import './CartaDoDia.js';

export class HomeScreen extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <section class="home-screen">
              <div class="hero">
                <div class="intro">
                    <h2>Bem-vindo ao Tarot de Thoth</h2>
                    <p>
                        O <strong>Tarot de Thoth</strong> é uma ferramenta esotérica que une o Hermetismo, a Cabala, a Astrologia e a Alquimia em um sistema de autoconhecimento profundo. Criado por <strong>Aleister Crowley</strong> e ilustrado por <strong>Lady Frieda Harris</strong>, cada carta foi meticulosamente projetada para representar os segredos do universo através de símbolos arquetípicos.
                    </p>
                    <p>
                        O baralho é inspirado no deus egípcio <strong>Thoth</strong>, patrono da sabedoria, escrita e magia, e na figura de <strong>Hermes Trismegisto</strong>, o mestre dos segredos ocultos, cuja filosofia hermética ensina que "o que está acima é como o que está abaixo". Esses princípios são interligados à Cabala e à astrologia, formando uma base sólida para o entendimento espiritual.
                    </p>
                    <div class="btn-row">
                        <button type="button" class="btn btn-primary" data-ir="three-card-game">Tirar Cartas</button>
                        <button type="button" class="btn btn-ghost" data-ir="all-cards">Cartas</button>
                    </div>
                </div>
                <div class="hero-art" aria-hidden="true">
                    <div class="halo"><img src="assets/cards/crowley-00.jpg" alt="" width="274" height="410" decoding="async"></div>
                </div>
              </div>

                <carta-do-dia></carta-do-dia>

                <div class="hermetic-knowledge panel-card">
                    <h3>Como o Hermetismo, a Cabala e a Astrologia se relacionam no Tarot de Thoth?</h3>
                    <p>
                        O <strong>Hermetismo</strong> fornece a base filosófica do tarot através de seus sete princípios universais, como a correspondência (“o que está acima é como o que está abaixo”), o ritmo e a vibração. Esses conceitos guiam a leitura das cartas, mostrando como as energias cósmicas afetam nossa vida.
                    </p>
                    <p>
                        A <strong>Cabala</strong> se manifesta no tarot através da <strong>Árvore da Vida</strong>, uma estrutura de 10 esferas (Sephirot) conectadas por 22 caminhos. Cada um desses caminhos está associado a uma carta dos <strong>Arcanos Maiores</strong>, representando etapas do crescimento espiritual. Assim, quando interpretamos uma carta, estamos lidando com energias específicas da criação divina.
                    </p>
                    <p>
                        Já a <strong>Astrologia</strong> fornece um mapa energético que conecta cada carta a um signo do zodíaco, planeta ou elemento.
                    </p>
                </div>
            </section>
        `;

        document.querySelector('#page-title').textContent = "Aeon Fool";
        this.querySelectorAll('[data-ir]').forEach((botao) => {
            botao.addEventListener('click', () => navigateTo(botao.dataset.ir));
        });
    }
}

customElements.define('home-screen', HomeScreen);
