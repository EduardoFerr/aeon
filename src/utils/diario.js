import { hash, dataLocal } from './cartaDoDia.js';
import { marcarApagado, desmarcarApagado } from './contaEstado.js';
import { pedirPersistencia } from './persistencia.js';
import { chaveDe, contaAtiva, CONTA_INICIAL } from './contas.js';

/**
 * Diario: anotacoes e leituras, guardadas so no aparelho.
 *
 * Chave: "aeon:v2:diario"  ->  { v: 2, entradas: [Entrada], ocultos: [id] }
 *   Entrada = { id, t (ISO), tipo: "dia" | "leitura" | "mapa" | "cruz" | "templo", cartas: [{ order, pos? }], nota, m (ISO da ultima edicao da nota), rotulo?, pergunta? (leitura, cruz e templo, ate 200 caracteres) }
 *   cruz = as 5 cartas da cruz, cada uma com pos (momento, ajuda, obstaculo, caminho, sintese). Versoes antigas do app ignoram esse tipo.
 *   templo = as 7 cartas do Templo de Afrodite, cada uma com pos (mental-voce, afetivo-voce, fisico-voce, mental-outra, afetivo-outra, fisico-outra, sintese). Versoes antigas do app ignoram esse tipo.
 *   ocultos = ids de leituras do historico antigo que a pessoa apagou do diario (so esconde, nao apaga o antigo).
 *
 * O historico antigo (chave "tarotHistory", storage.js) e lido SOMENTE LEITURA e convertido por order;
 * nunca e alterado aqui. A carta do dia (aeon:v2:dia) tambem nao e tocada.
 *
 * Tudo em try/catch: modo privado, bloqueado, quota cheia ou JSON corrompido nao quebram nada.
 * Sem armazenamento o diario funciona em memoria durante a visita (persiste() devolve false).
 */
export const CHAVE_DIARIO = 'aeon:v2:diario';
export const CHAVE_ANTIGA = 'tarotHistory';
export const LIMITE_NOTA = 2000;
export const LIMITE_PERGUNTA = 200;
export const LIMITE_ENTRADAS = 500;
export const LIMITE_ARQUIVO = 1024 * 1024; // 1 MB
const LIMITE_LEITURA_IMPORTACAO = 2000; // quantas entradas do arquivo sao ao menos examinadas

const POSICOES = ['passado', 'presente', 'futuro'];
const POSICOES_MAPA = ['sol', 'lua', 'asc'];
export const POSICOES_CRUZ = ['momento', 'ajuda', 'obstaculo', 'caminho', 'sintese'];
export const POSICOES_TEMPLO = ['mental-voce', 'afetivo-voce', 'fisico-voce', 'mental-outra', 'afetivo-outra', 'fisico-outra', 'sintese'];
/** Tipos que so valem inteiros: uma carta diferente em cada posicao. */
const COMPLETOS = { cruz: POSICOES_CRUZ, templo: POSICOES_TEMPLO };
const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const PERIGOSAS = ['__proto__', 'constructor', 'prototype'];

let memoria = null; // estado desta visita quando o armazenamento falha
let gravacaoFalhou = false;
let leituraFalhou = false;
let focoPendente = null;
let avisoPendente = '';
const ouvintes = new Set();

const vazio = () => ({ v: 2, entradas: [], ocultos: [] });
const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/* ---------- sanitizacao ---------- */

function dataValida(valor) {
    if (typeof valor !== 'string' || valor.length > 40) return null;
    const ms = Date.parse(valor);
    if (!Number.isFinite(ms)) return null;
    const ano = new Date(ms).getUTCFullYear();
    return ano >= 2000 && ano <= 2100 ? new Date(ms).toISOString() : null;
}

function limparTexto(valor, max) {
    if (typeof valor !== 'string') return '';
    // tira caracteres de controle (menos quebra de linha e tab) e corta no limite
    return valor.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').slice(0, max);
}

/** Pergunta de leitura: uma linha so, sem controles, aparada, no maximo LIMITE_PERGUNTA caracteres. */
export function limparPergunta(valor) {
    if (typeof valor !== 'string') return '';
    return limparTexto(valor, 4 * LIMITE_PERGUNTA).replace(/\s+/g, ' ').trim().slice(0, LIMITE_PERGUNTA).trim();
}

