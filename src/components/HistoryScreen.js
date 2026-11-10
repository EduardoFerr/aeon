import { loadCards } from '../utils/cardsUtil.js';
import { escaparHtml } from '../utils/glossario.js';
import { dataLocal } from '../utils/cartaDoDia.js';
import { navigateTo } from '../utils/navigation.js';
import { ic } from '../utils/glifos.js';
import { abrir, avisar } from './Sobreposicao.js';
import {
    listar, agruparPorMes, diaDaEntrada, rotuloMes, salvarNota, apagarEntrada, apagarTudo, instantaneo, restaurar, exportar, importar, persiste, aoMudar,
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
    apagar: 'Apagar registro',
    entradaApagada: 'Entrada apagada',
    desfazer: 'Desfazer',
    voltou: 'Entrada de volta no diário',
    manter: 'Manter',
    maisUm: 'Mostrar mais',
    vazioTitulo: 'Seu diário está em branco',
    vazioTexto: 'Cada carta que você guardar aparece aqui, com o que ela despertou.',
    irDia: 'Tirar uma carta',
    semData: 'Sem data',
    exportar: 'Exportar diário',
    exportarCurto: 'Exportar',
    importar: 'Importar diário',
    apagarTudo: 'Apagar todo o diário',
    apagarTudoPergunta: 'Apagar todo o diário?',
    apagarTudoAntigo: 'Apagar também as leituras do histórico antigo, guardadas antes do diário',
    apagarTudoSim: 'Apagar todo o diário',
    acoes: 'Ações',
    acoesTitulo: 'Ações do diário',
    grupoBackup: 'Backup',
    vazioIndisponivel: ', indisponível porque o diário está vazio',
    exportado: 'Diário exportado',
    erroExportar: 'Não foi possível gerar o arquivo do diário.',
    erroTamanho: 'O arquivo passa de 1 MB. Escolha um backup do diário.',
    erroLer: 'Não foi possível ler o arquivo.',
    erroImportar: 'Não foi possível importar.',
    semNovidade: 'Nada novo: as entradas desse arquivo já estavam no diário.',
    apagado: 'Diário apagado',
    voltouTudo: 'Diário de volta',
    cartaSem: 'Carta',
};

const POS = { passado: 'Passado', presente: 'Presente', futuro: 'Futuro', sol: 'Sol', lua: 'Lua', asc: 'Ascendente' };
const ESPERA = 800; // ms de pausa na digitacao antes de salvar
const PAGINA = 50;
const PERTO_DO_LIMITE = 1800;

const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const RE_ID_DIA = /^dia-\d{4}-\d{2}-\d{2}$/;
const DESKTOP = '(min-width: 900px)';
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

