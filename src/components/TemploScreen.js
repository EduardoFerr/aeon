import { loadCards, shuffle } from '../utils/cardsUtil.js';
import { carregarTextos, texto, esc } from '../utils/mapaComum.js';
import { dataLocal } from '../utils/cartaDoDia.js';
import { ic } from '../utils/glifos.js';
import { limparPergunta, LIMITE_PERGUNTA, guardarTemplo, apagarEntrada, pedirFoco } from '../utils/diario.js';
import { navigateTo } from '../utils/navigation.js';
import { abrir, ehDesktop, avisar, reduzMovimento } from './Sobreposicao.js';
import {
    POSICOES, TOTAL, SINTESE, PLANOS, faltamSeis, sinteseLiberada, proximaVaga, proximaLeitura, anterior, seguinte,
    vizinho, blocos, linhaResumo, colocarCarta, paraDiario, compararPlanos, equilibrio, juntar,
} from '../utils/templo.js';
import('./TarotCardInfo.js');

const DURACAO_EMBARALHAR = 1300; // ms
const FALHA = 'Não foi possível abrir o templo agora. Recarregue a página.';
const arquivo = (c) => `assets/cards/crowley-${String(c.order).padStart(2, '0')}.jpg`;

/**
 * O Templo de Afrodite: sete cartas, duas colunas de tres (voce e a outra pessoa) e a Sintese embaixo, no centro.
 * Mesmo fluxo da Cruz: pergunta (opcional), embaralhar, montar (a pessoa coloca as sete cartas, de costas, nas
 * sete posicoes) e revelar (tocar a carta vira e abre o texto da posicao). A Sintese so abre depois das outras seis.
 * Depois de virar tudo, a tela compara as duas cartas de cada linha pelo elemento e mostra o equilibrio entre os planos.
 * O sorteio e o estado ficam em memoria; so o que a pessoa guardar no diario fica gravado.
 * Indices 0 a 6 seguem a numeracao das cartas, de 1 a 7 (ver utils/templo.js).
 */
export class TemploScreen extends HTMLElement {
    async connectedCallback() {
        this.timers = new Set();
        this.fase = 'carregando';
        this.pergunta = '';
        this.colPref = 0;
        this.zerar();
        this.sobre = null;
        this.innerHTML = `<section class="leitura cz-raiz" aria-label="O Templo de Afrodite">
            <div data-passos></div>
            <p class="sr" role="status" aria-live="polite" data-anuncio></p>
            <div class="leitura-palco" data-palco></div>
        </section>`;
        this.palco = this.querySelector('[data-palco]');
        this.titulo = document.querySelector('.page-title');
        try {
            this.textos = await carregarTextos();
        } catch (e) {
            if (this.isConnected) this.palco.innerHTML = `<p class="leitura-dica" role="alert">${FALHA}</p>`;
            return;
        }
        if (!this.isConnected) return;
        this.querySelector('.cz-raiz').setAttribute('aria-label', this.t('ui.templo.titulo'));
        document.querySelector('#page-title').textContent = this.t('ui.templo.titulo');
        this.ouvirTeclas();
        this.desenharPergunta(true);
    }

    disconnectedCallback() {
        this.timers.forEach((t) => clearTimeout(t));
        this.timers.clear();
        if (this.titulo) this.titulo.classList.remove('cz-sr');
        if (this.sobre && this.sobre.aberto) this.sobre.fechar(false);
    }

    t(id, vars = {}) {
        return texto(this.textos, id, vars, '');
    }

    /** Nome da posicao: `nome` abre o painel, `aria` e o nome acessivel da carta ("Carta 1, plano mental, você"). */
    pos(i) {
        const p = POSICOES[i];
        const carta = this.t('ui.templo.carta', { n: i + 1 });
        if (p.plano === 'sintese') {
            const nome = this.t('ui.cruz.pos.sintese');
            return { id: p.id, nome, aria: `${carta}, ${nome.toLowerCase()}`, sig: this.t('ui.templo.pos.sintese.sig'), carta };
        }
        const plano = this.t(`ui.templo.plano.${p.plano}`);
        const lado = this.t(`ui.templo.col.${p.lado}`);
        return { id: p.id, nome: `${plano} · ${lado}`, aria: `${carta}, ${plano.toLowerCase()}, ${lado.toLowerCase()}`, sig: this.t(`ui.templo.pos.${p.id}.sig`), carta };
    }

    espera(fn, ms) {
        const tm = setTimeout(() => {
            this.timers.delete(tm);
            fn();
        }, ms);
        this.timers.add(tm);
    }

    anunciar(txt) {
        const a = this.querySelector('[data-anuncio]');
        if (a) a.textContent = txt;
    }

    zerar() {
        this.baralho = [];
        this.cartas = Array(TOTAL).fill(null);
        this.vir = Array(TOTAL).fill(false);
        this.lida = Array(TOTAL).fill(false);
        this.aberta = -1;
        this.entradaId = null;
    }

