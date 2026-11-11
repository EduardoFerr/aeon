import { carregarGlossario, linkarTermos } from '../utils/glossario.js';
import { abrirGlossario } from './GlossarioModal.js';
import { abrir, ativarModal } from './Sobreposicao.js';
import { ic } from '../utils/glifos.js';

export class TarotCardInfo extends HTMLElement {
    connectedCallback() {
        // Define o conteúdo inicial vazio
        this.innerHTML = `
            <div class="tarot-card-info" role="dialog" aria-modal="true" aria-labelledby="card-name">
                <div class="info-content" tabindex="-1">
                    <div class="info-head">
                        <h3 id="card-title"></h3>
                        <div class="info-head-actions">
                            <button type="button" class="iconbtn round themebtn" aria-haspopup="dialog" aria-label="Tema" title="Tema"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 100 17c1.3 0 2-.8 2-1.8 0-1.5-1.3-1.7-1.3-3 0-1 .8-1.7 1.8-1.7H17a3.5 3.5 0 003.5-3.5C20.5 6.7 16.7 3.5 12 3.5z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="14.8" cy="7.8" r="1"/></svg></button>
                            <button id="close-info" class="btn btn-ghost"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>Fechar</button>
                        </div>
                    </div>
                    <div class="info-body">
                    <div class="info-art halo"><img id="card-image" src="assets/back.jpg" alt="Carta não revelada" width="274" height="410"></div>
                    <p id="card-name"></p>
                    <div class="card-border">
                        <p>
                            <strong>Descrição</strong><span id="card-description"></span>
                        </p>
                        <p>
                            <strong>Mensagem esotérica</strong><span id="card-message-esoteric"></span>
                        </p>
                    </div>
                    <div class="card-border">
                        <p >
                            <strong id="rotulo-maior">Oitava maior</strong><span id="card-maior"></span>
                        </p>
                        <p >
                            <strong id="rotulo-menor">Oitava menor</strong><span id="card-menor"></span>
                        </p>
                    </div>
                    <div class="card-border non-wrap">
                        <p id="card-numero">
                            <strong>Número</strong><span></span>
                        </p>
                        <p id="card-arcano">
                            <strong>Arcano</strong><span></span>
                        </p>
                        <p id="card-suit">
                            <strong>Naipe</strong><span></span>
                        </p>
                        <p id="card-element">
                            <strong>Elemento</strong><span></span>
                        </p>
                        <p id="card-astrology">
                            <strong>Astrologia</strong><span></span>
                        </p>
                    </div>
                    <section id="card-arvore" class="card-arvore" aria-labelledby="card-arvore-titulo"></section>
                    <div class="card-border">
                        <p><strong>Alquimia interna</strong><span id="card-internal-alchemy"></span></p>
                        <p><strong>Prática mágica</strong><span id="card-magical-practice"></span></p>
                    </div>
                    <div id="card-meditation-reflection"></div>
                    <div id="card-past-present-future"></div>
                    </div>
                </div>
            </div>
        `;

        this.onKeydown = (event) => {
            if (event.key === 'Escape') this.hideInfo();
        };

        // Adiciona o evento de fechar
        this.querySelector('#close-info').addEventListener('click', () => this.hideInfo());
        // Clique no fundo (fora do conteúdo) também fecha
        this.querySelector('.tarot-card-info').addEventListener('click', (event) => {
            if (event.target === event.currentTarget) this.hideInfo();
        });

        // Termos do glossário: clique em qualquer .termo abre o popup com a explicação
        this.querySelector('.info-content').addEventListener('click', (event) => {
            const termo = event.target.closest('.termo');
            if (termo) abrirGlossario(termo.dataset.termo, termo);
        });
        // Carrega o glossário já na abertura da página, para o primeiro clique achar tudo pronto
        carregarGlossario();
    }