/** Constroi uma entrada nova so com a lista branca de campos, ou devolve null se nao servir. */
export function sanearEntrada(bruta) {
    if (!bruta || typeof bruta !== 'object' || Array.isArray(bruta)) return null;
    if (PERIGOSAS.some((k) => tem(bruta, k))) return null;
    if (!tem(bruta, 'id') || typeof bruta.id !== 'string' || !RE_ID.test(bruta.id)) return null;
    const t = tem(bruta, 't') ? dataValida(bruta.t) : null;
    if (!t) return null;
    const tipo = tem(bruta, 'tipo') ? bruta.tipo : null;
    if (tipo !== 'dia' && tipo !== 'leitura' && tipo !== 'mapa' && tipo !== 'cruz' && tipo !== 'templo') return null;
    if (!tem(bruta, 'cartas') || !Array.isArray(bruta.cartas)) return null;
    const maximo = tipo === 'dia' ? 1 : COMPLETOS[tipo] ? COMPLETOS[tipo].length : 3;
    const cartas = [];
    for (const c of bruta.cartas.slice(0, maximo)) {
        if (!c || typeof c !== 'object' || PERIGOSAS.some((k) => tem(c, k))) return null;
        const order = tem(c, 'order') && typeof c.order === 'number' ? c.order : NaN;
        if (!Number.isInteger(order) || order < 0 || order > 77) return null;
        const item = { order };
        const validas = tipo === 'mapa' ? POSICOES_MAPA : COMPLETOS[tipo] || POSICOES;
        if (tem(c, 'pos') && validas.includes(c.pos)) item.pos = c.pos;
        cartas.push(item);
    }
    if (!cartas.length) return null;
    // a cruz e o templo so valem inteiros: uma carta diferente em cada posicao (senao o desenho nao se sustenta)
    const inteiro = COMPLETOS[tipo];
    if (inteiro && !(cartas.length === inteiro.length && cartas.every((c) => c.pos) && new Set(cartas.map((c) => c.pos)).size === inteiro.length && new Set(cartas.map((c) => c.order)).size === inteiro.length)) return null;
    const entrada = {
        id: bruta.id,
        t,
        tipo,
        cartas,
        nota: tem(bruta, 'nota') ? limparTexto(bruta.nota, LIMITE_NOTA) : '',
        m: (tem(bruta, 'm') && dataValida(bruta.m)) || t,
    };
    if (tem(bruta, 'rotulo') && typeof bruta.rotulo === 'string' && bruta.rotulo.trim()) {
        entrada.rotulo = limparTexto(bruta.rotulo, 40);
    }
    if ((tipo === 'leitura' || tipo === 'cruz' || tipo === 'templo') && tem(bruta, 'pergunta')) {
        const pergunta = limparPergunta(bruta.pergunta);
        if (pergunta) entrada.pergunta = pergunta;
    }
    return entrada;
}

function sanearDoc(bruto) {
    const doc = vazio();
    if (!bruto || typeof bruto !== 'object' || bruto.v !== 2) return doc;
    const vistos = new Set();
    if (Array.isArray(bruto.entradas)) {
        for (const e of bruto.entradas.slice(0, LIMITE_ENTRADAS)) {
            const ok = sanearEntrada(e);
            if (ok && !vistos.has(ok.id)) {
                vistos.add(ok.id);
                doc.entradas.push(ok);
            }
        }
    }
    if (Array.isArray(bruto.ocultos)) {
        doc.ocultos = bruto.ocultos.filter((id) => typeof id === 'string' && RE_ID.test(id)).slice(0, LIMITE_ENTRADAS);
    }
    return doc;
}

/* ---------- leitura e gravacao ---------- */

