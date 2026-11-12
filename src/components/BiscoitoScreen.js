import { carregarBiscoito, limparCache, formatarNumeros, anuncioDoBiscoito, textoParaCopiar, copiarTexto } from '../utils/biscoito.js';
import { lerHoje, quebrar as quebrarDia, LUGARES } from '../utils/biscoitoDia.js';
import { dataLocal } from '../utils/cartaDoDia.js';
import { SVG_INTEIRO, SVG_METADE_ESQ, SVG_METADE_DIR, svgComSufixo } from '../utils/biscoitoArte.js';
import { ic } from '../utils/glifos.js';
import { avisar, reduzMovimento } from './Sobreposicao.js';

const TEXTO = {
    titulo: 'Biscoito da sorte',
    lead: 'Três biscoitos por dia, cada um com uma frase e seis números da sorte.',
    grupo: 'Seus três biscoitos de hoje',
    dicaQuebrar: 'Toque num biscoito para quebrar.',
    dicaReler: 'Toque num biscoito para reler a mensagem.',
    preparando: 'Preparando o biscoito…',
    fechado: (l) => `Biscoito ${l + 1} de ${LUGARES}, fechado. Toque para quebrar.`,
    aberto: (l) => `Biscoito ${l + 1} de ${LUGARES}, aberto. Toque para ler a mensagem.`,
    selo: (l) => `Biscoito ${l + 1}`,
    rotuloNumeros: 'Seus números da sorte',
    copiar: 'Copiar',
    compartilhar: 'Compartilhar',
    copiado: 'Texto copiado.',
    naoCopiou: 'Não foi possível copiar.',
    erro: 'Não foi possível abrir o biscoito agora.',
    tentar: 'Tentar de novo',
};

const LIMITE_ESPERA = 8000; // ms esperando as frases chegarem depois do toque
const ESPERA_VIBRA = 180; // ms do toque ate a troca do inteiro pelas metades
const SEGURANCA = 2000; // ms: a animacao dura cerca de 1,5 s; isto encerra se o evento nao vier

const esperarAte = (promessa, ms) =>
    new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('biscoito: demorou')), ms);
        promessa.then(
            (v) => { clearTimeout(t); resolve(v); },
            (e) => { clearTimeout(t); reject(e); },
        );
    });

/**
 * Biscoito da sorte: tres biscoitos por dia, um por lugar (0, 1, 2). Tocar num fechado quebra e sorteia a frase na
 * hora (biscoitoDia.js guarda o que saiu em cada lugar); tocar num aberto so mostra a mensagem dele, sem sortear.
 * Cada botao tem data-estado: fechado | quebrando | aberto. O estado final e o estado base do CSS.
 */
export class BiscoitoScreen extends HTMLElement {
    connectedCallback() {
        this.aoVoltar = () => {
            // a pessoa deixou a aba aberta e o dia virou: tres biscoitos fechados de novo
            if (!document.hidden && this.data && dataLocal() !== this.data) this.montar();
        };
        document.addEventListener('visibilitychange', this.aoVoltar);
        this.montar();
    }

    disconnectedCallback() {
        document.removeEventListener('visibilitychange', this.aoVoltar);
        this.limparTempos();
        this.lista = null;
        limparCache(); // solta as frases da memoria; quem voltar no mesmo dia nem precisa delas
    }

    limparTempos() {
        clearTimeout(this.tFim);
        clearTimeout(this.tVibra);
        clearTimeout(this.tReduz);
        clearTimeout(this.tAnuncio);
        if (this.aoFimAnimacao && this.fimAlvo) this.fimAlvo.removeEventListener('animationend', this.aoFimAnimacao);
        this.aoFimAnimacao = null;
        this.fimAlvo = null;
    }

    botao(l) {
        return this.querySelector(`.bsc-bisc[data-lugar="${l}"]`);
    }