    /**
     * Coloca um texto num elemento, transformando a primeira ocorrência de cada
     * termo do glossário em botão. O texto é escapado (nunca vira HTML solto).
     */
    definirTexto(seletor, texto, usados) {
        this.querySelector(seletor).innerHTML = linkarTermos(texto, usados);
    }

    /**
     * Preenche o texto do <span> de uma linha de rótulo. Se não houver valor,
     * esconde a linha inteira (antes ficava "Astrologia:" em branco).
     */
    preencherLinha(seletor, valor) {
        const linha = this.querySelector(seletor);
        linha.hidden = !valor;
        linha.querySelector('span').textContent = valor || '';
    }

    /**
     * Bloco "Na Árvore da Vida". O módulo (SVG + legenda) só é baixado ao abrir um detalhe.
     * A altura fica reservada por CSS (aspect-ratio) para o modal não pular.
     */
    async montarArvore(cardData, usados) {
        const secao = this.querySelector('#card-arvore');
        const marca = (this.arvoreMarca = (this.arvoreMarca || 0) + 1);
        secao.innerHTML = '';
        secao.hidden = false;
        secao.classList.remove('pronta');
        try {
            const [{ blocoArvore }] = await Promise.all([import('../utils/arvore.js'), carregarGlossario()]);
            if (marca !== this.arvoreMarca) return; // outra carta abriu enquanto carregava
            const html = blocoArvore(cardData, (t) => linkarTermos(t, usados));
            if (!html) { secao.hidden = true; return; }
            secao.innerHTML = html.replace('<h4 class="av-titulo">', '<h4 class="av-titulo" id="card-arvore-titulo">');
            secao.classList.add('pronta');
        } catch {
            secao.hidden = true;
        }
    }

    /**
     * Exibe as informações da carta.
     * @param {Object} cardData - Dados da carta a serem exibidos.
     * @param {HTMLElement} [origem] - Elemento que abriu o modal, para devolver o foco ao fechar.
     */
    showInfo(cardData, origem) {
        let not_found = 'Não disponível'
        this.origem = origem || null;

        // Atualiza os elementos do modal com os dados da carta
        this.querySelector('.info-content').dataset.element =  cardData.element
        this.querySelector('#card-image').src = `assets/cards/crowley-${cardData.order}.jpg`;
        this.querySelector('#card-image').alt = cardData.name || not_found;

        this.querySelector('#card-title').textContent = cardData.title || not_found;


        // Cada termo do glossário só vira botão na primeira vez que aparece nesta carta
        const usados = new Set();

        this.querySelector('#card-name').textContent = cardData.name || not_found;
        this.definirTexto('#card-description', cardData.description || not_found, usados);
        this.definirTexto('#card-message-esoteric', cardData.message_esoteric || not_found, usados);

        // Na Corte o "número" 11 a 14 não existe em Thoth (a carta é a patente), então a linha some
        this.preencherLinha('#card-numero', cardData.court_rank ? '' : (cardData.numeral || `${cardData.number}`));
        this.preencherLinha('#card-arcano', cardData.isMajorArcana ? 'Maior' : 'Menor');
        this.preencherLinha('#card-suit', cardData.suit);
        this.preencherLinha('#card-element', cardData.element || not_found);
        this.preencherLinha('#card-astrology', cardData.astrology);

        // As cartas já reescritas usam Luz e Sombra; as demais ainda têm Oitava Maior e Menor
        this.querySelector('#rotulo-maior').textContent = cardData.texto_thoth ? 'Luz' : 'Oitava maior';
        this.querySelector('#rotulo-menor').textContent = cardData.texto_thoth ? 'Sombra' : 'Oitava menor';
        this.definirTexto('#card-maior', cardData.eighth_greater || not_found, usados);
        this.definirTexto('#card-menor', cardData.eighth_lesser || not_found, usados);
        this.definirTexto('#card-internal-alchemy', cardData.internal_alchemy || not_found, usados);
        this.definirTexto('#card-magical-practice', cardData.magical_practice || not_found, usados);

        // Meditação e reflexão
        const meditationContainer = this.querySelector('#card-meditation-reflection');
        meditationContainer.innerHTML = '<strong>Meditação e reflexão</strong>';
        if (cardData.meditation_reflection) {
            const list = document.createElement('ul');
            cardData.meditation_reflection.forEach(item => {
                const listItem = document.createElement('li');
                listItem.innerHTML = linkarTermos(item, usados);
                list.appendChild(listItem);
            });
            meditationContainer.appendChild(list);
        } else {
            meditationContainer.textContent += ' Não disponível.';
        }

        // Leitura em três tempos. As cartas já reescritas (texto_thoth) usam o formato
        // raiz, dilema e tendência; as demais ainda têm passado, presente e futuro.
        const rotulos = cardData.texto_thoth
            ? ['Raiz', 'Dilema', 'Tendência']
            : ['Passado', 'Presente', 'Futuro'];
        const pastPresentFutureContainer = this.querySelector('#card-past-present-future');
        const tempos = ['past', 'present', 'future'];
        pastPresentFutureContainer.innerHTML = tempos
            .map((chave, i) => `
            <p><strong>${rotulos[i]}</strong>${linkarTermos(cardData.past_present_future?.[chave] || 'Não disponível.', usados)}</p>`)
            .join('');

        this.montarArvore(cardData, usados);

        this.removeAttribute('hidden'); // Exibe o modal
        document.addEventListener('keydown', this.onKeydown);
        // foco preso, fundo inert e rolagem do fundo travada enquanto a carta esta aberta
        if (this.modal) this.modal.liberar();
        this.modal = ativarModal(this.querySelector('.tarot-card-info'));

        // Começa lendo do topo e leva o foco para dentro do modal
        // (sem rolar até o botão Fechar, que fica no fim do conteúdo)
        const conteudo = this.querySelector('.info-content');
        this.querySelector('.tarot-card-info').scrollTop = 0;
        conteudo.scrollTop = 0;
        conteudo.focus({ preventScroll: true });
    }

