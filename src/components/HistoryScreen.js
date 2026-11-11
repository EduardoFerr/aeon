import { loadCards } from '../utils/cardsUtil.js';
import { escaparHtml } from '../utils/glossario.js';
import { dataLocal } from '../utils/cartaDoDia.js';
import { navigateTo, registrarGuardaSaida } from '../utils/navigation.js';
import { gravarRascunho, lerRascunho, limparRascunho, limparTodosRascunhos } from '../utils/rascunhos.js';
import { ic } from '../utils/glifos.js';
import { abrir, avisar } from './Sobreposicao.js';
import { SYNC_ATIVA } from '../utils/contaEstado.js';
if (SYNC_ATIVA) import('./ConviteConta.js');
import { desenharAvisoBackup } from './AvisoBackup.js';
import { registrarBackup } from '../utils/backup.js';
import { listar as listarMapas } from '../utils/perfil.js';
import { EVENTO_ANTES } from '../utils/versao.js';
import {
    listar, diaDaEntrada, rotuloMes, salvarNota, apagarEntrada, apagarTudo, instantaneo, restaurar, exportar, importar, persiste, aoMudar,
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
    tipoCruz: 'Cruz de cinco cartas',
    tipoTemplo: 'Templo de Afrodite',
    tipoMapa: 'Mapa astral',
    rotuloNotaMapa: 'O que esse mapa despertou',
    pergunta: 'Pergunta:',
    rotuloNotaDia: 'O que essa carta despertou',
    rotuloNotaLeitura: 'O que essa leitura despertou',
    rotuloNotaCruz: 'O que essa cruz despertou',
    rotuloNotaTemplo: 'O que esse templo despertou',
    dica: 'Anote o que veio à mente.',
    salvando: 'Salvando...',
    rascunho: 'Alterações não salvas',
    salvarNota: 'Salvar',
    descartar: 'Descartar',
    notaSalva: 'Nota salva.',
    notaDescartada: 'Alterações descartadas.',
    saidaTitulo: 'Nota não salva',
    saidaUma: 'Você tem uma nota com alterações que ainda não foram salvas.',
    saidaVarias: (n) => `Você tem ${n} notas com alterações que ainda não foram salvas.`,
    saidaSalvar: 'Salvar e sair',
    saidaDescartar: 'Descartar e sair',
    saidaFicar: 'Continuar editando',
    salvo: 'Salvo neste aparelho',
    falha: 'Não foi possível salvar',
    limiteAtingido: 'Limite atingido',
    apagar: 'Apagar registro',
    reabrir: 'Reabrir leitura',
    entradaApagada: 'Entrada apagada',
    desfazer: 'Desfazer',
    voltou: 'Entrada de volta no diário',
    manter: 'Manter',
    mesAnterior: 'Mês anterior',
    mesSeguinte: 'Mês seguinte',
    hoje: 'Hoje',
    calendario: 'Calendário do diário',
    diaVazio: 'Nenhum registro neste dia.',
    diaVazioHoje: 'Nenhum registro hoje ainda.',
    semDataBotao: 'Sem data',
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

const POS = {
    passado: 'Passado', presente: 'Presente', futuro: 'Futuro', sol: 'Sol', lua: 'Lua', asc: 'Ascendente',
    momento: 'Momento', ajuda: 'Ajuda', obstaculo: 'Obstáculo', caminho: 'Caminho', sintese: 'Síntese',
    'mental-voce': 'Mental · você', 'afetivo-voce': 'Afetivo · você', 'fisico-voce': 'Físico · você',
    'mental-outra': 'Mental · outra pessoa', 'afetivo-outra': 'Afetivo · outra pessoa', 'fisico-outra': 'Físico · outra pessoa',
};
const ESPERA_RASCUNHO = 300; // ms de pausa na digitacao antes de guardar o rascunho (a nota salva so muda em "Salvar")
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const SEMANA_LONGA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const fmtDiaCurto = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const isoDe = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
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

/** O Diario: linha do tempo de cartas do dia e leituras, cada uma com uma area de nota (salva so em "Salvar"). */
export class HistoryScreen extends HTMLElement {
    async connectedCallback() {
        this.nos = new Map(); // id -> { li, json, capa }
        this.mes = null; // { ano, mes } exibido no calendario
        this.sel = null; // dia escolhido: 'AAAA-MM-DD' ou 'sem-data'
        this.sujas = new Map(); // id -> timer do rascunho (a entrada tem alteracoes nao salvas)
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
                <div data-backup></div>
                ${SYNC_ATIVA ? '<convite-conta></convite-conta>' : ''}
                <p class="diario-aviso" role="status" aria-live="polite" data-aviso></p>
                <div class="diario-vazio" data-vazio hidden>
                    <h2>${TEXTO.vazioTitulo}</h2>
                    <p>${TEXTO.vazioTexto}</p>
                    <button type="button" class="btn btn-primary" data-ir="home">${TEXTO.irDia}</button>
                </div>
                <div class="diario-corpo-tela" data-corpo>
                    <div class="cal" data-cal>
                        <div class="cal-nav">
                            <button type="button" class="iconbtn" data-cal-nav="-1" aria-label="${TEXTO.mesAnterior}">${ic('voltar')}</button>
                            <h2 class="cal-mes" data-cal-titulo aria-live="polite"></h2>
                            <button type="button" class="iconbtn" data-cal-nav="1" aria-label="${TEXTO.mesSeguinte}">${ic('seta')}</button>
                        </div>
                        <div class="cal-grade" role="grid" aria-label="${TEXTO.calendario}" data-cal-grade></div>
                        <div class="cal-rodape">
                            <button type="button" class="btn btn-terciario" data-cal-hoje>${TEXTO.hoje}</button>
                            <button type="button" class="btn btn-terciario" data-cal-sem hidden></button>
                        </div>
                    </div>
                    <div class="diario-dia-sel">
                        <h2 class="diario-dia-tit" data-dia-tit tabindex="-1"></h2>
                        <p class="diario-dia-vazio" data-dia-vazio hidden></p>
                        <ol class="diario-lista" data-lista></ol>
                    </div>
                </div>
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
        this.desligarGuarda = registrarGuardaSaida((retomar) => this.perguntarAoSair(retomar));
        this.aoFechar = (ev) => {
            if (!this.sujas.size) return;
            this.salvarTudo(); // o rascunho fica guardado; o navegador ainda pergunta antes de fechar
            ev.preventDefault();
        };
        window.addEventListener('beforeunload', this.aoFechar);
        // Antes de aplicar uma versao nova do app (recarrega a pagina), o que foi digitado fica como rascunho
        this.aoAtualizar = () => this.salvarTudo();
        window.addEventListener(EVENTO_ANTES, this.aoAtualizar);
        this.reconciliar();

        const foco = consumirFoco();
        if (foco) this.focarNota(foco);
    }

    disconnectedCallback() {
        this.salvarTudo(); // ao sair da tela o que foi digitado fica como rascunho
        if (this.sobre && this.sobre.aberto) this.sobre.fechar(false);
        if (this.desligar) this.desligar();
        document.removeEventListener('visibilitychange', this.aoSair);
        window.removeEventListener('pagehide', this.aoSair);
        window.removeEventListener('beforeunload', this.aoFechar);
        window.removeEventListener(EVENTO_ANTES, this.aoAtualizar);
        if (this.desligarGuarda) this.desligarGuarda();
    }

    /* ---------- lista ---------- */

    reconciliar() {
        const todas = listar();
        const ul = this.querySelector('[data-lista]');
        this.escolherDia(todas);
        const fatia = todas.filter((e) => diaDaEntrada(e).iso === this.sel || (this.sel === 'sem-data' && diaDaEntrada(e).semData));
        const ids = new Set(fatia.map((e) => e.id));

        for (const [id, r] of this.nos) {
            if (!ids.has(id)) {
                r.li.remove();
                this.nos.delete(id);
                this.guardarRascunho(id, r.li);
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

        colocar(ul, fatia.map((e) => this.nos.get(e.id).li));
        this.desenharCalendario(todas);
        this.desenharDia(fatia);

        const total = todas.length;
        this.querySelector('[data-contagem]').textContent = total ? mais(total, 'registro', 'registros') : '';
        this.total = total;
        this.querySelector('.diario-exportar').hidden = total === 0;
        this.querySelector('[data-vazio]').hidden = total > 0;
        this.querySelector('[data-corpo]').hidden = total === 0;
        desenharAvisoBackup(this.querySelector('[data-backup]'), { foco: '#page-title', antes: () => this.salvarTudo() });
    }

    /* ---------- calendario ---------- */

    /** Garante um dia escolhido valido: o de hoje se tem registro, senao o ultimo dia com registro, senao hoje. */
    escolherDia(todas) {
        const hoje = dataLocal();
        const dias = new Set(todas.map((e) => diaDaEntrada(e)).filter((d) => !d.semData).map((d) => d.iso));
        const temSemData = todas.some((e) => diaDaEntrada(e).semData);
        if (this.sel === 'sem-data' && !temSemData) this.sel = null;
        if (!this.sel) {
            const ultimo = [...dias].sort().pop();
            this.sel = dias.has(hoje) || !ultimo ? hoje : ultimo;
            const [a, m] = this.sel.split('-').map(Number);
            this.mes = { ano: a, mes: m };
        }
        if (!this.mes) {
            const [a, m] = hoje.split('-').map(Number);
            this.mes = { ano: a, mes: m };
        }
    }

    /** Vai para um dia (e para o mes dele), fechando antes qualquer nota pendente. */
    irParaDia(iso, { foco = false } = {}) {
        this.salvarTudo();
        this.sel = iso;
        if (iso !== 'sem-data') {
            const [a, m] = iso.split('-').map(Number);
            this.mes = { ano: a, mes: m };
        }
        this.reconciliar();
        if (foco) {
            const b = this.querySelector(`.cal-dia[data-iso="${iso}"]`);
            if (b) b.focus({ preventScroll: true });
            // no celular os registros ficam abaixo do calendario: traz o dia escolhido para a vista
            const tit = this.querySelector('[data-dia-tit]');
            if (!matchMedia(DESKTOP).matches && tit.getBoundingClientRect().top > innerHeight * 0.6) {
                tit.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
            }
        }
    }

    mudarMes(delta) {
        this.salvarTudo();
        const d = new Date(this.mes.ano, this.mes.mes - 1 + delta, 1);
        this.mes = { ano: d.getFullYear(), mes: d.getMonth() + 1 };
        this.desenharCalendario(listar());
    }

    desenharCalendario(todas) {
        const grade = this.querySelector('[data-cal-grade]');
        const { ano, mes } = this.mes;
        const contagem = new Map();
        let semData = 0;
        for (const e of todas) {
            const d = diaDaEntrada(e);
            if (d.semData) semData++;
            else contagem.set(d.iso, (contagem.get(d.iso) || 0) + 1);
        }
        const hoje = dataLocal();
        const t = this.querySelector('[data-cal-titulo]');
        t.textContent = rotuloMes(ano, mes);
        const primeiro = new Date(ano, mes - 1, 1).getDay();
        const nDias = new Date(ano, mes, 0).getDate();
        const focavel = this.sel && this.sel.startsWith(`${ano}-${String(mes).padStart(2, '0')}`) ? this.sel : isoDe(ano, mes, 1);
        const tinhaFoco = this.contains(document.activeElement) && document.activeElement.classList.contains('cal-dia') ? document.activeElement.dataset.iso : null;

        let h = `<div class="cal-semana" role="row">${SEMANA.map((l, i) => `<span class="cal-cab" role="columnheader" aria-label="${SEMANA_LONGA[i]}">${l}</span>`).join('')}</div>`;
        let linha = '';
        for (let i = 0; i < primeiro; i++) linha += '<span class="cal-vazio" role="gridcell"></span>';
        for (let d = 1; d <= nDias; d++) {
            const iso = isoDe(ano, mes, d);
            const n = contagem.get(iso) || 0;
            const rot = `${fmtDiaCurto.format(new Date(ano, mes - 1, d, 12))}${n ? `, ${mais(n, 'registro', 'registros')}` : ''}`;
            linha += `<button type="button" role="gridcell" class="cal-dia${n ? ' tem' : ''}${iso === hoje ? ' hoje' : ''}${iso === this.sel ? ' sel' : ''}" data-iso="${iso}" tabindex="${iso === focavel ? 0 : -1}" aria-label="${rot}"${iso === this.sel ? ' aria-current="date"' : ''} aria-pressed="${iso === this.sel}"><span class="cal-n">${d}</span><span class="cal-pt" aria-hidden="true">${n ? '<i></i>'.repeat(Math.min(n, 3)) : ''}</span></button>`;
            if ((primeiro + d) % 7 === 0 || d === nDias) {
                h += `<div class="cal-linha" role="row">${linha}</div>`;
                linha = '';
            }
        }
        grade.innerHTML = h;
        if (tinhaFoco) {
            const b = grade.querySelector(`[data-iso="${tinhaFoco}"]`);
            if (b) b.focus({ preventScroll: true });
        }

        const datas = [...contagem.keys()].sort();
        const menor = datas[0];
        const [ha, hm] = hoje.split('-').map(Number);
        const limiteMin = menor ? menor.slice(0, 7) : `${ha}-${String(hm).padStart(2, '0')}`;
        const atual = `${ano}-${String(mes).padStart(2, '0')}`;
        const maxMes = datas.length && datas[datas.length - 1].slice(0, 7) > `${ha}-${String(hm).padStart(2, '0')}` ? datas[datas.length - 1].slice(0, 7) : `${ha}-${String(hm).padStart(2, '0')}`;
        this.querySelector('[data-cal-nav="-1"]').disabled = atual <= limiteMin;
        this.querySelector('[data-cal-nav="1"]').disabled = atual >= maxMes;
        this.querySelector('[data-cal-hoje]').hidden = this.sel === hoje;
        const sem = this.querySelector('[data-cal-sem]');
        sem.hidden = !semData;
        sem.textContent = `${TEXTO.semDataBotao} (${semData})`;
        sem.setAttribute('aria-pressed', String(this.sel === 'sem-data'));
    }

    desenharDia(fatia) {
        const tit = this.querySelector('[data-dia-tit]');
        const vazio = this.querySelector('[data-dia-vazio]');
        const hoje = dataLocal();
        if (this.sel === 'sem-data') tit.textContent = TEXTO.semData;
        else {
            const [a, m, d] = this.sel.split('-').map(Number);
            const txt = fmtDia.format(new Date(a, m - 1, d, 12));
            tit.textContent = txt.charAt(0).toUpperCase() + txt.slice(1);
        }
        vazio.hidden = fatia.length > 0;
        vazio.textContent = this.sel === hoje ? TEXTO.diaVazioHoje : TEXTO.diaVazio;
    }

    ligarCalendario() {
        const cal = this.querySelector('[data-cal]');
        cal.addEventListener('click', (ev) => {
            const dia = ev.target.closest('.cal-dia');
            if (dia) return this.irParaDia(dia.dataset.iso, { foco: true });
            const nav = ev.target.closest('[data-cal-nav]');
            if (nav) return this.mudarMes(Number(nav.dataset.calNav));
            if (ev.target.closest('[data-cal-hoje]')) return this.irParaDia(dataLocal());
            if (ev.target.closest('[data-cal-sem]')) this.irParaDia('sem-data');
        });
        cal.addEventListener('keydown', (ev) => {
            const dia = ev.target.closest('.cal-dia');
            if (!dia) return;
            const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
            if (passo === undefined && ev.key !== 'PageUp' && ev.key !== 'PageDown' && ev.key !== 'Home' && ev.key !== 'End') return;
            ev.preventDefault();
            const [a, m, d] = dia.dataset.iso.split('-').map(Number);
            let alvo;
            if (ev.key === 'PageUp') alvo = new Date(a, m - 2, d);
            else if (ev.key === 'PageDown') alvo = new Date(a, m, d);
            else if (ev.key === 'Home') alvo = new Date(a, m - 1, 1);
            else if (ev.key === 'End') alvo = new Date(a, m, 0);
            else alvo = new Date(a, m - 1, d + passo);
            const iso = isoDe(alvo.getFullYear(), alvo.getMonth() + 1, alvo.getDate());
            this.mes = { ano: alvo.getFullYear(), mes: alvo.getMonth() + 1 };
            this.desenharCalendario(listar());
            const b = this.querySelector(`.cal-dia[data-iso="${iso}"]`);
            if (b) {
                this.querySelectorAll('.cal-dia').forEach((x) => (x.tabIndex = -1));
                b.tabIndex = 0;
                b.focus();
            }
        });
    }

    criarItem(e) {
        const li = document.createElement('li');
        li.className = 'diario-item';
        li.dataset.id = e.id;
        const leitura = e.tipo === 'leitura';
        const mapa = e.tipo === 'mapa';
        const cruz = e.tipo === 'cruz';
        const templo = e.tipo === 'templo';
        const reabrivel = leitura || cruz || templo;
        const idNota = `nota-${e.id}`;
        const idTit = `tit-${e.id}`;
        const quando = escaparHtml(dataLegivel(e));
        const d = diaDaEntrada(e);
        const hora = !d.semData && !(e.tipo === 'dia' && RE_ID_DIA.test(e.id)) ? fmtHora.format(new Date(e.t)) : '';
        const tipo = (leitura ? TEXTO.tipoLeitura : cruz ? TEXTO.tipoCruz : templo ? TEXTO.tipoTemplo : mapa ? TEXTO.tipoMapa : TEXTO.tipoDia) + (mapa && e.rotulo ? ` (${escaparHtml(e.rotulo)})` : '');
        const rotuloNota = leitura ? TEXTO.rotuloNotaLeitura : cruz ? TEXTO.rotuloNotaCruz : templo ? TEXTO.rotuloNotaTemplo : mapa ? TEXTO.rotuloNotaMapa : TEXTO.rotuloNotaDia;
        const minis = e.cartas
            .map((c) => {
                const carta = this.cartas.get(c.order);
                const nome = carta ? carta.name : `${TEXTO.cartaSem} ${c.order}`;
                const arq = String(c.order).padStart(2, '0');
                return `<li class="diario-carta${templo && c.pos ? ` p-${c.pos}` : ''}">
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
                    <ul class="diario-cartas${leitura || mapa ? ' tres' : cruz ? ' cinco' : templo ? ' sete' : ''}">${minis}</ul>
                    <div class="diario-nota">
                        <label class="sr" for="${idNota}">${rotuloNota}</label>
                        <textarea id="${idNota}" rows="2" maxlength="${LIMITE_NOTA}" placeholder="${rotuloNota}. ${TEXTO.dica}" aria-describedby="${idNota}-estado"></textarea>
                        <div class="diario-rodape">
                            <p class="diario-estado" id="${idNota}-estado" role="status" aria-live="polite" data-estado></p>
                            <p class="diario-contador" data-contador hidden></p>
                        </div>
                        <div class="diario-nota-acoes" data-nota-acoes hidden>
                            <button type="button" class="btn btn-ghost" data-acao="salvar-nota">${TEXTO.salvarNota}</button>
                            <button type="button" class="btn btn-terciario" data-acao="descartar-nota">${TEXTO.descartar}</button>
                        </div>
                    </div>
                </div>
                ${reabrivel ? `<div class="diario-acoes"><button type="button" class="btn btn-ghost" data-acao="reabrir" aria-describedby="${idTit}">${ic('leitura')}${TEXTO.reabrir}</button></div>` : ''}
            </article>`;
        const ta = li.querySelector('textarea');
        const rascunho = lerRascunho(e.id);
        ta.value = rascunho !== null && rascunho !== e.nota ? rascunho : e.nota;
        this.contar(li);
        if (ta.value !== e.nota) this.marcar(e.id, li, e.nota);

        ta.addEventListener('input', () => {
            this.contar(li);
            this.marcar(e.id, li);
        });
        ta.addEventListener('blur', () => this.guardarRascunho(e.id, li));
        ta.addEventListener('keydown', (ev) => {
            if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
                ev.preventDefault();
                this.salvar(e.id);
            }
        });
        li.querySelector('[data-acao="salvar-nota"]').addEventListener('click', () => this.salvar(e.id));
        li.querySelector('[data-acao="descartar-nota"]').addEventListener('click', () => this.descartar(e.id));
        li.querySelectorAll('.diario-mini').forEach((b) =>
            b.addEventListener('click', () => {
                const info = document.querySelector('tarot-card-info');
                const carta = this.cartas.get(Number(b.dataset.order));
                if (info && info.showInfo && carta) info.showInfo(carta, b);
            })
        );
        li.querySelector('[data-acao="apagar"]').addEventListener('click', () => this.apagar(e.id, li));
        const reab = li.querySelector('[data-acao="reabrir"]');
        if (reab) {
            reab.addEventListener('click', () => {
                this.salvarTudo(); // o que esta sendo digitado fica como rascunho; se houver, a saida ainda pergunta
                navigateTo(leitura ? 'three-card-game' : cruz ? 'cruz' : 'templo', { reabrir: e.id });
            });
        }

        return { li, json: JSON.stringify(e), capa: JSON.stringify({ ...e, nota: '', m: '' }) };
    }

    /* ---------- nota: rascunho, salvar e descartar ---------- */

    contar(li) {
        const n = Math.min(li.querySelector('textarea').value.length, LIMITE_NOTA);
        const c = li.querySelector('[data-contador]');
        c.hidden = n < PERTO_DO_LIMITE;
        c.textContent = n >= LIMITE_NOTA ? `${TEXTO.limiteAtingido}: ${n}/${LIMITE_NOTA}` : `${n}/${LIMITE_NOTA}`;
        c.classList.toggle('no-limite', n >= LIMITE_NOTA);
    }

    estado(li, qual) {
        const p = li.querySelector('[data-estado]');
        p.textContent = qual === 'rascunho' ? TEXTO.rascunho : qual === 'salvo' ? TEXTO.salvo : qual === 'vazio' ? '' : TEXTO.falha;
        p.dataset.estado = qual;
    }

    /** A nota salva da entrada (o que esta no diario, nao o que esta na caixa). */
    notaSalva(id, padrao = '') {
        const e = listar().find((x) => x.id === id);
        return e ? e.nota : padrao;
    }

    /** O texto da caixa mudou: guarda como rascunho (nao toca na nota salva) e mostra Salvar e Descartar. */
    marcar(id, li, salva = this.notaSalva(id)) {
        const ta = li.querySelector('textarea');
        const acoes = li.querySelector('[data-nota-acoes]');
        if (ta.value === salva) {
            this.limparTimer(id);
            limparRascunho(id);
            acoes.hidden = true;
            this.estado(li, 'vazio');
            return;
        }
        clearTimeout(this.sujas.get(id));
        this.sujas.set(id, setTimeout(() => this.guardarRascunho(id, li), ESPERA_RASCUNHO));
        acoes.hidden = false;
        this.estado(li, 'rascunho');
    }

    guardarRascunho(id, li) {
        const ta = li && li.querySelector('textarea');
        if (!ta || !this.sujas.has(id)) return;
        gravarRascunho(id, ta.value);
    }

    limparTimer(id) {
        clearTimeout(this.sujas.get(id));
        this.sujas.delete(id);
    }

    /** Salva a nota (so por escolha da pessoa). O aviso traz "Desfazer", que devolve o texto de antes. */
    salvar(id) {
        const r = this.nos.get(id);
        if (!r) return false;
        const ta = r.li.querySelector('textarea');
        const anterior = this.notaSalva(id);
        const texto = ta.value;
        this.local = true; // a propria gravacao nao deve redesenhar a lista
        let resultado;
        try {
            resultado = salvarNota(id, texto);
        } finally {
            this.local = false;
        }
        if (!resultado.ok) {
            this.estado(r.li, 'falha'); // o rascunho continua guardado
            return false;
        }
        this.limparTimer(id);
        limparRascunho(id);
        r.li.querySelector('[data-nota-acoes]').hidden = true;
        this.estado(r.li, 'salvo');
        const atual = listar().find((e) => e.id === id);
        if (atual) r.json = JSON.stringify(atual);
        if (anterior !== texto) {
            avisar(TEXTO.notaSalva, {
                desfazer: {
                    rotulo: TEXTO.desfazer,
                    aoClicar: () => {
                        this.local = true;
                        try {
                            salvarNota(id, anterior);
                        } finally {
                            this.local = false;
                        }
                        const no = this.nos.get(id);
                        if (no) {
                            no.li.querySelector('textarea').value = anterior;
                            this.contar(no.li);
                            this.estado(no.li, 'salvo');
                            const nova = listar().find((e) => e.id === id);
                            if (nova) no.json = JSON.stringify(nova);
                        }
                    },
                },
            });
        }
        return true;
    }

    /** Volta a caixa para a nota salva e apaga o rascunho. O aviso traz "Desfazer", que devolve o que foi digitado. */
    descartar(id) {
        const r = this.nos.get(id);
        if (!r) return;
        const ta = r.li.querySelector('textarea');
        const digitado = ta.value;
        ta.value = this.notaSalva(id);
        this.contar(r.li);
        this.marcar(id, r.li);
        ta.focus({ preventScroll: true });
        avisar(TEXTO.notaDescartada, {
            desfazer: {
                rotulo: TEXTO.desfazer,
                aoClicar: () => {
                    const no = this.nos.get(id);
                    if (!no) return;
                    const campo = no.li.querySelector('textarea');
                    campo.value = digitado;
                    this.contar(no.li);
                    this.marcar(id, no.li);
                    this.guardarRascunho(id, no.li);
                },
            },
        });
    }

    /** Guarda o que foi digitado como rascunho (a nota salva nao muda). */
    salvarTudo() {
        for (const id of [...this.sujas.keys()]) {
            const r = this.nos.get(id);
            if (r) this.guardarRascunho(id, r.li);
        }
    }

    /** Ao sair da tela com notas nao salvas: Salvar, Descartar ou Continuar editando. */
    perguntarAoSair(retomar) {
        const pendentes = [...this.sujas.keys()].filter((id) => this.nos.has(id));
        if (!pendentes.length) return false;
        const gatilho = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
        const c = abrir({
            tipo: 'confirmacao', titulo: TEXTO.saidaTitulo, gatilho, descricao: true,
            corpo: `<p>${pendentes.length === 1 ? TEXTO.saidaUma : TEXTO.saidaVarias(pendentes.length)}</p>
                <div class="sob-pilha" style="margin-top:18px"><button class="btn btn-ghost cheio" type="button" data-salvar>${TEXTO.saidaSalvar}</button>
                <button class="btn btn-perigo" type="button" data-descartar>${TEXTO.saidaDescartar}</button>
                <button class="btn btn-terciario" type="button" data-foco data-ficar>${TEXTO.saidaFicar}</button></div>`,
        });
        c.corpo.addEventListener('click', (ev) => {
            if (ev.target.closest('[data-ficar]')) return c.fechar();
            if (ev.target.closest('[data-salvar]')) {
                for (const id of pendentes) this.salvar(id);
            } else if (ev.target.closest('[data-descartar]')) {
                for (const id of pendentes) {
                    this.limparTimer(id);
                    limparRascunho(id);
                }
            } else return undefined;
            c.fechar(false);
            retomar();
            return undefined;
        });
        return true;
    }

    focarNota(id) {
        const e = listar().find((x) => x.id === id);
        if (e) {
            const d = diaDaEntrada(e);
            if (!d.semData && d.iso !== this.sel) this.irParaDia(d.iso);
        }
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
        limparRascunho(id);
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
            // este arquivo leva so o diario: so conta como backup dos registros se nao ha mapas guardados
            if (listarMapas().length === 0) registrarBackup();
            desenharAvisoBackup(this.querySelector('[data-backup]'));
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
                limparTodosRascunhos();
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

        this.ligarCalendario();
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
