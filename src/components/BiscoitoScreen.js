import { carregarBiscoito, limparCache, formatarNumeros, anuncioDaQuebra, textoParaCopiar, copiarTexto } from '../utils/biscoito.js';
import { lerHoje, quebrar as quebrarDia } from '../utils/biscoitoDia.js';
import { dataLocal } from '../utils/cartaDoDia.js';
import { SVG_INTEIRO, SVG_METADE_ESQ, SVG_METADE_DIR } from '../utils/biscoitoArte.js';
import { ic } from '../utils/glifos.js';
import { avisar, reduzMovimento } from './Sobreposicao.js';

const TEXTO = {
    titulo: 'Biscoito da sorte',
    lead: 'Uma frase curta e seis números, só por diversão.',
    dica: 'Toque no biscoito para quebrar.',
    preparando: 'Preparando o biscoito…',
    rotuloBiscoito: 'Biscoito da sorte, fechado. Toque para quebrar.',
    seloPrimeiro: 'Biscoito de hoje',
    seloExtra: 'Mais um biscoito',
    rotuloNumeros: 'Seus números da sorte',
    nota: 'Só por diversão.',
    copiar: 'Copiar',
    compartilhar: 'Compartilhar',
    outro: 'Quebrar outro',
    resta: (n) => `Você ainda pode quebrar mais ${n} hoje.`,
    esgotado: 'Por hoje, os biscoitos acabaram. Volte amanhã.',
    copiado: 'Texto copiado.',
    naoCopiou: 'Não foi possível copiar.',
    erro: 'Não foi possível abrir o biscoito agora.',
    tentar: 'Tentar de novo',
};

const LIMITE_ESPERA = 8000; // ms esperando as frases chegarem depois do toque
const ESPERA_VIBRA = 180; // ms do toque ate a troca do inteiro pelas metades
const SEGURANCA = 3300; // ms: a animacao dura cerca de 3 s; isto encerra se o evento nao vier

const esperarAte = (promessa, ms) =>
    new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('biscoito: demorou')), ms);
        promessa.then(
            (v) => { clearTimeout(t); resolve(v); },
            (e) => { clearTimeout(t); reject(e); },
        );
    });

/**
 * Biscoito da sorte: um biscoito fechado que a pessoa toca para quebrar. A frase e sorteada no instante do toque
 * (biscoitoDia.js guarda o que saiu hoje), e as frases so sao baixadas quando a tela precisa delas.
 * Estados em data-estado: fechado | quebrando | aberto. O estado final e o estado base do CSS.
 */