function carregar() {
    let bruto;
    try {
        bruto = localStorage.getItem(chaveDe('diario'));
        leituraFalhou = false;
    } catch (e) {
        leituraFalhou = true;
        return memoria || vazio();
    }
    if (gravacaoFalhou && memoria) return memoria; // a memoria tem coisa mais nova que o armazenamento
    if (bruto == null) return memoria && gravacaoFalhou ? memoria : vazio();
    try {
        return sanearDoc(JSON.parse(bruto));
    } catch (e) {
        return vazio(); // corrompido: recomeca limpo na proxima gravacao
    }
}

function gravar(doc) {
    memoria = doc;
    let ok = true;
    try {
        localStorage.setItem(chaveDe('diario'), JSON.stringify(doc)); // escrita atomica: um unico setItem
        gravacaoFalhou = false;
        pedirPersistencia();
    } catch (e) {
        gravacaoFalhou = true; // quota excedida ou bloqueado
        ok = false;
    }
    avisar();
    return ok;
}

function avisar() {
    ouvintes.forEach((fn) => {
        try {
            fn();
        } catch (e) {
            /* um ouvinte quebrado nao derruba os outros */
        }
    });
}

/** Chama fn quando o diario muda (nesta aba ou em outra, via evento storage). Devolve a funcao que cancela. */
export function aoMudar(fn) {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key === chaveDe('diario') || e.key === CHAVE_ANTIGA || e.key === null) avisar();
    });
}

/** O navegador deixa guardar dados? (testa de verdade: modo privado antigo falha so no setItem) */
export function persiste() {
    if (gravacaoFalhou || leituraFalhou) return false;
    try {
        const k = 'aeon:v2:teste';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
    } catch (e) {
        return false;
    }
}

/* ---------- historico antigo (somente leitura) ---------- */

/** O historico antigo (tarotHistory) pertence a conta inicial: as outras contas nunca o veem. */
const temAntigo = () => contaAtiva() === CONTA_INICIAL;

function lerAntigo() {
    if (!temAntigo()) return [];
    let lista;
    try {
        lista = JSON.parse(localStorage.getItem(CHAVE_ANTIGA));
    } catch (e) {
        return [];
    }
    if (!Array.isArray(lista)) return [];
    const usados = new Set();
    const saida = [];
    lista.forEach((item, i) => {
        if (!item || typeof item !== 'object' || !item.cards || typeof item.cards !== 'object') return;
        const cartas = [];
        for (const pos of POSICOES) {
            const c = item.cards[pos];
            const order = c && Number(c.order);
            if (Number.isInteger(order) && order >= 0 && order <= 77) cartas.push({ order, pos });
        }
        if (!cartas.length) return;
        const rotulo = typeof item.date === 'string' ? limparTexto(item.date, 40) : '';
        let id = `antigo-${hash(rotulo + cartas.map((c) => c.order).join('-')).toString(36)}`;
        if (usados.has(id)) id += `-${i}`;
        usados.add(id);
        const t = dataAntiga(rotulo) || new Date(Date.UTC(2000, 0, 1) + i * 1000).toISOString();
        saida.push({ id, t, tipo: 'leitura', cartas, nota: '', m: t, rotulo, antigo: true, semData: !dataAntiga(rotulo) });
    });
    return saida;
}

/** toLocaleString antigo: pt-BR "10/11/2026 14:32:05" (dia/mes, 24h) ou en-US "11/10/2026, 2:32:05 PM" (mes/dia, AM/PM). */
function dataAntiga(texto) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(texto);
    if (!m) return null;
    const ampm = m[7] ? m[7].toUpperCase() : '';
    const [dia, mes] = ampm ? [+m[2], +m[1]] : [+m[1], +m[2]];
    let hora = +m[4];
    if (ampm === 'PM' && hora < 12) hora += 12;
    if (ampm === 'AM' && hora === 12) hora = 0;
    const d = new Date(+m[3], mes - 1, dia, hora, +m[5], +(m[6] || 0));
    return !Number.isNaN(d.getTime()) && d.getMonth() === mes - 1 ? d.toISOString() : null;
}

/* ---------- API ---------- */

/** Entradas do diario (v2 + historico antigo convertido), da mais nova para a mais antiga. */
export function listar() {
    const doc = carregar();
    const ids = new Set(doc.entradas.map((e) => e.id));
    const ocultos = new Set(doc.ocultos);
    const antigas = lerAntigo().filter((e) => !ids.has(e.id) && !ocultos.has(e.id));
    return [...doc.entradas, ...antigas].sort((a, b) => (a.t < b.t ? 1 : a.t > b.t ? -1 : 0));
}

