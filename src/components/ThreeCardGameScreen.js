import { criarLeitura, atualizarLeitura, limparPergunta, pedirFoco, LIMITE_PERGUNTA } from '../utils/diario.js';
import { navigateTo } from '../utils/navigation.js';
import { loadCards, shuffle } from '../utils/cardsUtil.js';
import { escaparHtml } from '../utils/glossario.js';
import { dataLocal } from '../utils/cartaDoDia.js';
import { ic } from '../utils/glifos.js';
import { abrir, ehDesktop } from './Sobreposicao.js';
import('./TarotCardInfo.js');

const POSICOES = ['passado', 'presente', 'futuro'];
const ROTULOS = ['Passado', 'Presente', 'Futuro'];
const FASES = ['pergunta', 'embaralhar', 'escolher', 'revelar'];
const DURACAO_EMBARALHAR = 1300; // ms
const ESCALONAMENTO = 500; // ms entre uma carta e outra em "Revelar todas"
// Cada posicao le um tempo da carta: raiz (passado), dilema (presente) e tendencia (futuro)
const CAMPOS = ['past', 'present', 'future'];
const TEMPOS = ['Raiz', 'Dilema', 'Tendência'];

const TEXTO = {
    titulo: 'Leitura de 3 cartas',
    passos: 'Passos da leitura',
    passoPergunta: 'Pergunta',
    passoEmbaralhar: 'Embaralhar',
    passoEscolher: 'Escolher',
    passoRevelar: 'Revelar',
    convite: 'Faça a sua pergunta, ou apenas embaralhe',
    rotuloPergunta: 'Sua pergunta (opcional)',
    dicaPergunta: 'Pode ficar em branco. A pergunta fica guardada com a leitura, no seu diário.',
    placeholderPergunta: 'Escreva aqui, se quiser',
    embaralhar: 'Embaralhar',
    embaralhando: 'Embaralhando as cartas.',
    escolha: 'Escolha três cartas',
    escolhaDica: 'A primeira vai para o Passado, a segunda para o Presente e a terceira para o Futuro.',
    leque: 'Cartas de costas. Escolha três, na ordem.',
    escolhidas: (n) => `${n} de 3 escolhidas`,
    refazer: 'Refazer a escolha',
    ver: 'Ver as cartas',
    escolhidaComo: (pos) => `Escolhida como ${pos}.`,
    carta: (i, n) => `Carta ${i} de ${n}`,
    tresEscolhidas: 'As três cartas foram escolhidas. Use “Ver as cartas” para revelá-las.',
    reveladasTitulo: 'Suas três cartas',
    toqueParaRevelar: 'Toque na carta para revelar',
    revelarTodas: 'Revelar todas',
    novaLeitura: 'Nova leitura',
    luz: 'Luz.',
    abrir: 'Abrir a carta',
    escreverDiario: 'Escrever no diário',
    compartilhar: 'Compartilhar',
    compartilharLeitura: 'Compartilhar a leitura',
    acoes: 'Ações',
    acoesTitulo: 'Ações da leitura',
    cartaoFalhou: 'Não foi possível montar o cartão agora.',
    revelada: (pos, carta) => `${pos} revelado: ${carta.name}, ${carta.title}.`,
    todasReveladas: 'As três cartas foram reveladas. Você pode escrever no diário, compartilhar ou fazer uma nova leitura.',
    erro: 'Não foi possível tirar as cartas agora. Recarregue a página.',
    voltar: 'Voltar',
};

const reduzMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Leitura ritual de 3 cartas, em quatro momentos: pergunta (opcional), embaralhar, escolher no leque
 * e revelar. O sorteio e o estado ficam em memoria: recarregar a pagina recomeca a leitura, e a
 * entrada do diario ja gravada fica.
 */
