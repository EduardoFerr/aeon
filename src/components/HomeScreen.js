import { navigateTo } from '../utils/navigation.js';

export class HomeScreen extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <section class="home-screen">
                <div class="intro">
                    <h2>Bem-vindo ao Tarot de Thoth</h2>
                    <p>
                        O <strong>Tarot de Thoth</strong> é uma ferramenta esotérica que une o Hermetismo, a Cabala, a Astrologia e a Alquimia em um sistema de autoconhecimento profundo. Criado por <strong>Aleister Crowley</strong> e ilustrado por <strong>Lady Frieda Harris</strong>, cada carta foi meticulosamente projetada para representar os segredos do universo através de símbolos arquetípicos.
                    </p>
                    <p>
                        O baralho é inspirado no deus egípcio <strong>Thoth</strong>, patrono da sabedoria, escrita e magia, e na figura de <strong>Hermes Trismegisto</strong>, o mestre dos segredos ocultos, cuja filosofia hermética ensina que "o que está acima é como o que está abaixo". Esses princípios são interligados à Cabala e à astrologia, formando uma base sólida para o entendimento espiritual.
                    </p>
                </div>

                <div class="hermetic-knowledge">
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

        document.querySelector('header>h1').textContent = "Tarot de Thoth";
        document.getElementById('home').hidden = true
    }
}

customElements.define('home-screen', HomeScreen);