export function obter(id) {
    return listar().find((e) => e.id === id) || null;
}

function aplicarLimite(doc) {
    if (doc.entradas.length <= LIMITE_ENTRADAS) return 0;
    doc.entradas.sort((a, b) => (a.t < b.t ? 1 : -1));
    const descartadas = doc.entradas.length - LIMITE_ENTRADAS;
    doc.entradas.length = LIMITE_ENTRADAS;
    avisoPendente = `O diário guarda até ${LIMITE_ENTRADAS} entradas. ${descartadas === 1 ? 'A mais antiga foi descartada' : `As ${descartadas} mais antigas foram descartadas`}.`;
    return descartadas;
}

/** Cria (ou atualiza) a entrada da carta do dia. Id estavel pela data; a nota existente e preservada. */
export function guardarDia(order, data = dataLocal()) {
    const doc = carregar();
    const id = `dia-${data}`;
    const existente = doc.entradas.find((e) => e.id === id);
    if (existente) {
        existente.cartas = [{ order: Number(order) }];
    } else {
        const hoje = dataLocal();
        const t = data === hoje ? new Date().toISOString() : new Date(`${data}T12:00:00`).toISOString();
        const nova = sanearEntrada({ id, t, tipo: 'dia', cartas: [{ order: Number(order) }], nota: '' });
        if (!nova) return { id, ok: false };
        doc.entradas.push(nova);
    }
    aplicarLimite(doc);
    return { id, ok: gravar(doc) };
}

/** Cria uma entrada de leitura de 3 cartas. cartas: [{order, pos}]; pergunta e opcional. */
export function criarLeitura(cartas, pergunta = '') {
    const doc = carregar();
    const agora = new Date();
    const id = `leitura-${agora.getTime().toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`;
    const nova = sanearEntrada({
        id,
        t: agora.toISOString(),
        tipo: 'leitura',
        cartas: cartas.map((c) => ({ order: Number(c.order), pos: c.pos })),
        nota: '',
        pergunta,
    });
    if (!nova) return { id, ok: false };
    doc.entradas.push(nova);
    aplicarLimite(doc);
    return { id, ok: gravar(doc) };
}

/**
 * Cria uma entrada de cruz de cinco cartas (so quando a pessoa escolhe guardar).
 * cartas: [{order, pos}] com as cinco posicoes (momento, ajuda, obstaculo, caminho, sintese); pergunta e opcional.
 */
export function guardarCruz(cartas, pergunta = '') {
    const doc = carregar();
    const agora = new Date();
    const id = `cruz-${agora.getTime().toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`;
    const nova = sanearEntrada({
        id,
        t: agora.toISOString(),
        tipo: 'cruz',
        cartas: cartas.map((c) => ({ order: Number(c.order), pos: c.pos })),
        nota: '',
        pergunta,
    });
    if (!nova) return { id, ok: false };
    doc.entradas.push(nova);
    aplicarLimite(doc);
    return { id, ok: gravar(doc) };
}

/**
 * Cria uma entrada do Templo de Afrodite (so quando a pessoa escolhe guardar).
 * cartas: [{order, pos}] com as sete posicoes (ver POSICOES_TEMPLO); pergunta e opcional.
 */
export function guardarTemplo(cartas, pergunta = '') {
    const doc = carregar();
    const agora = new Date();
    const id = `templo-${agora.getTime().toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`;
    const nova = sanearEntrada({
        id,
        t: agora.toISOString(),
        tipo: 'templo',
        cartas: cartas.map((c) => ({ order: Number(c.order), pos: c.pos })),
        nota: '',
        pergunta,
    });
    if (!nova) return { id, ok: false };
    doc.entradas.push(nova);
    aplicarLimite(doc);
    return { id, ok: gravar(doc) };
}

/**
 * Cria uma entrada de mapa astral: as cartas do decano do Sol, da Lua e do Ascendente (pos: sol, lua, asc)
 * e, como rotulo, so os signos. NAO leva data, hora nem local de nascimento.
 */