const mais = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const textoApagarTudo = (n) => `${n === 1 ? '1 registro será apagado' : `${n} registros serão apagados`} deste aparelho, com as anotações. A carta do dia e a semana em estrelas não são apagadas.`;

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
        this.meses = new Map(); // chave do mes -> { sec, tit, n, ol }
        this.sujas = new Map(); // id -> timer de salvamento pendente
        this.visiveis = PAGINA;
        this.cartas = new Map();
        this.local = false;

        this.innerHTML = `
            <section class="diario" aria-label="${TEXTO.titulo}">
                <header class="diario-topo">
                    <div class="diario-tit">
                        <p class="diario-sub">${TEXTO.sub}</p>
                        <p class="diario-meta"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/></svg><span>${TEXTO.privado}</span><span class="diario-contagem" data-contagem></span></p>
                    </div>
                    <div class="diario-ferr">
                        <button class="btn btn-ghost diario-exportar" type="button" data-exec="exportar">${ic('baixar')}${TEXTO.exportarCurto}</button>
                        <button class="btn btn-ghost" id="abrir-acoes" type="button" aria-haspopup="dialog" aria-expanded="false">${ic('maisv')}${TEXTO.acoes}</button>
                    </div>
                    <input type="file" accept="application/json,.json" hidden data-arquivo>
                </header>
                <p class="diario-aviso" role="status" aria-live="polite" data-aviso></p>
                <div class="diario-vazio" data-vazio hidden>
                    <h2>${TEXTO.vazioTitulo}</h2>
                    <p>${TEXTO.vazioTexto}</p>
                    <button type="button" class="btn btn-primary" data-ir="home">${TEXTO.irDia}</button>
                </div>
                <div class="diario-lista" data-lista></div>
                <div class="diario-mais" data-mais hidden><button type="button" class="btn btn-terciario" data-acao="mais">${TEXTO.maisUm}</button></div>
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
        if (this.sobre && this.sobre.aberto) this.sobre.fechar(false);
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
            }
        }

        this.montarMeses(ul, todas, fatia);

        const total = todas.length;
        this.querySelector('[data-contagem]').textContent = total ? mais(total, 'registro', 'registros') : '';
        this.total = total;
        this.querySelector('.diario-exportar').hidden = total === 0;
        this.querySelector('[data-vazio]').hidden = total > 0;
        const resto = total - fatia.length;
        const caixa = this.querySelector('[data-mais]');
        caixa.hidden = resto <= 0;
        caixa.querySelector('button').textContent = `${TEXTO.maisUm} (${resto})`;
    }

    /** Distribui os cartoes em secoes por mes, mexendo so no que mudou de lugar (o foco do campo de nota fica onde esta). */
    montarMeses(raiz, todas, fatia) {
        const totais = new Map(agruparPorMes(todas).map((g) => [g.chave, g.itens.length]));
        const grupos = agruparPorMes(fatia);
        const secs = [];
        for (const g of grupos) {
            let m = this.meses.get(g.chave);
            if (!m) {
                const sec = document.createElement('section');
                sec.className = 'diario-mes';
                sec.innerHTML = '<h2 class="diario-mes-tit"><span class="diario-mes-nome"></span><span class="diario-mes-n"></span></h2><ol class="diario-mes-lista"></ol>';
                m = { sec, nome: sec.querySelector('.diario-mes-nome'), n: sec.querySelector('.diario-mes-n'), ol: sec.querySelector('ol') };
                this.meses.set(g.chave, m);
            }
            m.nome.textContent = g.chave === 'sem-data' ? TEXTO.semData : rotuloMes(g.ano, g.mes);
            m.n.textContent = mais(totais.get(g.chave) || g.itens.length, 'registro', 'registros');
            colocar(m.ol, g.itens.map((e) => this.nos.get(e.id).li));
            secs.push(m.sec);
        }
        for (const [chave, m] of this.meses) {
            if (!grupos.some((g) => g.chave === chave)) this.meses.delete(chave);
        }
        colocar(raiz, secs);
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
        const d = diaDaEntrada(e);
        const hora = !d.semData && !(e.tipo === 'dia' && RE_ID_DIA.test(e.id)) ? fmtHora.format(new Date(e.t)) : '';
        const tipo = (leitura ? TEXTO.tipoLeitura : mapa ? TEXTO.tipoMapa : TEXTO.tipoDia) + (mapa && e.rotulo ? ` (${escaparHtml(e.rotulo)})` : '');
        const rotuloNota = leitura ? TEXTO.rotuloNotaLeitura : mapa ? TEXTO.rotuloNotaMapa : TEXTO.rotuloNotaDia;
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
                    <div class="diario-dia" aria-hidden="true">${d.semData ? ic('relogio') : `<b>${d.dia}</b><span>${d.semana}</span>`}</div>
                    <div class="diario-ident">
                        <h3 class="diario-data" id="${idTit}" tabindex="-1"><span class="sr">${quando}: </span>${tipo}</h3>
                        ${hora ? `<p class="diario-hora">${hora}</p>` : ''}
                    </div>
                    <button type="button" class="diario-lixo" data-acao="apagar" aria-label="${TEXTO.apagar}" aria-describedby="${idTit}">${ic('lixo')}</button>
                </header>
                ${e.pergunta ? `<p class="diario-pergunta"><span class="sr">${TEXTO.pergunta} </span><q>${escaparHtml(e.pergunta)}</q></p>` : ''}
                <div class="diario-corpo">
                    <ul class="diario-cartas${leitura || mapa ? ' tres' : ''}">${minis}</ul>
                    <div class="diario-nota">
                        <label class="sr" for="${idNota}">${rotuloNota}</label>
                        <textarea id="${idNota}" rows="2" maxlength="${LIMITE_NOTA}" placeholder="${rotuloNota}. ${TEXTO.dica}" aria-describedby="${idNota}-estado"></textarea>
                        <div class="diario-rodape">
                            <p class="diario-estado" id="${idNota}-estado" role="status" aria-live="polite" data-estado></p>
                            <p class="diario-contador" data-contador hidden></p>
                        </div>
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
        li.querySelector('[data-acao="apagar"]').addEventListener('click', () => this.apagar(e.id, li));

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

    apagar(id, li) {
        const proximo = li.nextElementSibling || li.previousElementSibling;
        this.salvarTudo();
        const copia = instantaneo();
        this.limparTimer(id);
        this.local = true;
        try {
            apagarEntrada(id);
        } finally {
            this.local = false;
        }
        this.reconciliar();
        const alvo = proximo && proximo.querySelector('.diario-data');
        (alvo || this.gatilhoAcoes()).focus();
        avisar(TEXTO.entradaApagada, { desfazer: { rotulo: TEXTO.desfazer, aoClicar: () => this.desfazer(copia, TEXTO.voltou) } });
    }

    /** Desfazer de uma exclusao: devolve o diario ao estado de antes e mostra a lista de novo. */
    desfazer(copia, msg) {
        restaurar(copia);
        if (this.isConnected) this.reconciliar();
        avisar(msg);
    }

    /* ---------- menu Acoes: exportar, importar, apagar tudo ---------- */

    /** O botao Acoes: existe em todas as larguras. */
    gatilhoAcoes() {
        return this.querySelector('#abrir-acoes');
    }

    menuHtml() {
        const vazio = !this.total;
        const item = (id, rot, i, perigo, off) => `<button class="sob-acao${perigo ? ' perigo' : ''}" type="button" data-exec="${id}"${off ? ' disabled' : ''}>${ic(i)}${rot}${off ? `<span class="sr">${TEXTO.vazioIndisponivel}</span>` : ''}</button>`;
        return `<nav aria-label="${TEXTO.acoesTitulo}"><p class="sob-grupo">${TEXTO.grupoBackup}</p>${matchMedia(DESKTOP).matches ? '' : item('exportar', TEXTO.exportar, 'baixar', false, vazio)}${item('importar', TEXTO.importar, 'copiar', false, false)}<div class="sob-sep"></div>${item('apagar-tudo', TEXTO.apagarTudo, 'lixo', true, vazio)}</nav>`;
    }

    abrirGaveta(botao) {
        botao.setAttribute('aria-expanded', 'true');
        const c = abrir({ tipo: 'gaveta', titulo: TEXTO.acoesTitulo, gatilho: botao, corpo: this.menuHtml(), aoFechar: () => botao.setAttribute('aria-expanded', 'false') });
        c.corpo.addEventListener('click', (e) => {
            const b = e.target.closest('[data-exec]');
            if (!b || b.disabled) return;
            c.fechar();
            this.executar(b.dataset.exec, botao);
        });
        this.sobre = c;
    }

    executar(id, gatilho) {
        if (id === 'exportar') this.exportarDiario();
        else if (id === 'importar') this.querySelector('[data-arquivo]').click();
        else if (id === 'apagar-tudo') this.confirmarApagarTudo(gatilho);
    }

    exportarDiario() {
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
            avisar(TEXTO.exportado);
        } catch (e) {
            avisar(TEXTO.erroExportar, { erro: true });
        }
    }

    async importarArquivo(arquivo) {
        const f = arquivo.files && arquivo.files[0];
        arquivo.value = '';
        if (!f) return;
        if (f.size > LIMITE_ARQUIVO) return avisar(TEXTO.erroTamanho, { erro: true });
        let texto;
        try {
            texto = await f.text();
        } catch (e) {
            return avisar(TEXTO.erroLer, { erro: true });
        }
        this.salvarTudo();
        const r = importar(texto);
        if (!r.ok && !r.importadas) return avisar(r.motivo || TEXTO.erroImportar, { erro: true });
        this.reconciliar();
        const aviso = consumirAviso();
        if (aviso) this.querySelector('[data-aviso]').textContent = aviso;
        if (!r.ok) return avisar(`${mais(r.importadas, 'entrada importada', 'entradas importadas')}, mas não foi possível guardar neste aparelho.`, { erro: true });
        if (!r.importadas) return avisar(TEXTO.semNovidade);
        const sobra = r.ignoradas ? ` ${mais(r.ignoradas, 'já estava no diário ou não pôde ser lida', 'já estavam no diário ou não puderam ser lidas')}.` : '';
        avisar(`${mais(r.importadas, 'entrada importada', 'entradas importadas')}.${sobra}`);
    }

    confirmarApagarTudo(gatilho) {
        const n = this.total || 0;
        if (!n) return;
        const c = abrir({
            tipo: 'confirmacao', titulo: TEXTO.apagarTudoPergunta, gatilho, descricao: true,
            corpo: `<p>${textoApagarTudo(n)}</p>
                <label class="diario-marca"><input type="checkbox" data-antigo><span>${TEXTO.apagarTudoAntigo}</span></label>
                <div class="sob-pilha" style="margin-top:18px"><button class="btn btn-ghost" type="button" data-foco data-manter>${TEXTO.manter}</button>
                <button class="btn btn-perigo cheio" type="button" data-apagar>${ic('lixo')}${TEXTO.apagarTudoSim}</button></div>`,
        });
        c.corpo.addEventListener('click', (e) => {
            if (e.target.closest('[data-manter]')) c.fechar();
            else if (e.target.closest('[data-apagar]')) {
                const antigo = c.corpo.querySelector('[data-antigo]').checked;
                this.salvarTudo();
                const copia = instantaneo();
                for (const id of [...this.sujas.keys()]) this.limparTimer(id);
                this.local = true;
                try {
                    apagarTudo({ tambemAntigo: antigo });
                } finally {
                    this.local = false;
                }
                this.reconciliar();
                c.fechar(false);
                const g = this.gatilhoAcoes();
                if (g) g.focus({ preventScroll: true });
                avisar(TEXTO.apagado, { desfazer: { rotulo: TEXTO.desfazer, aoClicar: () => this.desfazer(copia, TEXTO.voltouTudo) } });
            }
        });
        this.sobre = c;
    }

    ligarFerramentas() {
        const arquivo = this.querySelector('[data-arquivo]');
        arquivo.addEventListener('change', () => this.importarArquivo(arquivo));
        this.querySelectorAll('[data-exec]').forEach((b) => b.addEventListener('click', () => this.executar(b.dataset.exec, b)));
        const acoes = this.querySelector('#abrir-acoes');
        acoes.addEventListener('click', () => this.abrirGaveta(acoes));

        this.querySelector('[data-acao="mais"]').addEventListener('click', () => {
            const antes = this.nos.size;
            this.visiveis += PAGINA;
            this.reconciliar();
            const novo = this.querySelectorAll('.diario-item')[antes];
            if (novo) novo.querySelector('.diario-data').focus();
        });
    }
}

/** Deixa `filhos` como filhos diretos de `pai`, na ordem, movendo so o que esta fora do lugar. */
function colocar(pai, filhos) {
    filhos.forEach((f, i) => {
        if (pai.children[i] !== f) pai.insertBefore(f, pai.children[i] || null);
    });
    while (pai.children.length > filhos.length) pai.lastElementChild.remove();
}

customElements.define('history-screen', HistoryScreen);
