import { navigateTo } from '../utils/navigation.js';
import './CartaDoDia.js';
import { principal } from '../utils/perfil.js';
import { SYNC_ATIVA } from '../utils/contaEstado.js';
import { primeiroDeHoje } from '../utils/biscoitoDia.js';
import { ic } from '../utils/glifos.js';
import { escaparHtml } from '../utils/glossario.js';
if (SYNC_ATIVA) import('./ConviteConta.js');

const icone = (corpo) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${corpo}</svg>`;

const ICONES = {
    tirar: icone('<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M12 9l1.2 2.4 2.6.3-1.9 1.8.5 2.6L12 14.8 9.6 16.1l.5-2.6-1.9-1.8 2.6-.3z"/>'),
    mapa: icone('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5"/>'),
};

const acao = (ir, icon, nome, linha, extra = '') =>
    `<li><button type="button" class="acao-card${extra}" data-ir="${ir}">${icon}<b>${nome}</b><span>${linha}</span></button></li>`;

/**
 * Cartao largo do biscoito. Com biscoito de hoje guardado mostra a frase (vem do estado do aparelho, sem baixar
 * as frases); sem ele, convida a quebrar um.
 */
function cartaoBiscoito() {
    const item = primeiroDeHoje();
    const icone = ic('biscoito', 'ico');
    if (!item) {
        return `<button type="button" class="acao-card largo" data-ir="biscoito" aria-label="Biscoito da sorte. Quebre um e leia o que saiu.">${icone}<span class="largo-texto"><b>Biscoito da sorte</b><span class="largo-linha">Quebre um e leia o que saiu</span></span></button>`;
    }
    const frase = escaparHtml(item.texto);
    return `<button type="button" class="acao-card largo" data-ir="biscoito" aria-label="Seu biscoito de hoje: ${frase}. Abrir.">${icone}<span class="largo-texto"><b>Seu biscoito de hoje</b><span class="largo-linha frase">${frase}</span></span></button>`;
}

export class HomeScreen extends HTMLElement {
    connectedCallback() {
        const temMapa = !!principal(); // o atalho e do mapa principal; so o mapa de outra pessoa nao conta
        this.innerHTML = `
            <section class="home-screen">
                <header class="home-cab">
                    <p class="eyebrow">Aeon Fool · Tarot de Thoth</p>
                    <h1 id="home-titulo" class="home-titulo">Sua carta de hoje</h1>
                </header>

                <carta-do-dia></carta-do-dia>

                ${SYNC_ATIVA ? '<convite-conta></convite-conta>' : ''}

                <nav aria-label="Por onde começar">
                    <ul class="home-acoes">
                        ${acao('tiragens', ICONES.tirar, 'Tirar cartas', 'Cruz, três cartas ou templo', ' destaque')}
                        ${temMapa
                            ? acao('mapa', ICONES.mapa, 'Seu mapa', 'O mapa principal')
                            : acao('novo-mapa', ICONES.mapa, 'Mapa astral', 'Crie o seu')}
                    </ul>
                    ${cartaoBiscoito()}
                </nav>

                <section class="home-sobre" aria-labelledby="sobre-t">
                    <h2 id="sobre-t">O baralho de Thoth</h2>
                    <p>Setenta e oito cartas onde Hermetismo, Cabala, astrologia e alquimia se encontram.</p>
                    <details>
                        <summary>Saiba mais</summary>
                        <div class="home-sobre-texto">
                            <p>O Tarot de Thoth une Hermetismo, Cabala, Astrologia e Alquimia num só caminho de autoconhecimento. Cada carta guarda um símbolo antigo, e é por ele que ela fala com você.</p>
                            <p>O nome vem de Thoth, o deus egípcio da sabedoria, da escrita e da magia, e de Hermes Trismegisto, que ensinava: o que está acima é como o que está abaixo.</p>
                            <p>A Árvore da Vida liga as 22 cartas dos Arcanos Maiores aos 22 caminhos da Cabala, e a Astrologia dá a cada uma um signo, um planeta ou um elemento. O baralho foi desenhado por Aleister Crowley e pintado por Lady Frieda Harris.</p>
                        </div>
                    </details>
                </section>
            </section>
        `;

        // a Home traz o proprio h1; o titulo global fica fora (navigateTo o reexibe nas outras telas)
        const global = document.querySelector('.page-title');
        if (global) global.hidden = true;
        this.querySelectorAll('[data-ir]').forEach((botao) => {
            botao.addEventListener('click', () => {
                const ir = botao.dataset.ir;
                if (ir === 'mapa') {
                    const m = principal();
                    navigateTo('mapa', m ? { id: m.id } : null);
                } else if (ir === 'novo-mapa') navigateTo('novo-mapa', { meusDados: true }); // sem mapa guardado: a tela "Meus dados"
                else navigateTo(ir);
            });
        });
    }
}

customElements.define('home-screen', HomeScreen);