export function criarMapa(cartas, rotulo = '') {
    const doc = carregar();
    const agora = new Date();
    const id = `mapa-${agora.getTime().toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`;
    const nova = sanearEntrada({
        id,
        t: agora.toISOString(),
        tipo: 'mapa',
        cartas: cartas.map((c) => ({ order: Number(c.order), pos: c.pos })),
        nota: '',
        rotulo,
    });
    if (!nova) return { id, ok: false };
    doc.entradas.push(nova);
    aplicarLimite(doc);
    return { id, ok: gravar(doc) };
}

/**
 * Troca as cartas (e a pergunta) de uma leitura ja gravada, mantendo id, data e nota.
 * Usada quando a pessoa refaz a escolha: a leitura e uma so, nao duas.
 * Se a entrada sumiu (apagada no diario nesse meio tempo), cria outra.
 */
export function atualizarLeitura(id, cartas, pergunta = '') {
    const doc = carregar();
    const atual = doc.entradas.find((e) => e.id === id && e.tipo === 'leitura');
    if (!atual) return criarLeitura(cartas, pergunta);
    const nova = sanearEntrada({
        ...atual,
        cartas: cartas.map((c) => ({ order: Number(c.order), pos: c.pos })),
        pergunta,
    });
    if (!nova) return { id, ok: false };
    doc.entradas[doc.entradas.indexOf(atual)] = nova;
    return { id, ok: gravar(doc) };
}

/** Grava a nota. Se a entrada vem do historico antigo, ela e adotada pelo diario v2 (o antigo continua intacto). */
export function salvarNota(id, texto) {
    const doc = carregar();
    let entrada = doc.entradas.find((e) => e.id === id);
    if (!entrada) {
        const antiga = lerAntigo().find((e) => e.id === id);
        if (!antiga) return { ok: false, ausente: true };
        const { antigo, semData, ...limpa } = antiga;
        entrada = sanearEntrada(limpa);
        if (!entrada) return { ok: false };
        doc.entradas.push(entrada);
    }
    entrada.nota = limparTexto(texto, LIMITE_NOTA);
    entrada.m = new Date().toISOString();
    aplicarLimite(doc);
    return { ok: gravar(doc) };
}

/** Apaga uma entrada. Uma leitura do historico antigo so e escondida do diario (o antigo nao e tocado). */
export function apagarEntrada(id) {
    const doc = carregar();
    doc.entradas = doc.entradas.filter((e) => e.id !== id);
    if (id.startsWith('antigo-') && !doc.ocultos.includes(id)) doc.ocultos.push(id);
    else marcarApagado('diario', id); // com a sincronizacao ligada, a exclusao tambem vai para a conta
    return gravar(doc);
}

/** Copia do diario agora (e do historico antigo, que o apagar tudo pode remover), para o Desfazer. */
export function instantaneo() {
    let antigo = null;
    try {
        antigo = temAntigo() ? localStorage.getItem(CHAVE_ANTIGA) : null;
    } catch (e) {
        /* sem armazenamento */
    }
    return { doc: JSON.parse(JSON.stringify(carregar())), antigo };
}

/** Devolve o diario ao estado da copia (o Desfazer), inclusive o historico antigo se ele foi removido. */
export function restaurar(copia) {
    (copia.doc && Array.isArray(copia.doc.entradas) ? copia.doc.entradas : []).forEach((e) => e && typeof e.id === 'string' && desmarcarApagado('diario', e.id));
    if (copia.antigo != null && temAntigo()) {
        try {
            if (localStorage.getItem(CHAVE_ANTIGA) == null) localStorage.setItem(CHAVE_ANTIGA, copia.antigo);
        } catch (e) {
            /* sem armazenamento: a restauracao do diario segue */
        }
    }
    return gravar(sanearDoc(copia.doc));
}

/**
 * Apaga todo o diario: entradas e notas v2, e esconde as leituras antigas do diario.
 * Nao apaga a carta do dia nem a semana em estrelas. So apaga o historico antigo se `tambemAntigo` for true.
 */