export class ThreeCardGameScreen extends HTMLElement {
    connectedCallback() {
        this.fase = 'pergunta';
        this.pergunta = '';
        this.baralho = [];
        this.escolhas = []; // indices do baralho tocados, na ordem
        this.entradaId = null;
        this.timers = new Set();

        this.innerHTML = `
            <section class="three-card-game leitura" aria-label="${TEXTO.titulo}">
                <ol class="leitura-passos" aria-label="${TEXTO.passos}">
                    ${[TEXTO.passoPergunta, TEXTO.passoEmbaralhar, TEXTO.passoEscolher, TEXTO.passoRevelar]
                        .map((t, i) => `<li data-passo="${FASES[i]}"><span class="leitura-passo-n" aria-hidden="true">${i + 1}</span><span class="leitura-passo-t">${t}</span></li>`)
                        .join('')}
                </ol>
                <p class="sr" role="status" aria-live="polite" data-anuncio></p>
                <div class="leitura-palco" data-palco></div>
                <div class="screen-actions"><button type="button" class="btn btn-ghost" data-ir="home">${TEXTO.voltar}</button></div>
            </section>
        `;
        document.querySelector('#page-title').textContent = TEXTO.titulo;
        this.querySelector('[data-ir]').addEventListener('click', () => navigateTo('home'));
        this.palco = this.querySelector('[data-palco]');
        this.irPara('pergunta', { foco: false });
    }

    disconnectedCallback() {
        this.timers.forEach((t) => clearTimeout(t));
        this.timers.clear();
        if (this.sobre && this.sobre.aberto) this.sobre.fechar(false);
    }

    espera(fn, ms) {
        const t = setTimeout(() => {
            this.timers.delete(t);
            fn();
        }, ms);
        this.timers.add(t);
    }

    anunciar(texto) {
        const aviso = this.querySelector('[data-anuncio]');
        if (aviso) aviso.textContent = texto;
    }

    /** Troca de momento: marca o passo, desenha o palco e leva o foco. */
    irPara(fase, { foco = true } = {}) {
        this.fase = fase;
        const pos = FASES.indexOf(fase);
        this.querySelectorAll('.leitura-passos li').forEach((li, i) => {
            li.classList.toggle('feito', i < pos);
            if (i === pos) li.setAttribute('aria-current', 'step');
            else li.removeAttribute('aria-current');
        });
        this.palco.dataset.fase = fase;
        if (fase === 'pergunta') this.desenharPergunta(foco);
        else if (fase === 'embaralhar') this.desenharEmbaralhar();
        else if (fase === 'escolher') this.desenharEscolha();
        else this.desenharRevelar();
    }

    /* ---------- (a) pergunta ---------- */