export class BiscoitoScreen extends HTMLElement {
    connectedCallback() {
        this.aoVoltar = () => {
            // a pessoa deixou a aba aberta e o dia virou: volta ao biscoito fechado
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
        if (this.aoFimAnimacao && this.fimAlvo) this.fimAlvo.removeEventListener('animationend', this.aoFimAnimacao);
        this.aoFimAnimacao = null;
        this.fimAlvo = null;
    }

    montar() {
        this.limparTempos();
        this.data = dataLocal();
        this.ocupado = false;
        this.item = null;
        const { itens, restantes } = lerHoje(this.data);
        this.restantes = restantes;

        this.innerHTML = `
            <section class="bsc" data-estado="fechado" aria-busy="false">
                <p class="bsc-lead">${TEXTO.lead}</p>

                <div class="bsc-palco">
                    <button type="button" class="bsc-inteiro" aria-describedby="bsc-dica" aria-label="${TEXTO.rotuloBiscoito}">${SVG_INTEIRO}</button>
                    <div class="bsc-metades" aria-hidden="true">
                        <span class="bsc-metade bsc-m-e">${SVG_METADE_ESQ}</span><span class="bsc-metade bsc-m-d">${SVG_METADE_DIR}</span>
                    </div>
                    <div class="bsc-chao" aria-hidden="true"></div>
                </div>
                <p class="bsc-dica" id="bsc-dica">${TEXTO.dica}</p>

                <div class="bsc-baixo">
                    <div class="bsc-baixo-corpo">
                        <div class="bsc-papel">
                            <article class="bsc-tirinha">
                                <p class="bsc-selo" data-selo>${TEXTO.seloPrimeiro}</p>
                                <p class="bsc-frase" data-frase></p>
                                <p class="bsc-rotulo">${TEXTO.rotuloNumeros}</p>
                                <ol class="bsc-numeros" aria-label="${TEXTO.rotuloNumeros}" data-numeros></ol>
                            </article>
                        </div>
                        <p class="bsc-nota">${TEXTO.nota}</p>
                        <div class="bsc-acoes">
                            <button type="button" class="btn btn-primary" data-acao="copiar">${ic('copiar')}${TEXTO.copiar}</button>
                            <button type="button" class="btn btn-ghost" data-acao="compartilhar">${ic('compartilhar')}${TEXTO.compartilhar}</button>
                        </div>
                        <div class="bsc-mais">
                            <button type="button" class="btn btn-ghost" data-acao="outro">${TEXTO.outro}</button>
                            <p class="bsc-resta" data-resta></p>
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
        this.querySelector('.bsc-inteiro').addEventListener('click', (e) => {
            this.tsInicio = e.timeStamp;
            this.pedir();
        });
        this.querySelector('[data-acao="outro"]').addEventListener('click', (e) => {
            this.tsInicio = e.timeStamp;
            this.pedir();
        });
        this.querySelector('[data-acao="tentar"]').addEventListener('click', (e) => {
            this.tsInicio = e.timeStamp;
            limparCache();
            this.lista = null;
            this.pedir();
        });
        this.querySelector('[data-acao="copiar"]').addEventListener('click', () => this.copiar());
        this.querySelector('[data-acao="compartilhar"]').addEventListener('click', () => this.compartilhar());
        // um toque em qualquer ponto durante a animacao leva tudo ao fim
        this.bsc.addEventListener('click', (e) => {
            if (this.bsc.dataset.estado !== 'quebrando' || e.timeStamp === this.tsInicio) return;
            this.bsc.setAttribute('data-pulado', '');
            this.finalizar();
        });

        if (itens.length) {
            // ja abriu hoje: abre direto no resultado, sem animacao e sem baixar as frases
            this.item = itens[itens.length - 1];
            this.pintar(this.item, itens.length);
            this.definirEstado('aberto');
        } else {
            this.definirEstado('fechado');
            this.precarregar();
        }
        this.atualizarMais();
    }

    /** As frases comecam a chegar ja ao abrir a tela, para estarem prontas antes do toque. */
    precarregar() {
        if (this.restantes <= 0) return;
        carregarBiscoito().then(
            (lista) => { if (this.isConnected) this.lista = lista; },
            () => { /* o erro so aparece quando a pessoa tenta quebrar */ },
        );
    }

    definirEstado(estado) {
        this.bsc.dataset.estado = estado;
        this.querySelector('.bsc-inteiro').inert = estado !== 'fechado';
    }

    pintar(item, indice) {
        this.querySelector('[data-selo]').textContent = indice === 1 ? TEXTO.seloPrimeiro : TEXTO.seloExtra;
        this.querySelector('[data-frase]').textContent = item.texto;
        this.querySelector('[data-numeros]').innerHTML = item.numeros
            .map((n, i) => `<li class="bsc-ficha" style="--i:${i}"><span aria-hidden="true">${formatarNumeros([n])}</span><span class="sr">${n}</span></li>`)
            .join('');
    }

    atualizarMais() {
        const botao = this.querySelector('[data-acao="outro"]');
        botao.hidden = this.restantes <= 0;
        this.querySelector('[data-resta]').textContent = this.restantes > 0 ? TEXTO.resta(this.restantes) : TEXTO.esgotado;
    }

    mostrarErro(mostrar) {
        const erro = this.querySelector('.bsc-erro');
        erro.hidden = !mostrar;
        if (mostrar) this.bsc.setAttribute('data-erro', '');
        else this.bsc.removeAttribute('data-erro');
    }

    /** Toque no biscoito (ou em "Quebrar outro"): espera as frases, se precisar, e quebra. */
    async pedir() {
        if (this.ocupado || this.bsc.dataset.estado === 'quebrando' || this.restantes <= 0) return;
        this.ocupado = true;
        this.mostrarErro(false);
        const data = this.data;
        if (!this.lista) {
            const dica = this.querySelector('.bsc-dica');
            const outro = this.querySelector('[data-acao="outro"]');
            const textoOutro = outro.textContent;
            this.bsc.setAttribute('aria-busy', 'true');
            const emFechado = this.bsc.dataset.estado === 'fechado';
            if (emFechado) {
                dica.textContent = TEXTO.preparando;
                const inteiro = this.querySelector('.bsc-inteiro');
                inteiro.classList.remove('bsc-espera');
                void inteiro.offsetWidth; // reinicia o tremor se a pessoa tocou de novo
                inteiro.classList.add('bsc-espera');
            } else {
                outro.firstChild.textContent = TEXTO.preparando;
            }
            let lista = null;
            try {
                lista = await esperarAte(carregarBiscoito(), LIMITE_ESPERA);
            } catch (e) {
                lista = null;
            }
            if (!this.isConnected || this.data !== data) return; // a tela mudou (ou o dia virou) enquanto esperava
            this.bsc.setAttribute('aria-busy', 'false');
            dica.textContent = TEXTO.dica;
            outro.firstChild.textContent = textoOutro;
            this.querySelector('.bsc-inteiro').classList.remove('bsc-espera');
            if (!lista) {
                this.falhou();
                return;
            }
            this.lista = lista;
        }
        this.romper();
    }

    falhou() {
        this.ocupado = false;
        this.mostrarErro(true);
        this.querySelector('[data-acao="tentar"]').focus({ preventScroll: true });
    }

    /** Sorteia, guarda e roda a animacao (ou o fade unico, com movimento reduzido). */
    romper() {
        const r = quebrarDia(this.lista, this.data);
        this.ocupado = false;
        if (!r) {
            this.restantes = 0;
            this.atualizarMais();
            return;
        }
        this.restantes = r.restantes;
        this.item = r.item;
        const tinhaFoco = this.contains(document.activeElement);

        this.limparTempos();
        this.bsc.removeAttribute('data-pulado');
        if (this.bsc.dataset.estado !== 'fechado') {
            this.definirEstado('fechado'); // recomeca a animacao do zero
            void this.bsc.offsetWidth;
        }
        this.pintar(r.item, r.indice);
        this.atualizarMais();
        this.querySelector('.bsc-tirinha').setAttribute('aria-hidden', 'true');
        this.querySelector('[data-anuncio]').textContent = anuncioDaQuebra(r.item);
        this.definirEstado('quebrando');
        if (tinhaFoco) this.querySelector('[data-acao="copiar"]').focus({ preventScroll: true });
        this.dispatchEvent(new CustomEvent('biscoito-quebrado', { bubbles: true, detail: { item: r.item } }));

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
        // o ultimo bloco a surgir (acoes, "quebrar outro" e nota, juntos) termina a animacao
        const alvo = this.querySelector('.bsc-mais');
        this.fimAlvo = alvo;
        this.aoFimAnimacao = (e) => { if (e.target === alvo) this.finalizar(); };
        alvo.addEventListener('animationend', this.aoFimAnimacao);
        this.tFim = setTimeout(() => this.finalizar(), SEGURANCA);
    }

    /** Animacao encerrada (ou pulada): estado final, tirinha acessivel de novo e o anuncio apagado (para nao ler duas vezes). */
    finalizar() {
        if (this.bsc.dataset.estado !== 'quebrando') return;
        this.limparTempos();
        this.querySelector('.bsc-tirinha').removeAttribute('aria-hidden');
        this.querySelector('[data-anuncio]').textContent = '';
        this.definirEstado('aberto');
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
