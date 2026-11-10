import { loadCards } from '../utils/cardsUtil.js';
import { escaparHtml } from '../utils/glossario.js';
import { dataLocal } from '../utils/cartaDoDia.js';
import { navigateTo } from '../utils/navigation.js';
import {
    listar, salvarNota, apagarEntrada, apagarTudo, exportar, importar, persiste, aoMudar,
    consumirFoco, consumirAviso, LIMITE_NOTA, LIMITE_ARQUIVO,
} from '../utils/diario.js';
import('./TarotCardInfo.js');

const TEXTO = {
    titulo: 'Diário',
    sub: 'O que cada carta despertou, guardado com data.',
    privado: 'Suas anotações ficam só neste aparelho.',
    semArmazenamento: 'Este navegador não deixa guardar dados. Suas anotações valem só enquanto esta página estiver aberta.',
    tipoDia: 'Carta do dia',
    tipoLeitura: 'Leitura de 3 cartas',
    tipoMapa: 'Mapa astral',
    rotuloNotaMapa: 'O que esse mapa despertou',
    pergunta: 'Pergunta:',
    rotuloNotaDia: 'O que essa carta despertou',
    rotuloNotaLeitura: 'O que essa leitura despertou',
    dica: 'Anote o que veio à mente.',
    salvando: 'Salvando...',
    salvo: 'Salvo neste aparelho',
    falha: 'Não foi possível salvar',
    limiteAtingido: 'Limite atingido',
    apagar: 'Apagar',
    apagarPergunta: 'Apagar esta entrada e a anotação?',
    apagarSim: 'Apagar entrada',
    manter: 'Manter',
    maisUm: 'Mostrar mais',
    vazioTitulo: 'Seu diário está em branco',
    vazioTexto: 'Cada carta que você guardar aparece aqui, com o que ela despertou. Comece pela carta de hoje ou por uma leitura.',
    irDia: 'Tirar a carta do dia',
    irLeitura: 'Fazer uma Leitura',
    exportar: 'Exportar diário',
    importar: 'Importar diário',
    apagarTudo: 'Apagar todo o diário',
    apagarTudoPergunta: 'Apagar todo o diário?',
    apagarTudoTexto: 'Todas as entradas e anotações do diário serão apagadas deste aparelho. A carta do dia e a semana em estrelas não são apagadas. Não dá para desfazer.',
    apagarTudoAntigo: 'Apagar também as leituras do histórico antigo, guardadas antes do diário',
    apagarTudoSim: 'Sim, apagar todo o diário',
    cancelar: 'Cancelar',
    voltar: 'Voltar',
    exportado: 'Backup baixado. Guarde o arquivo em um lugar seguro.',
    apagado: 'Diário apagado.',
    cartaSem: 'Carta',
};

const POS = { passado: 'Passado', presente: 'Presente', futuro: 'Futuro', sol: 'Sol', lua: 'Lua', asc: 'Ascendente' };
const ESPERA = 800; // ms de pausa na digitacao antes de salvar
const PAGINA = 50;
const PERTO_DO_LIMITE = 1800;

const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

const mais = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function dataLegivel(e) {
    if (e.rotulo && e.t.startsWith('2000-01-01')) return e.rotulo; // leitura antiga sem data que o navegador entenda
    if (e.tipo === 'dia' && /^dia-\d{4}-\d{2}-\d{2}$/.test(e.id)) {
        const [a, m, dia] = e.id.slice(4).split('-').map(Number);
        return fmtDia.format(new Date(a, m - 1, dia, 12));
    }
    const d = new Date(e.t);
    return `${fmtDia.format(d)}, ${fmtHora.format(d)}`;
}