    montar() {
        this.limparTempos();
        this.data = dataLocal();
        this.ocupado = false;
        this.item = null;
        this.sel = -1;
        const { lugares, ordem } = lerHoje(this.data);
        this.lugares = lugares;

        const biscoito = (l) => `
            <button type="button" class="bsc-bisc" data-lugar="${l}" data-estado="fechado" style="--l:${l}">
                <span class="bsc-b-fechado">${svgComSufixo(SVG_INTEIRO, `f${l}`)}</span>
                <span class="bsc-b-aberto" aria-hidden="true">
                    <span class="bsc-metade bsc-m-e">${svgComSufixo(SVG_METADE_ESQ, `a${l}`)}</span><span class="bsc-metade bsc-m-d">${svgComSufixo(SVG_METADE_DIR, `a${l}`)}</span>
                </span>
            </button>`;
        this.innerHTML = `
            <section class="bsc" data-vazio aria-busy="false">
                <p class="bsc-lead">${TEXTO.lead}</p>

                <div class="bsc-trio" role="group" aria-label="${TEXTO.grupo}">${[0, 1, 2].map(biscoito).join('')}</div>
                <p class="bsc-dica" data-dica>${TEXTO.dicaQuebrar}</p>

                <div class="bsc-baixo">
                    <div class="bsc-baixo-corpo">
                        <div class="bsc-papel">
                            <article class="bsc-tirinha">
                                <p class="bsc-selo" data-selo></p>
                                <p class="bsc-frase" data-frase></p>
                                <p class="bsc-rotulo">${TEXTO.rotuloNumeros}</p>
                                <ol class="bsc-numeros" aria-label="${TEXTO.rotuloNumeros}" data-numeros></ol>
                            </article>
                        </div>
                        <div class="bsc-acoes">
                            <button type="button" class="btn btn-primary" data-acao="copiar">${ic('copiar')}${TEXTO.copiar}</button>
                            <button type="button" class="btn btn-ghost" data-acao="compartilhar">${ic('compartilhar')}${TEXTO.compartilhar}</button>
                        </div>
                    </div>
                    <div class="bsc-erro" role="alert" hidden>
                        <p>${TEXTO.erro}</p>
                        <button type="button" class="btn btn-primary" data-acao="tentar">${TEXTO.tentar}</button>
                    </div>
                </div>
                <p class="sr" role="status" aria-live="polite" data-anuncio></p>
            </section>
        `;
        const titulo = document.querySelector('#page-title');
        if (titulo) titulo.textContent = TEXTO.titulo;

        this.bsc = this.querySelector('.bsc');
        this.querySelectorAll('.bsc-bisc').forEach((b) => b.addEventListener('click', (e) => this.tocar(Number(b.dataset.lugar), e)));
        this.querySelector('[data-acao="tentar"]').addEventListener('click', (e) => {
            this.tsInicio = e.timeStamp;
            limparCache();
            this.lista = null;
            this.pedir(this.pendente);
        });
        this.querySelector('[data-acao="copiar"]').addEventListener('click', () => this.copiar());
        this.querySelector('[data-acao="compartilhar"]').addEventListener('click', () => this.compartilhar());
        // um toque em qualquer ponto durante a animacao leva tudo ao fim
        this.bsc.addEventListener('click', (e) => {
            if (!this.bsc.hasAttribute('data-anima') || e.timeStamp === this.tsInicio) return;
            this.bsc.setAttribute('data-pulado', '');
            this.finalizar();
        });

        for (let l = 0; l < LUGARES; l++) this.rotular(l);
        // ja abriu hoje: os abertos aparecem como metades, sem animacao e sem baixar as frases; a tirinha e a do primeiro aberto
        if (ordem.length) this.selecionar(ordem[0], { anunciar: false, fade: false });
        this.atualizarDica();
        if (this.lugares.some((x) => !x)) this.precarregar();
    }