    nColocadas() { return this.cartas.filter(Boolean).length; }
    montando() { return this.nColocadas() < TOTAL; }
    nLidas() { return this.lida.filter(Boolean).length; }
    todasViradas() { return this.vir.every(Boolean); }
    falta(n) { return n === 1 ? this.t('ui.cruz.falta.um') : this.t('ui.cruz.falta', { n }); }
    travada(i) { return i === SINTESE && !this.vir[SINTESE] && !sinteseLiberada(this.vir); }

    /* ---------- moldura: passos, dicas e titulo ---------- */

    passos(atual) {
        const raiz = this.querySelector('[data-passos]');
        if (atual < 0) {
            raiz.innerHTML = '';
            return;
        }
        const nomes = [this.t('ui.cruz.passo.pergunta'), this.t('ui.cruz.embaralhar'), this.t('ui.cruz.passo.montar'), this.t('ui.cruz.passo.revelar')];
        raiz.innerHTML = `<ol class="leitura-passos cz-passos" aria-label="${esc(this.t('ui.cruz.passos'))}">${nomes
            .map((n, i) => `<li${i < atual ? ' class="feito"' : ''}${i === atual ? ' aria-current="step"' : ''}><span class="leitura-passo-n" aria-hidden="true">${i + 1}</span><span class="leitura-passo-t">${esc(n)}</span></li>`)
            .join('')}</ol>`;
    }

    /** As tres dicas de leitura; o que vem antes dos dois pontos fica em negrito. */
    dicasLista() {
        return ['periodo', 'linhas', 'outra']
            .map((k) => {
                const txt = this.t(`ui.templo.dica.${k}`);
                const corte = txt.indexOf(': ');
                return corte > 0 ? `<li><b>${esc(txt.slice(0, corte + 1))}</b> ${esc(txt.slice(corte + 2))}</li>` : `<li>${esc(txt)}</li>`;
            })
            .join('');
    }

    /* ---------- pergunta, embaralhar ---------- */