/** O Diario: linha do tempo de cartas do dia e leituras, cada uma com uma area de nota (autosave). */
export class HistoryScreen extends HTMLElement {
    async connectedCallback() {
        this.nos = new Map(); // id -> { li, json, capa }
        this.sujas = new Map(); // id -> timer de salvamento pendente
        this.visiveis = PAGINA;
        this.cartas = new Map();
        this.local = false;

        this.innerHTML = `
            <section class="diario" aria-label="${TEXTO.titulo}">
                <header class="diario-topo">
                    <p class="diario-sub">${TEXTO.sub}</p>
                    <p class="diario-privado"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/></svg><span>${TEXTO.privado}</span></p>
                    <p class="diario-contagem" data-contagem></p>
                </header>
                <p class="diario-aviso" role="status" aria-live="polite" data-aviso></p>
                <div class="diario-ferramentas">
                    <button type="button" class="btn btn-ghost" data-acao="exportar">${TEXTO.exportar}</button>
                    <button type="button" class="btn btn-ghost" data-acao="importar">${TEXTO.importar}</button>
                    <button type="button" class="btn btn-ghost" data-acao="apagar-tudo" aria-expanded="false" aria-controls="diario-confirma">${TEXTO.apagarTudo}</button>
                    <input type="file" accept="application/json,.json" hidden data-arquivo>
                </div>
                <div class="diario-confirma panel-card" id="diario-confirma" role="group" aria-labelledby="diario-confirma-t" hidden>
                    <h3 id="diario-confirma-t">${TEXTO.apagarTudoPergunta}</h3>
                    <p>${TEXTO.apagarTudoTexto}</p>
                    <label class="diario-marca"><input type="checkbox" data-antigo><span>${TEXTO.apagarTudoAntigo}</span></label>
                    <div class="btn-row">
                        <button type="button" class="btn btn-ghost" data-acao="cancelar-tudo">${TEXTO.cancelar}</button>
                        <button type="button" class="btn btn-perigo" data-acao="confirmar-tudo">${TEXTO.apagarTudoSim}</button>
                    </div>
                </div>
                <p class="diario-resumo" role="status" aria-live="polite" data-resumo></p>
                <div class="diario-vazio panel-card" data-vazio hidden>
                    <h3>${TEXTO.vazioTitulo}</h3>
                    <p>${TEXTO.vazioTexto}</p>
                    <div class="btn-row">
                        <button type="button" class="btn btn-primary" data-ir="home">${TEXTO.irDia}</button>
                        <button type="button" class="btn btn-ghost" data-ir="three-card-game">${TEXTO.irLeitura}</button>
                    </div>
                </div>
                <ol class="diario-lista" data-lista></ol>
                <div class="diario-mais" data-mais hidden><button type="button" class="btn btn-ghost" data-acao="mais">${TEXTO.maisUm}</button></div>
                <div class="screen-actions"><button type="button" class="btn btn-ghost" data-ir="home">${TEXTO.voltar}</button></div>
            </section>
        `;
        document.querySelector('#page-title').textContent = TEXTO.titulo;

        this.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => navigateTo(b.dataset.ir)));
        this.ligarFerramentas();

        try {
            const lista = await loadCards();
            lista.forEach((c) => this.cartas.set(Number(c.order), c));
        } catch (e) {
            /* sem os dados das cartas o diario ainda mostra "Carta N" */
        }
        if (!this.isConnected) return;

        if (!persiste()) this.querySelector('[data-aviso]').textContent = TEXTO.semArmazenamento;
        const aviso = consumirAviso();
        if (aviso) this.querySelector('[data-aviso]').textContent = aviso;

        this.desligar = aoMudar(() => {
            if (!this.local) this.reconciliar();
        });
        this.aoSair = () => {
            if (document.hidden) this.salvarTudo();
        };
        document.addEventListener('visibilitychange', this.aoSair);
        window.addEventListener('pagehide', this.aoSair);
        this.reconciliar();

        const foco = consumirFoco();
        if (foco) this.focarNota(foco);
    }

    disconnectedCallback() {
        this.salvarTudo(); // ao sair da tela nada fica pendente
        if (this.desligar) this.desligar();
        document.removeEventListener('visibilitychange', this.aoSair);
        window.removeEventListener('pagehide', this.aoSair);
    }

    /* ---------- lista ---------- */

    reconciliar() {
        const todas = listar();
        const ul = this.querySelector('[data-lista]');
        const fatia = todas.slice(0, this.visiveis);
        const ids = new Set(fatia.map((e) => e.id));

        for (const [id, r] of this.nos) {
            if (!ids.has(id)) {
                r.li.remove();
                this.nos.delete(id);
                this.limparTimer(id);
            }
        }
        let anterior = null;
        for (const e of fatia) {
            const json = JSON.stringify(e);
            let r = this.nos.get(e.id);
            if (r && r.json !== json) {
                const ta = r.li.querySelector('textarea');
                if (JSON.stringify({ ...e, nota: '', m: '' }) === r.capa && ta) {
                    // so a nota mudou (outra aba): atualiza no lugar, sem tirar o foco, a menos que esta aba tenha texto pendente
                    if (!this.sujas.has(e.id)) {
                        ta.value = e.nota;
                        this.contar(r.li);
                        r.json = json;
                    }
                } else if (!this.sujas.has(e.id)) {
                    const novo = this.criarItem(e);
                    r.li.replaceWith(novo.li);
                    r = novo;
                    this.nos.set(e.id, r);
                }
            } else if (!r) {
                r = this.criarItem(e);
                this.nos.set(e.id, r);
                ul.insertBefore(r.li, anterior ? anterior.nextSibling : ul.firstChild);
            }
            anterior = r.li;
        }

        const total = todas.length;
        this.querySelector('[data-contagem]').textContent = total ? mais(total, 'registro neste aparelho', 'registros neste aparelho') : '';
        this.querySelector('[data-vazio]').hidden = total > 0;
        const resto = total - fatia.length;
        const caixa = this.querySelector('[data-mais]');
        caixa.hidden = resto <= 0;
        caixa.querySelector('button').textContent = `${TEXTO.maisUm} (${resto})`;
    }

    criarItem(e) {
        const li = document.createElement('li');
        li.className = 'diario-item';
        li.dataset.id = e.id;
        const leitura = e.tipo === 'leitura';
        const mapa = e.tipo === 'mapa';
        const idNota = `nota-${e.id}`;
        const idTit = `tit-${e.id}`;
        const quando = escaparHtml(dataLegivel(e));
        const minis = e.cartas
            .map((c) => {
                const carta = this.cartas.get(c.order);
                const nome = carta ? carta.name : `${TEXTO.cartaSem} ${c.order}`;
                const arq = String(c.order).padStart(2, '0');
                return `<li class="diario-carta">
                    ${c.pos ? `<span class="diario-pos">${POS[c.pos]}</span>` : ''}
                    <button type="button" class="diario-mini" data-order="${c.order}" ${carta ? '' : 'disabled'}>
                        <img src="assets/cards/crowley-${arq}.jpg" alt="" width="64" height="96" loading="lazy" decoding="async">
                        <span class="diario-nome">${escaparHtml(nome)}</span>
                    </button>
                </li>`;
            })
            .join('');
        li.innerHTML = `
            <article class="diario-cartao" aria-labelledby="${idTit}">
                <header class="diario-cab">
                    <div>
                        <h2 class="diario-data" id="${idTit}" tabindex="-1">${quando}</h2>
                        <p class="diario-tipo">${leitura ? TEXTO.tipoLeitura : mapa ? TEXTO.tipoMapa : TEXTO.tipoDia}${mapa && e.rotulo ? ` (${escaparHtml(e.rotulo)})` : ''}</p>
                    </div>
                    <button type="button" class="btn btn-ghost diario-apagar" data-acao="apagar" aria-expanded="false" aria-label="${TEXTO.apagar}: ${quando}">${TEXTO.apagar}</button>
                </header>
                ${e.pergunta ? `<p class="diario-pergunta"><span class="diario-pergunta-rotulo">${TEXTO.pergunta}</span> <q>${escaparHtml(e.pergunta)}</q></p>` : ''}
                <ul class="diario-cartas${leitura || mapa ? ' tres' : ''}">${minis}</ul>
                <div class="diario-nota">
                    <label for="${idNota}">${leitura ? TEXTO.rotuloNotaLeitura : mapa ? TEXTO.rotuloNotaMapa : TEXTO.rotuloNotaDia}</label>
                    <textarea id="${idNota}" rows="3" maxlength="${LIMITE_NOTA}" placeholder="${TEXTO.dica}" aria-describedby="${idNota}-estado"></textarea>
                    <div class="diario-rodape">
                        <p class="diario-estado" id="${idNota}-estado" role="status" aria-live="polite" data-estado></p>
                        <p class="diario-contador" data-contador hidden></p>
                    </div>
                </div>
                <div class="diario-conf" data-conf hidden role="group" aria-label="${TEXTO.apagarPergunta}">
                    <p>${TEXTO.apagarPergunta}</p>
                    <div class="btn-row">
                        <button type="button" class="btn btn-ghost" data-acao="manter">${TEXTO.manter}</button>
                        <button type="button" class="btn btn-perigo" data-acao="apagar-sim">${TEXTO.apagarSim}</button>
                    </div>
                </div>
            </article>`;
        const ta = li.querySelector('textarea');
        ta.value = e.nota;
        this.contar(li);

        ta.addEventListener('input', () => {
            this.contar(li);
            this.estado(li, 'salvando');
            this.limparTimer(e.id);
            this.sujas.set(e.id, setTimeout(() => this.salvar(e.id), ESPERA));
        });
        ta.addEventListener('blur', () => {
            if (this.sujas.has(e.id)) this.salvar(e.id);
        });
        li.querySelectorAll('.diario-mini').forEach((b) =>
            b.addEventListener('click', () => {
                const info = document.querySelector('tarot-card-info');
                const carta = this.cartas.get(Number(b.dataset.order));
                if (info && info.showInfo && carta) info.showInfo(carta, b);
            })
        );
        li.querySelector('[data-acao="apagar"]').addEventListener('click', () => this.pedirApagar(li, true));
        li.querySelector('[data-acao="manter"]').addEventListener('click', () => this.pedirApagar(li, false));
        li.querySelector('[data-acao="apagar-sim"]').addEventListener('click', () => this.apagar(e.id, li));

        return { li, json: JSON.stringify(e), capa: JSON.stringify({ ...e, nota: '', m: '' }) };
    }

    /* ---------- nota: autosave ---------- */

    contar(li) {
        const n = Math.min(li.querySelector('textarea').value.length, LIMITE_NOTA);
        const c = li.querySelector('[data-contador]');
        c.hidden = n < PERTO_DO_LIMITE;
        c.textContent = n >= LIMITE_NOTA ? `${TEXTO.limiteAtingido}: ${n}/${LIMITE_NOTA}` : `${n}/${LIMITE_NOTA}`;
        c.classList.toggle('no-limite', n >= LIMITE_NOTA);
    }

    estado(li, qual) {
        const p = li.querySelector('[data-estado]');
        p.textContent = qual === 'salvando' ? TEXTO.salvando : qual === 'salvo' ? TEXTO.salvo : TEXTO.falha;
        p.dataset.estado = qual;
    }

    limparTimer(id) {
        clearTimeout(this.sujas.get(id));
        this.sujas.delete(id);
    }

    salvar(id) {
        const r = this.nos.get(id);
        this.limparTimer(id);
        if (!r) return;
        this.local = true; // a propria gravacao nao deve redesenhar a lista
        let resultado;
        try {
            resultado = salvarNota(id, r.li.querySelector('textarea').value);
        } finally {
            this.local = false;
        }
        this.estado(r.li, resultado.ok ? 'salvo' : 'falha');
        const atual = listar().find((e) => e.id === id);
        if (atual) r.json = JSON.stringify(atual);
    }

    salvarTudo() {
        for (const id of [...this.sujas.keys()]) this.salvar(id);
    }

    focarNota(id) {
        const r = this.nos.get(id);
        if (!r) return;
        const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
        r.li.scrollIntoView({ block: 'center', behavior: reduz ? 'auto' : 'smooth' });
        r.li.querySelector('textarea').focus({ preventScroll: true });
    }

    /* ---------- apagar entrada ---------- */

    pedirApagar(li, abrir) {
        const conf = li.querySelector('[data-conf]');
        const botao = li.querySelector('[data-acao="apagar"]');
        conf.hidden = !abrir;
        botao.setAttribute('aria-expanded', String(abrir));
        (abrir ? conf.querySelector('[data-acao="manter"]') : botao).focus();
    }

    apagar(id, li) {
        const proximo = li.nextElementSibling || li.previousElementSibling;
        this.limparTimer(id);
        this.local = true;
        try {
            apagarEntrada(id);
        } finally {
            this.local = false;
        }
        this.reconciliar();
        const alvo = proximo && proximo.querySelector('.diario-data');
        (alvo || this.querySelector('[data-acao="exportar"]')).focus();
    }

    /* ---------- exportar, importar, apagar tudo ---------- */

    resumo(texto) {
        this.querySelector('[data-resumo]').textContent = texto;
    }

    ligarFerramentas() {
        const confirma = this.querySelector('#diario-confirma');
        const abrirTudo = this.querySelector('[data-acao="apagar-tudo"]');
        const arquivo = this.querySelector('[data-arquivo]');

        this.querySelector('[data-acao="exportar"]').addEventListener('click', () => {
            this.salvarTudo();
            try {
                const blob = new Blob([JSON.stringify(exportar(), null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `aeon-diario-${dataLocal()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                this.resumo(TEXTO.exportado);
            } catch (e) {
                this.resumo('Não foi possível gerar o backup.');
            }
        });

        this.querySelector('[data-acao="importar"]').addEventListener('click', () => arquivo.click());
        arquivo.addEventListener('change', async () => {
            const f = arquivo.files && arquivo.files[0];
            arquivo.value = '';
            if (!f) return;
            if (f.size > LIMITE_ARQUIVO) {
                this.resumo('O arquivo passa de 1 MB. Escolha um backup do diário.');
                return;
            }
            let texto;
            try {
                texto = await f.text();
            } catch (e) {
                this.resumo('Não foi possível ler o arquivo.');
                return;
            }
            this.salvarTudo();
            const r = importar(texto);
            if (!r.ok && !r.importadas) {
                this.resumo(r.motivo || 'Não foi possível importar.');
                return;
            }
            this.reconciliar();
            this.resumo(`${mais(r.importadas, 'entrada importada', 'entradas importadas')}, ${mais(r.ignoradas, 'ignorada', 'ignoradas')}.${r.ok ? '' : ' Não foi possível guardar neste aparelho.'}`);
            const aviso = consumirAviso();
            if (aviso) this.querySelector('[data-aviso]').textContent = aviso;
        });

        abrirTudo.addEventListener('click', () => {
            confirma.hidden = false;
            abrirTudo.setAttribute('aria-expanded', 'true');
            confirma.querySelector('[data-acao="cancelar-tudo"]').focus();
        });
        const fechar = () => {
            confirma.hidden = true;
            confirma.querySelector('[data-antigo]').checked = false;
            abrirTudo.setAttribute('aria-expanded', 'false');
            abrirTudo.focus();
        };
        confirma.querySelector('[data-acao="cancelar-tudo"]').addEventListener('click', fechar);
        confirma.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') fechar();
        });
        confirma.querySelector('[data-acao="confirmar-tudo"]').addEventListener('click', () => {
            for (const id of [...this.sujas.keys()]) this.limparTimer(id);
            this.local = true;
            try {
                apagarTudo({ tambemAntigo: confirma.querySelector('[data-antigo]').checked });
            } finally {
                this.local = false;
            }
            this.reconciliar();
            fechar();
            this.resumo(TEXTO.apagado);
        });

        this.querySelector('[data-acao="mais"]').addEventListener('click', () => {
            const antes = this.nos.size;
            this.visiveis += PAGINA;
            this.reconciliar();
            const novo = this.querySelectorAll('.diario-item')[antes];
            if (novo) novo.querySelector('.diario-data').focus();
        });
    }
}

customElements.define('history-screen', HistoryScreen);