    /** As frases comecam a chegar ja ao abrir a tela, para estarem prontas antes do toque. */
    precarregar() {
        carregarBiscoito().then(
            (lista) => { if (this.isConnected) this.lista = lista; },
            () => { /* o erro so aparece quando a pessoa tenta quebrar */ },
        );
    }

    /** Estado e rotulo de um biscoito conforme o lugar esta fechado ou aberto. */
    rotular(l) {
        const b = this.botao(l);
        const aberto = !!this.lugares[l];
        if (b.dataset.estado !== 'quebrando') b.dataset.estado = aberto ? 'aberto' : 'fechado';
        b.setAttribute('aria-label', aberto ? TEXTO.aberto(l) : TEXTO.fechado(l));
    }

    atualizarDica() {
        this.querySelector('[data-dica]').textContent = this.lugares.every(Boolean) ? TEXTO.dicaReler : TEXTO.dicaQuebrar;
    }

    pintar(item, l) {
        this.querySelector('[data-selo]').textContent = TEXTO.selo(l);
        this.querySelector('[data-frase]').textContent = item.texto;
        this.querySelector('[data-numeros]').innerHTML = item.numeros
            .map((n, i) => `<li class="bsc-ficha" style="--i:${i}"><span aria-hidden="true">${formatarNumeros([n])}</span><span class="sr">${n}</span></li>`)
            .join('');
    }

    anunciar(texto) {
        const el = this.querySelector('[data-anuncio]');
        clearTimeout(this.tAnuncio);
        el.textContent = '';
        this.tAnuncio = setTimeout(() => { el.textContent = texto; }, 50); // limpar antes faz repetir o mesmo texto ser lido de novo
    }

    /** Mostra a tirinha do biscoito aberto no lugar `l` e o destaca. Nao sorteia nada. */
    selecionar(l, { anunciar = true, fade = true } = {}) {
        const item = this.lugares[l];
        if (!item) return;
        this.sel = l;
        this.item = item;
        this.pintar(item, l);
        this.querySelectorAll('.bsc-bisc').forEach((b) => {
            if (Number(b.dataset.lugar) === l) b.setAttribute('aria-current', 'true');
            else b.removeAttribute('aria-current');
        });
        this.bsc.removeAttribute('data-vazio');
        this.querySelector('.bsc-tirinha').removeAttribute('aria-hidden');
        const corpo = this.querySelector('.bsc-baixo-corpo');
        corpo.classList.remove('bsc-troca');
        if (fade) {
            void corpo.offsetWidth; // reinicia o fade se a pessoa trocou rapido
            corpo.classList.add('bsc-troca');
        }
        if (anunciar) this.anunciar(anuncioDoBiscoito(item, l, false));
    }

    mostrarErro(mostrar) {
        const erro = this.querySelector('.bsc-erro');
        erro.hidden = !mostrar;
        if (mostrar) this.bsc.setAttribute('data-erro', '');
        else this.bsc.removeAttribute('data-erro');
    }

    /** Toque num biscoito: fechado quebra; aberto so passa a mostrar a mensagem dele. */
    tocar(l, e) {
        this.tsInicio = e.timeStamp;
        if (this.bsc.hasAttribute('data-anima')) this.finalizar(); // pula a animacao que estiver em andamento
        if (this.ocupado) return; // esperando as frases chegarem
        if (this.lugares[l]) {
            this.mostrarErro(false);
            this.selecionar(l);
            return;
        }
        this.pedir(l);
    }