    /**
     * Esconde o modal.
     */
    hideInfo() {
        this.setAttribute('hidden', true);
        document.removeEventListener('keydown', this.onKeydown);
        if (this.modal) this.modal.liberar();
        this.modal = null;
        // Devolve o foco para a carta que abriu o modal
        if (this.origem && this.origem.isConnected) this.origem.focus();
        this.origem = null;
    }
}

customElements.define('tarot-card-info', TarotCardInfo);

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Resumo curto da carta: bottom sheet no celular e dialogo no desktop, com a imagem, a frase e o
 * botao que abre a carta inteira em tela (o <tarot-card-info>). `carta` vem de loadCards().
 * @param {Object} carta  @param {{frase?:string, rotulo?:string, gatilho?:HTMLElement}} [o]
 */
export function abrirResumoCarta(carta, { frase = '', rotulo = '', gatilho } = {}) {
    const texto = frase || carta.description || '';
    const c = abrir({
        tipo: 'sheet',
        titulo: esc(carta.name || carta.title || 'Carta'),
        gatilho,
        corpo: `<div class="sob-carta"><img src="assets/cards/crowley-${esc(carta.order)}.jpg" alt="${esc(carta.name || '')}" width="274" height="410">
            <div>${rotulo ? `<p class="rot">${esc(rotulo)}</p>` : ''}<p>${esc(texto)}</p></div></div>
            <button type="button" class="btn btn-primary" data-foco data-inteira style="margin-top:14px">Abrir a carta inteira ${ic('seta')}</button>`,
    });
    c.corpo.querySelector('[data-inteira]').addEventListener('click', () => {
        c.fechar(false);
        const info = document.querySelector('tarot-card-info');
        if (info && info.showInfo) info.showInfo(carta, gatilho);
    });
    return c;
}