    desenharPergunta(foco, erroTexto = false) {
        this.fase = 'pergunta';
        this.fecharSobre(false);
        this.titulo && this.titulo.classList.remove('cz-sr');
        this.passos(0);
        this.palco.dataset.fase = 'pergunta';
        this.palco.innerHTML = `
            <div class="leitura-bloco panel-card">
                <h2 class="leitura-titulo" tabindex="-1">${esc(erroTexto ? this.t('ui.cruz.erro.titulo') : this.t('ui.cruz.perg.titulo'))}</h2>
                ${erroTexto ? `<p class="leitura-dica" role="alert">${esc(this.t('ui.cruz.erro.texto'))}</p>` : ''}
                <div class="leitura-campo">
                    <label for="tp-pergunta">${esc(this.t('ui.cruz.perg.rotulo'))}</label>
                    <textarea id="tp-pergunta" rows="3" maxlength="${LIMITE_PERGUNTA}" placeholder="${esc(this.t('ui.cruz.perg.ph'))}" aria-describedby="tp-pergunta-dica" enterkeyhint="done">${esc(this.pergunta)}</textarea>
                    <div class="leitura-campo-pe">
                        <p id="tp-pergunta-dica" class="leitura-dica">${esc(this.t('ui.templo.perg.dica'))}</p>
                        <p class="leitura-contador" aria-hidden="true" data-contador>${this.pergunta.length}/${LIMITE_PERGUNTA}</p>
                    </div>
                </div>
                <section class="tp-dicas-lista" aria-labelledby="tp-dicas-t">
                    <h3 id="tp-dicas-t">${esc(this.t('ui.templo.dicas.titulo'))}</h3>
                    <ul>${this.dicasLista()}</ul>
                </section>
                <div class="leitura-acoes">
                    <button type="button" class="btn btn-primary" data-acao="embaralhar">${ic('baralho')}<span>${esc(erroTexto ? this.t('ui.cruz.erro.de-novo') : this.t('ui.cruz.embaralhar'))}</span></button>
                </div>
            </div>`;
        const campo = this.palco.querySelector('textarea');
        const contador = this.palco.querySelector('[data-contador]');
        campo.addEventListener('input', () => {
            if (campo.value.length > LIMITE_PERGUNTA) campo.value = campo.value.slice(0, LIMITE_PERGUNTA);
            contador.textContent = `${campo.value.length}/${LIMITE_PERGUNTA}`;
        });
        campo.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.embaralhar();
            }
        });
        this.palco.querySelector('[data-acao="embaralhar"]').addEventListener('click', () => this.embaralhar());
        if (foco) campo.focus({ preventScroll: true });
    }

    async embaralhar() {
        const campo = this.palco.querySelector('textarea');
        if (campo) this.pergunta = limparPergunta(campo.value);
        const botao = this.palco.querySelector('[data-acao="embaralhar"]');
        if (botao) {
            botao.disabled = true;
            botao.setAttribute('aria-busy', 'true');
            botao.querySelector('span').textContent = this.t('ui.cruz.embaralhando');
        }
        let todas;
        try {
            todas = await loadCards();
        } catch (e) {
            if (this.isConnected) this.desenharPergunta(true, true);
            return;
        }
        if (!this.isConnected) return;
        this.reembaralhar(todas);
    }

    /** Sorteio real (Fisher-Yates com crypto); a animacao e so encenacao. Serve tambem para "Embaralhar de novo". */
    reembaralhar(todas) {
        this.fecharSobre(false);
        this.timers.forEach((tm) => clearTimeout(tm));
        this.timers.clear();
        this.todasCartas = todas || this.todasCartas;
        this.zerar();
        this.baralho = shuffle(this.todasCartas);
        if (reduzMovimento()) {
            this.desenharMesa(true);
            return;
        }
        this.fase = 'embaralhar';
        this.passos(1);
        const folhas = Array.from({ length: 8 }, (_, i) => `<span class="leitura-verso leitura-folha cz-bate" style="--k:${i}"></span>`).join('');
        this.palco.dataset.fase = 'embaralhar';
        this.palco.innerHTML = `<div class="leitura-bloco leitura-mesa"><h2 class="leitura-titulo" tabindex="-1">${esc(this.t('ui.cruz.embaralhar'))}</h2><div class="leitura-baralho" aria-hidden="true">${folhas}</div></div>`;
        this.palco.querySelector('.leitura-titulo').focus({ preventScroll: true });
        this.anunciar(this.t('ui.cruz.embaralhando.anuncio'));
        this.espera(() => this.desenharMesa(true), DURACAO_EMBARALHAR);
    }

    /* ---------- a mesa ---------- */

    /** Uma carta na grade: colunas 1 (voce), 2 (rotulos do plano; a Sintese fica aqui) e 3 (a outra pessoa); linhas 2 a 4. */
    noHtml(i) {
        const p = POSICOES[i];
        const nome = this.pos(i);
        const col = p.col === null ? 2 : p.col === 0 ? 1 : 3;
        const rot = i === SINTESE ? `${i + 1} · ${esc(nome.nome)}` : `${i + 1}`;
        return `<button type="button" class="cz-no tp-no" data-i="${i}" style="grid-column:${col};grid-row:${p.lin + 2}" aria-haspopup="dialog">
            <span class="cz-carta"><span class="cz-in"><span class="cz-lado cz-verso"></span><span class="cz-lado cz-frente"></span></span><svg class="cz-mais" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg><span class="cz-falta" data-falta></span></span>
            <span class="cz-rot"><i class="cz-mk" aria-hidden="true"></i>${rot}</span>
        </button>`;
    }

    planoHtml(k) {
        const plano = PLANOS[k];
        return `<div class="tp-plano" style="grid-column:2;grid-row:${k + 2}" data-plano="${plano}"><b>${esc(this.t(`ui.templo.plano.${plano}.curto`))}</b><span class="tp-rel" data-rel></span></div>`;
    }

    desenharMesa(foco) {
        this.fase = 'mesa';
        this.passos(-1);
        if (this.titulo) this.titulo.classList.add('cz-sr'); // no celular o h2 da tela faz o papel do titulo
        this.palco.dataset.fase = 'mesa';
        this.palco.innerHTML = `
            <div class="cz-tela tp-tela">
                <div class="cz-cab" data-cab></div>
                <div class="cz-palco">
                    <div class="tp-mesa" role="group" aria-label="${esc(this.t('ui.templo.titulo'))}" aria-describedby="tp-descricao">
                        <p class="sr" id="tp-descricao">${esc(this.t('ui.templo.descricao'))}</p>
                        <p class="tp-col" style="grid-column:1;grid-row:1" aria-hidden="true">${esc(this.t('ui.templo.col.voce'))}</p>
                        <p class="tp-col" style="grid-column:3;grid-row:1" aria-hidden="true">${esc(this.t('ui.templo.col.outra'))}</p>
                        ${PLANOS.map((_, k) => this.planoHtml(k)).join('')}
                        ${POSICOES.map((_, i) => this.noHtml(i)).join('')}
                        <button type="button" class="cz-no cz-deck" data-deck style="grid-column:3;grid-row:5">
                            <span class="cz-carta"><span class="cz-lado cz-verso"></span><span class="cz-lado cz-verso p2"></span><span class="cz-lado cz-verso p1"></span></span>
                            <span class="cz-rot">${esc(this.t('ui.cruz.baralho'))}</span><span class="cz-leg" data-deck-leg></span>
                        </button>
                    </div>
                </div>
                <div class="cz-barra" data-barra></div>
                <div class="cz-lado-col">
                    <div class="cz-acoes" data-acoes></div>
                    <section class="tp-comp" data-comp aria-labelledby="tp-comp-t" hidden></section>
                    <details class="tp-dicas">
                        <summary>${esc(this.t('ui.templo.dicas.titulo'))}</summary>
                        <ul>${this.dicasLista()}</ul>
                    </details>
                    <ol class="cz-lista" data-lista aria-label="${esc(this.t('ui.templo.lista'))}"></ol>
                </div>
            </div>`;
        const mesa = this.palco.querySelector('.tp-mesa');
        mesa.addEventListener('click', (e) => {
            if (e.target.closest('.cz-deck')) {
                this.colocar(proximaVaga(this.cartas), true);
                return;
            }
            const no = e.target.closest('.cz-no');
            if (no) this.tocar(Number(no.dataset.i), no);
        });
        mesa.addEventListener('keydown', (e) => this.teclaNaMesa(e));
        this.palco.querySelector('[data-lista]').addEventListener('click', (e) => {
            const b = e.target.closest('.cz-linha');
            if (b) this.tocar(Number(b.dataset.i), this.noDe(Number(b.dataset.i)));
        });
        this.atualizar();
        const alvo = this.montando() ? Math.max(0, proximaVaga(this.cartas)) : Math.max(0, proximaLeitura(this.lida));
        this.nos().forEach((n) => (n.tabIndex = Number(n.dataset.i) === alvo ? 0 : -1));
        if (foco) {
            const ir = () => {
                const n = this.montando() ? this.palco.querySelector('.cz-deck') : this.noDe(alvo);
                if (n) n.focus({ preventScroll: true });
            };
            if (reduzMovimento()) ir();
            else this.espera(ir, 150);
        }
    }

    nos() { return [...this.palco.querySelectorAll('.cz-no:not(.cz-deck)')]; }
    noDe(i) { return this.palco.querySelector(`.cz-no[data-i="${i}"]`); }

    /** Toque numa carta ou numa linha da lista: monta, avisa que a Sintese espera, ou abre a posicao. */
    tocar(i, no) {
        if (this.montando()) {
            this.colocar(i, false);
            return;
        }
        if (this.travada(i)) {
            this.anunciar(this.t('ui.templo.sintese.espera', { falta: this.falta(faltamSeis(this.vir)) }));
            return;
        }
        this.abrirPosicao(i, no);
    }

    rotuloNo(i) {
        const p = this.pos(i);
        const c = this.cartas[i];
        if (!c) return this.t('ui.templo.no.vazio', { pos: p.aria });
        if (this.montando()) return this.t('ui.templo.no.colocada', { pos: p.aria });
        if (!this.vir[i]) {
            if (this.travada(i)) return this.t('ui.templo.no.travada', { pos: p.aria, falta: this.falta(faltamSeis(this.vir)) });
            return this.t('ui.templo.no.costas', { pos: p.aria });
        }
        return this.t(this.lida[i] ? 'ui.cruz.no.lida' : 'ui.cruz.no.virada', { pos: p.aria, nome: c.name, titulo: c.title });
    }

    /** Aplica o estado de cada carta sem refazer o DOM, para o giro e a entrada animarem. */
    pintarNos() {
        const mont = this.montando();
        const prox = mont ? proximaVaga(this.cartas) : proximaLeitura(this.lida);
        this.nos().forEach((n) => {
            const i = Number(n.dataset.i);
            const c = this.cartas[i];
            const car = n.querySelector('.cz-carta');
            if (c && this.vir[i] && !car.querySelector('.cz-frente img')) {
                car.querySelector('.cz-frente').innerHTML = `<img src="${arquivo(c)}" alt="" width="274" height="410" decoding="async">`;
            }
            if (c && this.vir[i]) requestAnimationFrame(() => car.classList.add('virada'));
            else car.classList.remove('virada');
            const trava = !mont && this.travada(i);
            n.classList.toggle('vazio', !c);
            n.classList.toggle('lida', this.lida[i]);
            n.classList.toggle('aberta', this.aberta === i);
            n.classList.toggle('travada', trava);
            n.classList.toggle('proxima', prox === i && this.aberta < 0 && (mont || !trava));
            n.setAttribute('aria-label', this.rotuloNo(i));
            if (c && !mont && !trava) n.removeAttribute('aria-disabled');
            else n.setAttribute('aria-disabled', c || trava ? 'true' : 'false');
            if (this.aberta === i) n.setAttribute('aria-expanded', 'true');
            else n.removeAttribute('aria-expanded');
            n.querySelector('[data-falta]').textContent = trava ? this.t('ui.cruz.falta', { n: faltamSeis(this.vir) }) : '';
        });
        const deck = this.palco.querySelector('.cz-deck');
        if (deck) {
            deck.hidden = !mont;
            const resto = TOTAL - this.nColocadas();
            deck.querySelector('[data-deck-leg]').textContent = resto ? this.falta(resto) : '';
            const v = proximaVaga(this.cartas);
            deck.setAttribute('aria-label', `${this.t('ui.cruz.baralho.aria', { pos: v >= 0 ? this.pos(v).aria : '' })} ${resto ? this.falta(resto) + '.' : ''}`.trim());
        }
        // a relacao de cada linha aparece no rotulo do plano quando as sete cartas foram viradas
        const linhas = this.todasViradas() ? compararPlanos(this.cartas) : [];
        this.palco.querySelectorAll('.tp-plano').forEach((el, k) => {
            const rel = el.querySelector('[data-rel]');
            const l = linhas[k];
            rel.textContent = l ? this.t(`ui.templo.rel.${l.relacao}`) : '';
            el.dataset.relacao = l ? l.relacao : '';
        });
    }

    /** Um so ponto de Tab na mesa; as setas andam por ela como ela e desenhada. O baralho e outro ponto de Tab. */
    teclaNaMesa(e) {
        const no = e.target.closest('.cz-no:not(.cz-deck)');
        if (!no) return;
        const i = Number(no.dataset.i);
        const alvo = vizinho(i, e.key, this.colPref);
        if (alvo === null) return;
        e.preventDefault();
        this.irNo(alvo);
    }

    irNo(i) {
        if (i < SINTESE) this.colPref = POSICOES[i].col;
        this.nos().forEach((n) => (n.tabIndex = Number(n.dataset.i) === i ? 0 : -1));
        const n = this.noDe(i);
        if (n) n.focus();
    }

    ouvirTeclas() {
        // o popover do desktop nao prende o foco: Esc fecha tambem quando o foco esta na mesa
        this.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.sobre && this.sobre.aberto) {
                e.preventDefault();
                this.sobre.fechar();
            }
        });
    }

    /** A pessoa coloca a proxima carta do baralho numa posicao (por toque no lugar vazio, ou no baralho). */
    colocar(i, doBaralho) {
        if (i < 0 || this.cartas[i] || !this.montando()) return;
        const n = this.noDe(i);
        const deck = this.palco.querySelector('.cz-deck');
        if (n && deck && !reduzMovimento()) {
            const a = deck.getBoundingClientRect();
            const b = n.getBoundingClientRect();
            n.style.setProperty('--dx', `${a.left - b.left}px`);
            n.style.setProperty('--dy', `${a.top - b.top}px`);
            n.classList.remove('entra');
            void n.offsetWidth;
            n.classList.add('entra');
        }
        this.cartas = colocarCarta(this.baralho, this.cartas, i);
        this.atualizar();
        const resto = TOTAL - this.nColocadas();
        if (resto) {
            this.anunciar(this.t('ui.cruz.montar.colocada', { pos: this.pos(i).aria, falta: this.falta(resto) }));
            if (!doBaralho) this.irNo(proximaVaga(this.cartas));
        } else {
            this.anunciar(this.t('ui.templo.montar.feita'));
            this.irNo(0);
        }
    }

    /* ---------- textos da tela, comparacao, lista e acoes ---------- */

    atualizar() {
        this.pintarNos();
        const tudo = this.todasViradas();
        const mont = this.montando();
        const titulo = this.t(mont ? 'ui.templo.montar.titulo' : tudo ? 'ui.templo.final.titulo' : 'ui.cruz.rev.titulo');
        const dica = mont ? this.t('ui.cruz.montar.dica') : this.t(tudo ? 'ui.cruz.final.dica' : 'ui.cruz.rev.dica');
        const contagem = mont ? this.t('ui.templo.montar.n', { n: this.nColocadas() }) : this.t('ui.templo.lidas', { n: this.nLidas() });
        this.palco.querySelector('[data-cab]').innerHTML = `<h2 class="leitura-titulo" tabindex="-1">${esc(titulo)}</h2>${this.pergunta ? `<p class="leitura-eco"><q>${esc(this.pergunta)}</q></p>` : ''}<p class="cz-dica">${esc(dica)} <span class="cz-lidas">${esc(contagem)}</span></p>`;
        const lista = this.palco.querySelector('[data-lista]');
        lista.hidden = mont;
        lista.innerHTML = POSICOES.map((_, i) => {
            const p = this.pos(i);
            const c = this.cartas[i];
            const v = c && this.vir[i];
            return `<li><button type="button" class="cz-linha${this.lida[i] ? ' lida' : ''}" data-i="${i}" aria-haspopup="dialog"><i class="cz-mk" aria-hidden="true"></i><span class="cz-c"><span class="cz-eb">${i + 1} · ${esc(p.nome)}</span>${
                v ? `<span class="cz-n">${esc(c.name)}</span><span class="cz-t">${esc(linhaResumo(i, c))}</span>` : `<span class="cz-t">${esc(p.sig)}</span>`
            }</span></button></li>`;
        }).join('');
        this.desenharComparacao();
        this.desenharAcoes();
    }

    /** Comparacao por linha e quadro de equilibrio: so depois das sete cartas viradas. */
    desenharComparacao() {
        const sec = this.palco.querySelector('[data-comp]');
        const linhas = this.todasViradas() ? compararPlanos(this.cartas) : [];
        if (!linhas.length) {
            sec.hidden = true;
            sec.innerHTML = '';
            return;
        }
        const jaEstava = !sec.hidden;
        const eq = equilibrio(linhas);
        const nomeCurto = (pl) => this.t(`ui.templo.plano.${pl}.curto`);
        const itens = linhas
            .map((l) => `<li class="tp-lin" data-relacao="${l.relacao}">
                <div class="tp-lin-cab"><h4>${esc(this.t(`ui.templo.plano.${l.plano}`))}</h4><span class="tp-rel tp-rel-${l.relacao}">${esc(this.t(`ui.templo.rel.${l.relacao}`))}</span></div>
                <p class="tp-lados">${esc(this.t('ui.templo.comp.lados', { a: l.elementos[0], b: l.elementos[1] }))}</p>
                <p class="tp-frase">${esc(this.t(`ui.templo.rel.${l.relacao}.frase`))}</p>
                ${l.peso ? `<p class="tp-peso">${esc(this.t(`ui.templo.peso.${l.peso}`))}</p>` : ''}
            </li>`)
            .join('');
        const barras = linhas
            .map((l) => `<li class="tp-barra" data-relacao="${l.relacao}"><span class="tp-b-n">${esc(nomeCurto(l.plano))}</span><span class="tp-seg" aria-hidden="true">${[1, 2, 3, 4].map((k) => `<i${k <= l.nivel ? ' class="on"' : ''}></i>`).join('')}</span><span class="tp-b-r">${esc(this.t(`ui.templo.rel.${l.relacao}`))}</span></li>`)
            .join('');
        const frase = eq.igual ? this.t('ui.templo.eq.igual') : this.t('ui.templo.eq.frase', { mais: juntar(eq.mais.map(nomeCurto)), menos: juntar(eq.menos.map(nomeCurto)) });
        sec.innerHTML = `
            <h3 class="tp-h" id="tp-comp-t" tabindex="-1">${esc(this.t('ui.templo.comp.titulo'))}</h3>
            <p class="tp-lead">${esc(this.t('ui.templo.comp.lead'))}</p>
            <ul class="tp-linhas">${itens}</ul>
            <div class="tp-eq">
                <h3 class="tp-h">${esc(this.t('ui.templo.eq.titulo'))}</h3>
                <ul class="tp-barras">${barras}</ul>
                <p class="tp-eq-frase">${esc(frase)}</p>
                <p class="tp-lead">${esc(this.t(eq.igual ? 'ui.templo.eq.leitura.igual' : 'ui.templo.eq.leitura.desigual'))}</p>
            </div>
            <p class="tp-aviso">${esc(this.t('ui.templo.aviso'))}</p>`;
        sec.hidden = false;
        if (!jaEstava) this.anunciar(this.t('ui.templo.comp.titulo'));
    }

    desenharAcoes() {
        const acoes = this.palco.querySelector('[data-acoes]');
        const barra = this.palco.querySelector('[data-barra]');
        if (!acoes) return;
        const ativo = document.activeElement;
        const tinhaFoco = !!ativo && (acoes.contains(ativo) || barra.contains(ativo)); // o botao que tinha o foco vai sumir
        barra.innerHTML = '';
        const refaz = !this.vir.some(Boolean) && this.nColocadas() > 0 ? `<button type="button" class="btn btn-terciario" data-acao="reembaralhar">${esc(this.t('ui.cruz.montar.refazer'))}</button>` : '';
        if (!this.todasViradas()) {
            acoes.innerHTML = (this.montando() ? '' : `<button type="button" class="btn btn-terciario" data-acao="virar-todas">${esc(this.t('ui.cruz.virar-todas'))}</button>`) + refaz;
            const virar = acoes.querySelector('[data-acao="virar-todas"]');
            if (virar) virar.addEventListener('click', () => this.virarTodas());
            const r = acoes.querySelector('[data-acao="reembaralhar"]');
            if (r) r.addEventListener('click', () => this.reembaralhar());
            if (tinhaFoco && !acoes.contains(document.activeElement)) this.irNo(Math.max(0, this.montando() ? proximaVaga(this.cartas) : proximaLeitura(this.lida)));
            return;
        }
        barra.innerHTML = (this.entradaId
            ? `<button type="button" class="btn btn-ghost" data-acao="ver-diario">${esc(this.t('ui.cruz.ver-diario'))}</button>`
            : `<button type="button" class="btn btn-primary" data-acao="guardar">${esc(this.t('ui.cruz.guardar'))}</button>`)
            + `<button type="button" class="btn btn-ghost" data-acao="compartilhar">${ic('compartilhar')}${esc(this.t('ui.cruz.compartilhar'))}</button>`;
        acoes.innerHTML = `<button type="button" class="btn btn-terciario" data-acao="outra">${esc(this.t('ui.cruz.outra'))}</button>`;
        const guardar = barra.querySelector('[data-acao="guardar"]');
        if (guardar) guardar.addEventListener('click', () => this.guardar());
        const ver = barra.querySelector('[data-acao="ver-diario"]');
        if (ver) {
            ver.addEventListener('click', () => {
                if (this.entradaId) pedirFoco(this.entradaId);
                navigateTo('history');
            });
        }
        barra.querySelector('[data-acao="compartilhar"]').addEventListener('click', () => this.compartilhar());
        acoes.querySelector('[data-acao="outra"]').addEventListener('click', () => this.outraPergunta());
        if (tinhaFoco && !barra.contains(document.activeElement) && !acoes.contains(document.activeElement)) barra.querySelector('.btn').focus({ preventScroll: true });
    }

    virarTodas() {
        this.vir = Array(TOTAL).fill(true);
        this.atualizar();
        this.anunciar(this.t('ui.templo.viradas.anuncio'));
    }

    /** Guarda no diario so por escolha; o aviso traz Desfazer. */
    guardar() {
        const r = guardarTemplo(paraDiario(this.cartas), this.pergunta);
        if (!r.ok) {
            avisar(this.t('ui.cruz.guardar.erro'), { erro: true });
            return;
        }
        this.entradaId = r.id;
        this.desenharAcoes();
        const ver = this.palco.querySelector('[data-acao="ver-diario"]');
        if (ver) ver.focus({ preventScroll: true });
        avisar(this.t('ui.templo.guardada'), {
            desfazer: {
                rotulo: this.t('ui.cruz.desfazer'),
                aoClicar: () => {
                    apagarEntrada(r.id);
                    if (this.entradaId === r.id) this.entradaId = null;
                    if (this.isConnected) {
                        this.desenharAcoes();
                        const g = this.palco.querySelector('[data-acao="guardar"]');
                        if (g) g.focus({ preventScroll: true });
                    }
                },
            },
        });
    }

    outraPergunta() {
        this.fecharSobre(false);
        this.timers.forEach((tm) => clearTimeout(tm));
        this.timers.clear();
        this.pergunta = '';
        this.zerar();
        this.desenharPergunta(true);
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    /** Cartao do templo (Canvas), carregado so quando a pessoa pede. */
    async compartilhar() {
        this.fecharSobre(false);
        try {
            const { abrirCartaoTemplo } = await import('../utils/cartaoTemplo.js');
            await abrirCartaoTemplo({ cartas: this.cartas, pergunta: this.pergunta, data: dataLocal(), relacoes: compararPlanos(this.cartas).map((l) => l.relacao) });
        } catch (e) {
            avisar(this.t('ui.cruz.cartao.erro'), { erro: true });
        }
    }

    /* ---------- painel da posicao: sheet no celular, popover ao lado da mesa no desktop ---------- */

    corpoPosicao(i) {
        const c = this.cartas[i];
        const cab = `<div class="cz-sh-carta"><img src="${arquivo(c)}" alt="${esc(`${c.name}, ${c.title}`)}" width="274" height="410"><div class="cz-sh-nome"><b>${esc(c.name)}</b><span>${esc(c.title)}</span><button type="button" class="btn btn-terciario" data-abrir>${esc(this.t('ui.cruz.abrir-carta'))}${ic('seta')}</button></div></div>`;
        const lista = blocos(i, c)
            .map((b) => {
                const rot = this.t(b.id === 'mostra' ? 'ui.templo.rot.mostra' : `ui.cruz.rot.${b.id}`);
                return `<div class="cz-bl${b.cor ? ` cz-bl-${b.cor}` : ''}"><p class="cz-bl-r">${esc(rot)}</p><p class="cz-bl-t">${esc(b.texto)}</p></div>`;
            })
            .join('');
        const nota = i === SINTESE ? 'ui.templo.nota.sintese' : POSICOES[i].lado === 'outra' ? 'ui.templo.nota.outra' : '';
        return cab + lista + (nota ? `<p class="cz-bl-n tp-nota">${esc(this.t(nota))}</p>` : '');
    }

    rodapePosicao(i) {
        const a = anterior(i);
        const s = seguinte(i);
        return (a !== null
            ? `<button type="button" class="btn btn-terciario" data-nav="${a}" aria-label="${esc(this.t('ui.cruz.anterior', { pos: this.pos(a).aria }))}">${ic('voltar')}${esc(this.pos(a).carta)}</button>`
            : '<span></span>')
            + (s !== null ? this.botaoProxima(s) : '<span></span>');
    }

    /** A Sintese tambem espera no rodape: enquanto as seis nao foram viradas, o botao fica desabilitado e diz o que falta. */
    botaoProxima(s) {
        const trava = this.travada(s);
        const rotulo = trava
            ? this.t('ui.templo.no.travada', { pos: this.pos(s).aria, falta: this.falta(faltamSeis(this.vir)) })
            : this.t('ui.cruz.proxima', { pos: this.pos(s).aria });
        return `<button type="button" class="btn btn-terciario" data-nav="${s}"${trava ? ' aria-disabled="true"' : ''} aria-label="${esc(rotulo)}">${esc(this.pos(s).carta)}${ic('seta')}</button>`;
    }

    contextoPosicao(i) {
        return `<b>${esc(this.t('ui.templo.posicao', { n: i + 1 }))}</b>${esc(this.pos(i).sig)}`;
    }

    /** Celular: a tela rola o bastante para a carta tocada ficar visivel acima do sheet (que cobre 58% da altura). */
    garantirVisivel(no) {
        const r = no.getBoundingClientRect();
        const limite = innerHeight * 0.38 - 12;
        if (r.bottom > limite || r.top < 70) window.scrollBy({ top: r.top - 78, left: 0, behavior: 'auto' });
    }

    abrirPosicao(i, no, mantem = false) {
        const p = this.pos(i);
        const primeira = !this.sobre || !this.sobre.aberto;
        if (primeira && !ehDesktop() && no) this.garantirVisivel(no);
        const jaVirada = this.vir[i];
        this.vir[i] = true;
        this.lida[i] = true;
        this.aberta = i;
        if (primeira) {
            this.sobre = abrir({
                tipo: 'popover', titulo: esc(p.nome), contexto: this.contextoPosicao(i), corpo: this.corpoPosicao(i), rodape: this.rodapePosicao(i),
                gatilho: no, classe: 'sob-cruz sob-templo', lado: 'direita', referencia: this.palco.querySelector('.tp-mesa'), largura: 400, mantemSe: '.cz-no, .cz-linha',
                aoFechar: () => {
                    this.aberta = -1;
                    if (this.isConnected && this.fase === 'mesa') this.atualizar();
                },
            });
            this.sobre.painel.addEventListener('click', (e) => {
                const nav = e.target.closest('[data-nav]');
                if (nav) {
                    const alvo = Number(nav.dataset.nav);
                    if (this.travada(alvo)) {
                        this.anunciar(this.t('ui.templo.sintese.espera', { falta: this.falta(faltamSeis(this.vir)) }));
                        return;
                    }
                    this.abrirPosicao(alvo, this.noDe(alvo), alvo < this.aberta ? 'anterior' : 'seguinte');
                    return;
                }
                if (e.target.closest('[data-abrir]')) this.abrirCarta();
            });
        } else {
            const s = this.sobre;
            s.trocarGatilho(no);
            s.trocarTitulo(p.nome);
            s.trocarContexto(this.contextoPosicao(i));
            s.trocarCorpo(this.corpoPosicao(i));
            s.trocarRodape(this.rodapePosicao(i));
            s.corpo.scrollTop = 0;
        }
        this.atualizar();
        if (this.sobre.painel.closest('.sob-r-popover') && no) this.sobre.reposicionar(no);
        const lidas = this.t('ui.templo.lidas', { n: this.nLidas() });
        this.anunciar(this.t(jaVirada ? 'ui.cruz.anuncio.lida' : 'ui.cruz.anuncio.virada', { pos: p.aria, nome: this.cartas[i].name, lidas }));
        if (mantem) {
            // navegando pelo rodape: o foco fica no botao da mesma direcao (ou no que existir)
            const painel = this.sobre.painel;
            const alvo = painel.querySelector(`[data-nav="${mantem === 'anterior' ? anterior(i) : seguinte(i)}"]`) || painel.querySelector('[data-nav]') || painel.querySelector('[data-sob-x]');
            if (alvo) alvo.focus({ preventScroll: true });
        }
    }

    /** "Abrir a carta inteira": fecha o painel (o resto da pagina fica inerte enquanto ele esta aberto) e abre a ficha. */
    abrirCarta() {
        const i = this.aberta;
        const no = this.noDe(i);
        const carta = this.cartas[i];
        this.fecharSobre(false);
        const info = document.querySelector('tarot-card-info');
        if (info && info.showInfo && carta) info.showInfo(carta, no);
    }

    fecharSobre(devolver) {
        const s = this.sobre;
        if (!s || !s.aberto) return;
        s.fechar(devolver);
    }
}

customElements.define('templo-screen', TemploScreen);