    /** Espera as frases, se precisar, e quebra o biscoito do lugar `l`. */
    async pedir(l) {
        if (this.ocupado || this.lugares[l]) return;
        this.ocupado = true;
        this.pendente = l;
        this.mostrarErro(false);
        const data = this.data;
        if (!this.lista) {
            const dica = this.querySelector('[data-dica]');
            const alvo = this.botao(l).querySelector('.bsc-b-fechado');
            this.bsc.setAttribute('aria-busy', 'true');
            dica.textContent = TEXTO.preparando;
            alvo.classList.remove('bsc-espera');
            void alvo.offsetWidth; // reinicia o tremor se a pessoa tocou de novo
            alvo.classList.add('bsc-espera');
            let lista = null;
            try {
                lista = await esperarAte(carregarBiscoito(), LIMITE_ESPERA);
            } catch (e) {
                lista = null;
            }
            if (!this.isConnected || this.data !== data) return; // a tela mudou (ou o dia virou) enquanto esperava
            this.bsc.setAttribute('aria-busy', 'false');
            alvo.classList.remove('bsc-espera');
            this.atualizarDica();
            if (!lista) {
                this.ocupado = false;
                this.mostrarErro(true);
                this.querySelector('[data-acao="tentar"]').focus({ preventScroll: true });
                return;
            }
            this.lista = lista;
        }
        this.romper(l);
    }

    /** Sorteia, guarda e roda a animacao (ou o fade unico, com movimento reduzido). */
    romper(l) {
        const r = quebrarDia(this.lista, l, this.data);
        this.ocupado = false;
        if (!r) return;
        this.lugares[l] = r.item;

        this.limparTempos();
        this.bsc.removeAttribute('data-pulado');
        const botao = this.botao(l);
        botao.dataset.estado = 'quebrando';
        this.rotular(l);
        this.selecionar(l, { anunciar: false, fade: false });
        this.querySelector('.bsc-tirinha').setAttribute('aria-hidden', 'true'); // durante a animacao quem le e o aviso abaixo
        this.anunciar(anuncioDoBiscoito(r.item, l, true));
        this.atualizarDica();
        this.bsc.removeAttribute('data-anima');
        void this.bsc.offsetWidth; // recomeca as animacoes da tirinha do zero
        this.bsc.setAttribute('data-anima', '');
        this.dispatchEvent(new CustomEvent('biscoito-quebrado', { bubbles: true, detail: { item: r.item, lugar: l } }));

        if (reduzMovimento()) {
            this.tReduz = setTimeout(() => this.finalizar(), 220);
            return;
        }
        this.tVibra = setTimeout(() => {
            try {
                if ('vibrate' in navigator) navigator.vibrate(15);
            } catch (e) {
                /* sem vibracao: o tremor visual ja deu o retorno */
            }
        }, ESPERA_VIBRA);
        // o ultimo bloco a surgir (as acoes) termina a animacao
        const alvo = this.querySelector('.bsc-acoes');
        this.fimAlvo = alvo;
        this.aoFimAnimacao = (e) => { if (e.target === alvo) this.finalizar(); };
        alvo.addEventListener('animationend', this.aoFimAnimacao);
        this.tFim = setTimeout(() => this.finalizar(), SEGURANCA);
    }

    /** Animacao encerrada (ou pulada): estado final, tirinha acessivel de novo e o aviso apagado (para nao ler duas vezes). */
    finalizar() {
        if (!this.bsc.hasAttribute('data-anima')) return;
        this.limparTempos();
        this.bsc.removeAttribute('data-anima');
        this.querySelectorAll('.bsc-bisc[data-estado="quebrando"]').forEach((b) => { b.dataset.estado = 'aberto'; });
        this.querySelector('.bsc-tirinha').removeAttribute('aria-hidden');
        this.querySelector('[data-anuncio]').textContent = '';
    }

    async copiar() {
        if (!this.item) return;
        const ok = await copiarTexto(textoParaCopiar(this.item));
        avisar(ok ? TEXTO.copiado : TEXTO.naoCopiou, { erro: !ok });
    }

    compartilhar() {
        if (!this.item) return;
        const dados = { item: this.item, data: this.data };
        // a imagem so e montada agora, sob demanda: o modulo nem e baixado antes do clique
        import('../utils/cartaoBiscoito.js').then((m) => m.abrirCartaoBiscoito(dados));
    }
}

customElements.define('biscoito-screen', BiscoitoScreen);