export function apagarTudo({ tambemAntigo = false } = {}) {
    carregar().entradas.forEach((e) => marcarApagado('diario', e.id));
    const doc = vazio();
    if (tambemAntigo) {
        try {
            localStorage.removeItem(CHAVE_ANTIGA);
        } catch (e) {
            /* sem armazenamento: nada a apagar */
        }
    } else {
        doc.ocultos = lerAntigo().map((e) => e.id).slice(0, LIMITE_ENTRADAS);
    }
    return gravar(doc);
}

/* ---------- backup ---------- */

export function exportar() {
    const entradas = listar().map(({ antigo, semData, ...resto }) => resto);
    return { v: 2, exportado: new Date().toISOString(), entradas };
}

/**
 * Importa um arquivo de backup. O conteudo e DADO NAO CONFIAVEL: tamanho, JSON, versao, tipos, limites e
 * lista branca de campos. Mescla por id sem duplicar e sem sobrescrever nota local mais nova.
 * @returns {{ok: boolean, motivo?: string, importadas: number, ignoradas: number}}
 */
export function importar(texto) {
    const falha = (motivo) => ({ ok: false, motivo, importadas: 0, ignoradas: 0 });
    if (typeof texto !== 'string' || texto.length > LIMITE_ARQUIVO) return falha('O arquivo passa de 1 MB.');
    let bruto;
    try {
        bruto = JSON.parse(texto);
    } catch (e) {
        return falha('Este arquivo não é um backup do diário (JSON inválido).');
    }
    if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto) || bruto.v !== 2 || !Array.isArray(bruto.entradas)) {
        return falha('Este arquivo não é um backup do diário do Aeon Fool.');
    }
    const doc = carregar();
    const locais = new Map(doc.entradas.map((e) => [e.id, e]));
    // entradas do historico antigo que ainda nao foram adotadas tambem contam como locais (evita duplicar)
    lerAntigo().forEach((e) => {
        if (!locais.has(e.id)) locais.set(e.id, { ...e, nota: '', m: '1970-01-01T00:00:00.000Z', virtual: true });
    });
    let importadas = 0;
    let ignoradas = Math.max(0, bruto.entradas.length - LIMITE_LEITURA_IMPORTACAO);
    const vistosNoArquivo = new Set();
    for (const item of bruto.entradas.slice(0, LIMITE_LEITURA_IMPORTACAO)) {
        const nova = sanearEntrada(item);
        if (!nova || vistosNoArquivo.has(nova.id)) {
            ignoradas++;
            continue;
        }
        vistosNoArquivo.add(nova.id);
        const local = locais.get(nova.id);
        if (!local) {
            doc.entradas.push(nova);
            locais.set(nova.id, nova);
            importadas++;
        } else if (nova.nota && nova.m > local.m && nova.nota !== local.nota) {
            // so a nota mais nova vence; a nota local mais nova nunca e sobrescrita
            if (local.virtual) {
                const { antigo, semData, virtual, ...base } = local;
                const adotada = sanearEntrada(base);
                if (adotada) {
                    adotada.nota = nova.nota;
                    adotada.m = nova.m;
                    doc.entradas.push(adotada);
                    locais.set(adotada.id, adotada);
                    importadas++;
                } else ignoradas++;
            } else {
                local.nota = nova.nota;
                local.m = nova.m;
                importadas++;
            }
        } else {
            ignoradas++;
        }
    }
    // entradas importadas que estavam escondidas voltam a aparecer
    doc.ocultos = doc.ocultos.filter((id) => !vistosNoArquivo.has(id));
    aplicarLimite(doc);
    const ok = gravar(doc);
    return { ok, motivo: ok ? '' : 'Não foi possível guardar.', importadas, ignoradas };
}

/* ---------- sincronizacao com a conta (o motor esta em conta.js) ---------- */

/** Quando a entrada mudou por ultimo: a edicao da nota, ou a criacao se a nota nunca foi editada. */
export const atualizadoEm = (e) => (e.m && e.m > e.t ? e.m : e.t);