    desenharPergunta(foco) {
        this.palco.innerHTML = `
            <div class="leitura-bloco panel-card">
                <h2 class="leitura-titulo" tabindex="-1">${TEXTO.convite}</h2>
                <div class="leitura-campo">
                    <label for="leitura-pergunta">${TEXTO.rotuloPergunta}</label>
                    <textarea id="leitura-pergunta" rows="3" maxlength="${LIMITE_PERGUNTA}" placeholder="${TEXTO.placeholderPergunta}" aria-describedby="leitura-pergunta-dica" enterkeyhint="done"></textarea>
                    <div class="leitura-campo-pe">
                        <p id="leitura-pergunta-dica" class="leitura-dica">${TEXTO.dicaPergunta}</p>
                        <p class="leitura-contador" aria-hidden="true" data-contador>0/${LIMITE_PERGUNTA}</p>
                    </div>
                </div>
                <div class="leitura-acoes">
                    <button type="button" class="btn btn-primary" data-acao="embaralhar">
                        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="9" height="13" rx="1.5"/><rect x="7.5" y="4" width="9" height="13" rx="1.5"/><rect x="11.5" y="6" width="9" height="13" rx="1.5"/></svg>
                        <span>${TEXTO.embaralhar}</span>
                    </button>
                </div>
            </div>`;
        const campo = this.palco.querySelector('textarea');
        const contador = this.palco.querySelector('[data-contador]');
        campo.addEventListener('input', () => {
            if (campo.value.length > LIMITE_PERGUNTA) campo.value = campo.value.slice(0, LIMITE_PERGUNTA); // colar texto longo
            contador.textContent = `${campo.value.length}/${LIMITE_PERGUNTA}`;
        });
        campo.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.embaralhar();
            }
        });
        this.palco.querySelector('[data-acao="embaralhar"]').addEventListener('click', () => this.embaralhar());
        this.anunciar(foco ? `${TEXTO.convite}.` : '');
        if (foco) campo.focus();
    }

    /* ---------- (b) embaralhar ---------- */

    async embaralhar() {
        const campo = this.palco.querySelector('textarea');
        this.pergunta = campo ? limparPergunta(campo.value) : '';
        let cartas;
        try {
            cartas = await loadCards();
        } catch (e) {
            this.anunciar(TEXTO.erro);
            return;
        }
        if (!this.isConnected || this.fase !== 'pergunta') return;
        // Sorteio real: as 78 cartas, Fisher-Yates com crypto. A animacao e so encenacao.
        this.baralho = shuffle(cartas);
        this.escolhas = [];
        this.entradaId = null;

        if (reduzMovimento()) {
            this.irPara('escolher');
            return;
        }
        this.irPara('embaralhar');
    }

    desenharEmbaralhar() {
        const cartas = Array.from({ length: 8 }, (_, i) => `<span class="leitura-verso leitura-folha" data-k="${i}"></span>`).join('');
        this.palco.innerHTML = `
            <div class="leitura-bloco leitura-mesa">
                <h2 class="leitura-titulo" tabindex="-1">${TEXTO.passoEmbaralhar}</h2>
                <div class="leitura-baralho" aria-hidden="true">${cartas}</div>
            </div>`;
        this.palco.querySelector('.leitura-titulo').focus({ preventScroll: true });
        this.anunciar(TEXTO.embaralhando);
        this.animarRiffle();
        this.espera(() => this.irPara('escolher'), DURACAO_EMBARALHAR);
    }

    /**
     * Corte e riffle simplificados: o baralho se parte em duas pilhas, que se afastam, e as cartas caem
     * uma de cada lado, intercaladas, de volta ao centro.
     */
    animarRiffle() {
        const folhas = [...this.palco.querySelectorAll('.leitura-folha')];
        if (!folhas.length || !folhas[0].animate) return;
        const meio = folhas.length / 2;
        folhas.forEach((el, i) => {
            const esq = i < meio;
            const pos = esq ? i : i - meio; // posicao dentro da pilha
            const k = pos * 2 + (esq ? 0 : 1); // ordem de queda, intercalada
            const x = esq ? -64 : 64;
            const r = esq ? -7 : 7;
            const parte = `translate(${x}px, ${-pos * 1.5}px) rotate(${r}deg)`;
            const t0 = 0.3 + k * 0.07;
            const t1 = Math.min(0.97, t0 + 0.16);
            el.animate(
                [
                    { transform: `translate(0, ${-i * 1.5}px) rotate(0deg)`, offset: 0 },
                    { transform: parte, offset: 0.3, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
                    { transform: parte, offset: t0 },
                    { transform: `translate(${esq ? -6 : 6}px, ${-k * 1.5 - 22}px) rotate(${esq ? -3 : 3}deg)`, offset: (t0 + t1) / 2 },
                    { transform: `translate(0, ${-k * 1.5}px) rotate(0deg)`, offset: t1 },
                    { transform: `translate(0, ${-k * 1.5}px) rotate(0deg)`, offset: 1 },
                ],
                { duration: DURACAO_EMBARALHAR, fill: 'forwards' }
            );
        });
    }

    /* ---------- (c) escolher no leque ---------- */

    desenharEscolha() {
        const n = matchMedia('(min-width: 900px)').matches ? 12 : 9;
        this.nLeque = n;
        const botoes = Array.from({ length: n }, (_, i) => {
            const d = i - (n - 1) / 2;
            return `<button type="button" class="leitura-carta" data-i="${i}" tabindex="${i === 0 ? 0 : -1}" style="--i:${i};--d:${d}" aria-label="${TEXTO.carta(i + 1, n)}">
                <span class="leitura-verso"></span><span class="leitura-selo" aria-hidden="true"></span>
            </button>`;
        }).join('');
        this.palco.innerHTML = `
            <div class="leitura-bloco leitura-escolha">
                <h2 class="leitura-titulo" tabindex="-1">${TEXTO.escolha}</h2>
                <p class="leitura-dica">${TEXTO.escolhaDica}</p>
                <div class="leitura-leque" role="group" aria-label="${TEXTO.leque}" data-leque>${botoes}</div>
                <p class="leitura-escolhidas" data-escolhidas>${TEXTO.escolhidas(0)}</p>
                <div class="leitura-acoes">
                    <button type="button" class="btn btn-ghost" data-acao="refazer" disabled>${TEXTO.refazer}</button>
                    <button type="button" class="btn btn-primary" data-acao="ver" disabled>${TEXTO.ver}</button>
                </div>
            </div>`;
        const leque = this.palco.querySelector('[data-leque]');
        leque.addEventListener('click', (e) => {
            const b = e.target.closest('.leitura-carta');
            if (b) this.escolher(Number(b.dataset.i));
        });
        leque.addEventListener('keydown', (e) => this.teclaNoLeque(e));
        this.palco.querySelector('[data-acao="refazer"]').addEventListener('click', () => this.refazer());
        this.palco.querySelector('[data-acao="ver"]').addEventListener('click', () => this.irPara('revelar'));
        this.anunciar(`${TEXTO.escolha}. ${TEXTO.escolhidas(0)}.`);
        this.palco.querySelector('.leitura-carta').focus({ preventScroll: true });
    }

    /** Setas, Home e End movem o foco entre as cartas (um so ponto de Tab); Enter e Espaco escolhem (botao nativo). */
    teclaNoLeque(e) {
        const cartas = [...this.palco.querySelectorAll('.leitura-carta')];
        const atual = cartas.indexOf(document.activeElement);
        if (atual < 0) return;
        const colunas = parseInt(getComputedStyle(this.palco.querySelector('[data-leque]')).getPropertyValue('--colunas'), 10) || 1;
        const passo = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: colunas, ArrowUp: -colunas }[e.key];
        let alvo = null;
        if (passo !== undefined) alvo = atual + passo;
        else if (e.key === 'Home') alvo = 0;
        else if (e.key === 'End') alvo = cartas.length - 1;
        if (alvo === null) return;
        e.preventDefault();
        if (alvo < 0 || alvo >= cartas.length) return;
        cartas.forEach((b, i) => (b.tabIndex = i === alvo ? 0 : -1));
        cartas[alvo].focus();
    }

    escolher(i) {
        if (this.escolhas.includes(i) || this.escolhas.length >= 3) return;
        this.escolhas.push(i);
        const k = this.escolhas.length - 1;
        const botao = this.palco.querySelector(`.leitura-carta[data-i="${i}"]`);
        botao.classList.add('escolhida');
        botao.setAttribute('aria-disabled', 'true');
        botao.setAttribute('aria-label', `${TEXTO.carta(i + 1, this.nLeque)}. ${TEXTO.escolhidaComo(ROTULOS[k])}`);
        botao.querySelector('.leitura-selo').textContent = ROTULOS[k];
        this.atualizarEscolha();
        if (this.escolhas.length < 3) {
            this.anunciar(`${ROTULOS[k]} escolhido. ${TEXTO.escolhidas(this.escolhas.length)}.`);
            return;
        }
        this.gravar();
        this.anunciar(TEXTO.tresEscolhidas);
        const ver = this.palco.querySelector('[data-acao="ver"]');
        ver.disabled = false;
        ver.focus();
    }

    atualizarEscolha() {
        this.palco.querySelector('[data-escolhidas]').textContent = TEXTO.escolhidas(this.escolhas.length);
        this.palco.querySelector('[data-acao="refazer"]').disabled = this.escolhas.length === 0;
        this.palco.querySelector('[data-acao="ver"]').disabled = this.escolhas.length < 3;
    }

    refazer() {
        this.escolhas = [];
        this.palco.querySelectorAll('.leitura-carta').forEach((b, i) => {
            b.classList.remove('escolhida');
            b.removeAttribute('aria-disabled');
            b.setAttribute('aria-label', TEXTO.carta(i + 1, this.nLeque));
            b.querySelector('.leitura-selo').textContent = '';
        });
        this.atualizarEscolha();
        this.anunciar(`${TEXTO.refazer}. ${TEXTO.escolhidas(0)}.`);
        const cartas = [...this.palco.querySelectorAll('.leitura-carta')];
        cartas.forEach((b, i) => (b.tabIndex = i === 0 ? 0 : -1));
        cartas[0].focus();
    }

    /** As cartas escolhidas, na ordem: cada indice tocado aponta para o baralho ja embaralhado. */
    get cartasEscolhidas() {
        return this.escolhas.map((i) => this.baralho[i]);
    }

    /**
     * Grava a leitura no diario quando as 3 cartas sao escolhidas. Se a pessoa refizer a escolha,
     * a mesma entrada e atualizada (sem duplicar).
     */
    gravar() {
        const lista = this.cartasEscolhidas.map((c, k) => ({ order: Number(c.order), pos: POSICOES[k] }));
        const r = this.entradaId ? atualizarLeitura(this.entradaId, lista, this.pergunta) : criarLeitura(lista, this.pergunta);
        this.entradaId = r.id;
    }

    /* ---------- (d) revelar e interpretar ---------- */

    desenharRevelar() {
        const slots = this.cartasEscolhidas
            .map(
                (c, k) => `
                <li class="leitura-slot" data-slot="${k}">
                    <h3 class="leitura-pos">${ROTULOS[k]}</h3>
                    <div class="leitura-slot-carta">
                        <tarot-card data-order="${Number(c.order)}" show-back rotulo-verso="${ROTULOS[k]}, carta virada para baixo. Ative para revelar."></tarot-card>
                    </div>
                    <div class="leitura-interp" data-interp><p class="leitura-espera">${TEXTO.toqueParaRevelar}</p></div>
                </li>`
            )
            .join('');
        this.palco.innerHTML = `
            <div class="leitura-bloco leitura-revela">
                <h2 class="leitura-titulo" tabindex="-1">${TEXTO.reveladasTitulo}</h2>
                ${this.pergunta ? `<p class="leitura-eco"><q>${escaparHtml(this.pergunta)}</q></p>` : ''}
                <ol class="leitura-cartas">${slots}</ol>
                <div class="leitura-acoes" data-acoes>
                    <button type="button" class="btn btn-primary" data-acao="revelar-todas">${TEXTO.revelarTodas}</button>
                    <button type="button" class="btn btn-ghost" data-acao="nova">${TEXTO.novaLeitura}</button>
                </div>
            </div>`;
        this.reveladas = 0;
        this.palco.querySelector('[data-acao="nova"]').addEventListener('click', () => this.novaLeitura());
        this.palco.querySelector('[data-acao="revelar-todas"]').addEventListener('click', () => this.revelarTodas());
        const lista = this.palco.querySelector('.leitura-cartas');
        lista.addEventListener('carta-virada', (e) => this.aoVirar(e));
        lista.addEventListener('click', (e) => {
            const abrir = e.target.closest('[data-abrir]');
            if (!abrir) return;
            const info = document.querySelector('tarot-card-info');
            if (info && info.showInfo) info.showInfo(this.cartasEscolhidas[Number(abrir.dataset.abrir)], abrir);
        });
        this.anunciar(`${TEXTO.reveladasTitulo}. ${TEXTO.toqueParaRevelar}.`);
        this.palco.querySelector('tarot-card')?.focus({ preventScroll: true });
    }

    /** Uma carta virou: mostra a leitura daquela posicao (raiz, dilema ou tendencia) e a Luz da carta. */
    aoVirar(e) {
        const slot = e.target.closest('[data-slot]');
        if (!slot) return;
        const k = Number(slot.dataset.slot);
        const carta = this.cartasEscolhidas[k];
        const interp = slot.querySelector('[data-interp]');
        if (!carta || interp.dataset.aberta) return;
        const texto = (carta.past_present_future && carta.past_present_future[CAMPOS[k]]) || carta.message_esoteric || '';
        interp.dataset.aberta = 'true';
        interp.innerHTML = `
            <p class="leitura-rotulo">${TEMPOS[k]}</p>
            <p class="leitura-texto">${escaparHtml(texto)}</p>
            ${carta.eighth_greater ? `<p class="leitura-luz"><strong>${TEXTO.luz}</strong> ${escaparHtml(carta.eighth_greater)}</p>` : ''}
            <button type="button" class="btn btn-ghost" data-abrir="${k}">${TEXTO.abrir}</button>`;
        this.reveladas += 1;
        if (this.reveladas < 3) {
            this.anunciar(TEXTO.revelada(ROTULOS[k], carta));
            return;
        }
        this.anunciar(`${TEXTO.revelada(ROTULOS[k], carta)} ${TEXTO.todasReveladas}`);
        this.mostrarFinal();
    }

    /** Vira as que faltam, uma a uma, com 500 ms entre elas (sem pausa com movimento reduzido). */
    revelarTodas() {
        const botao = this.palco.querySelector('[data-acao="revelar-todas"]');
        if (botao) botao.disabled = true;
        const reduz = reduzMovimento();
        const faltam = [...this.palco.querySelectorAll('tarot-card')].filter((c) => c.isFlipped);
        faltam.forEach((carta, n) => this.espera(() => carta.isFlipped && carta.flipCard(), reduz ? 0 : n * ESCALONAMENTO));
    }

    /** Depois das tres reveladas: escrever no diario e nova leitura. */
    mostrarFinal() {
        const acoes = this.palco.querySelector('[data-acoes]');
        const tinhaFoco = acoes.contains(document.activeElement);
        // uma acao principal visivel; compartilhar e nova leitura ficam no menu Acoes (Nova leitura repete "Leitura" da barra)
        acoes.innerHTML = `
            <button type="button" class="btn btn-primary" data-acao="diario">${TEXTO.escreverDiario}</button>
            <button type="button" class="iconbtn" data-acao="acoes" aria-haspopup="dialog" aria-expanded="false">${ic('maisv')}${TEXTO.acoes}</button>`;
        acoes.querySelector('[data-acao="diario"]').addEventListener('click', () => {
            if (this.entradaId) pedirFoco(this.entradaId);
            navigateTo('history');
        });
        const botao = acoes.querySelector('[data-acao="acoes"]');
        botao.addEventListener('click', () => this.abrirAcoes(botao));
        if (tinhaFoco) acoes.querySelector('[data-acao="diario"]').focus();
    }

    abrirAcoes(botao) {
        botao.setAttribute('aria-expanded', 'true');
        const item = (id, rot, i) => `<button class="sob-acao" type="button" data-exec="${id}">${ic(i)}${rot}</button>`;
        const c = abrir({
            tipo: ehDesktop() ? 'popover' : 'gaveta', titulo: TEXTO.acoesTitulo, gatilho: botao,
            corpo: `<nav aria-label="${TEXTO.acoesTitulo}">${item('compartilhar', TEXTO.compartilharLeitura, 'compartilhar')}${item('nova', TEXTO.novaLeitura, 'leitura')}</nav>`,
            aoFechar: () => botao.setAttribute('aria-expanded', 'false'),
        });
        c.corpo.addEventListener('click', (e) => {
            const b = e.target.closest('[data-exec]');
            if (!b) return;
            if (b.dataset.exec === 'nova') {
                c.fechar(false);
                this.novaLeitura();
            } else {
                c.fechar();
                this.compartilhar();
            }
        });
        this.sobre = c;
    }

    /** Cartao da leitura (Canvas), carregado so quando a pessoa pede. */
    async compartilhar() {
        try {
            const { abrirCartaoLeitura } = await import('../utils/cartaoLeitura.js');
            await abrirCartaoLeitura({ cartas: this.cartasEscolhidas, pergunta: this.pergunta, data: dataLocal() });
        } catch (e) {
            this.anunciar(TEXTO.cartaoFalhou);
        }
    }

    novaLeitura() {
        this.timers.forEach((t) => clearTimeout(t));
        this.timers.clear();
        this.baralho = [];
        this.escolhas = [];
        this.pergunta = '';
        this.entradaId = null;
        this.irPara('pergunta');
    }
}

customElements.define('three-card-game-screen', ThreeCardGameScreen);