/** As entradas proprias do diario (sem as leituras do historico antigo, que so existem para leitura). */
export function entradasParaSync() {
    return carregar().entradas.map((e) => ({ ...e }));
}

/**
 * Aplica o que veio da conta. Cada item: { id, dados, atualizado_em, apagado }. O conteudo e DADO NAO CONFIAVEL
 * (passa pela mesma lista branca do backup). Vale a mudanca mais recente por entrada; a local mais nova nunca e
 * sobrescrita. -> { marcados: [id] } = os que ficaram iguais ao servidor (aplicados ou ja iguais).
 */
export function aplicarRemotos(itens) {
    const doc = carregar();
    const marcados = [];
    let mudou = false;
    for (const item of itens) {
        const i = doc.entradas.findIndex((e) => e.id === item.id);
        const local = i >= 0 ? doc.entradas[i] : null;
        if (item.apagado) {
            if (!local) {
                marcados.push(item.id);
            } else if (atualizadoEm(local) <= item.atualizado_em) {
                doc.entradas.splice(i, 1);
                marcados.push(item.id);
                mudou = true;
            }
            continue;
        }
        const nova = sanearEntrada(item.dados);
        if (!nova || nova.id !== item.id) continue;
        if (!local) {
            doc.entradas.push(nova);
            marcados.push(item.id);
            mudou = true;
        } else if (item.atualizado_em > atualizadoEm(local)) {
            doc.entradas[i] = nova;
            marcados.push(item.id);
            mudou = true;
        } else if (item.atualizado_em === atualizadoEm(local)) {
            marcados.push(item.id);
        }
    }
    if (mudou) {
        aplicarLimite(doc);
        gravar(doc);
    }
    return { marcados };
}

/* ---------- recados entre telas ---------- */

/** A tela do diario, ao abrir, leva o foco para a nota desta entrada. */
export function pedirFoco(id) {
    focoPendente = id;
}
export function consumirFoco() {
    const id = focoPendente;
    focoPendente = null;
    return id;
}
export function consumirAviso() {
    const a = avisoPendente;
    avisoPendente = '';
    return a;
}

/* ---------- agrupamento por mes (so apresentacao; nao mexe nos dados) ---------- */

const RE_ID_DIA = /^dia-(\d{4})-(\d{2})-(\d{2})$/;
const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const fmtSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

/**
 * Data de calendario de uma entrada, no fuso do aparelho. A carta do dia usa a data do id
 * (o dia em que foi tirada); as demais usam `t`. Leitura antiga sem data legivel vem com semData.
 * -> { semData, ano, mes (1-12), dia, semana (abreviada, sem ponto), chave ('2026-11' ou 'sem-data'), iso ('2026-11-09') }
 */
export function diaDaEntrada(e) {
    if (e.rotulo && String(e.t).startsWith('2000-01-01')) return { semData: true, ano: 0, mes: 0, dia: 0, semana: '', chave: 'sem-data', iso: '' };
    const m = e.tipo === 'dia' ? RE_ID_DIA.exec(e.id) : null;
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : new Date(e.t);
    const ano = d.getFullYear();
    const mes = d.getMonth() + 1;
    const dia = d.getDate();
    const mm = String(mes).padStart(2, '0');
    return {
        semData: false, ano, mes, dia,
        semana: fmtSemana.format(d).replace('.', ''),
        chave: `${ano}-${mm}`,
        iso: `${ano}-${mm}-${String(dia).padStart(2, '0')}`,
    };
}

/** 'novembro de 2026' para a chave de um grupo. */
export function rotuloMes(ano, mes) {
    return fmtMes.format(new Date(ano, mes - 1, 15));
}

/** Agrupa entradas (ja ordenadas) por mes, na ordem em que cada mes aparece. -> [{ chave, ano, mes, itens }] */
export function agruparPorMes(entradas) {
    const grupos = new Map();
    for (const e of entradas) {
        const d = diaDaEntrada(e);
        let g = grupos.get(d.chave);
        if (!g) {
            g = { chave: d.chave, ano: d.ano, mes: d.mes, itens: [] };
            grupos.set(d.chave, g);
        }
        g.itens.push(e);
    }
    return [...grupos.values()];
}
