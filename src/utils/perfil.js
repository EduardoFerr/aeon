import { exportar as exportarDiario, importar as importarDiario } from './diario.js';

/**
 * Perfil e mapas astrais guardados, so no aparelho.
 *
 * Chave: "aeon:v2:perfil"  ->  { v: 2, apelido?, mapas: [Mapa] }
 *   Mapa = { id, rotulo, data "AAAA-MM-DD", hora "HH:MM" | null, local: { nome, lat, lon, tz }, principal, escolha?, criado }
 *   escolha = 0 ou 1: qual das duas leituras vale quando a hora local e ambigua ou inexistente.
 *   casas = 'placidus' | 'signos-inteiros' | 'igual': sistema de casas preferido para este mapa.
 * Um so mapa pode ser o principal ("Meu mapa"). "Meus dados" e a visao e a edicao desse mapa mais o apelido.
 * So se guarda o que muda o calculo: apelido, data, hora e cidade (o fuso vem da cidade). Nome completo, sexo, estado civil,
 * profissao e "signo que a pessoa acha que e" ficam de fora de proposito: nao alteram o mapa e seriam dado pessoal sem funcao.
 * Os dados de nascimento nunca saem do aparelho:
 * nada vai para URL, hash, console nem analytics.
 *
 * Tudo em try/catch: modo privado, bloqueado, quota cheia ou JSON corrompido nao quebram nada.
 */
export const CHAVE_PERFIL = 'aeon:v2:perfil';
export const LIMITE_MAPAS = 50;
export const LIMITE_ARQUIVO = 1024 * 1024; // 1 MB
export const LIMITE_APELIDO = 30;
export const LIMITE_ROTULO = 40;
export const FORMATO_BACKUP = 1;

export const SISTEMAS_CASAS = ['placidus', 'signos-inteiros', 'igual'];
const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const RE_TZ = /^[A-Za-z0-9_+\-/]{1,64}$/;
const PERIGOSAS = ['__proto__', 'constructor', 'prototype'];
const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

let memoria = null;
let gravacaoFalhou = false;
let leituraFalhou = false;
const ouvintes = new Set();

const vazio = () => ({ v: 2, mapas: [] });

/* ---------- sanitizacao ---------- */

function limparTexto(valor, max) {
    if (typeof valor !== 'string') return '';
    return valor.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function dataValida(data) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof data === 'string' ? data : '');
    if (!m) return null;
    const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (a < 1800 || a > 2100) return null;
    const t = new Date(0);
    t.setUTCFullYear(a, me - 1, d);
    return t.getUTCFullYear() === a && t.getUTCMonth() === me - 1 && t.getUTCDate() === d ? data : null;
}

function horaValida(hora) {
    if (hora === null) return null;
    const m = /^(\d{2}):(\d{2})$/.exec(typeof hora === 'string' ? hora : '');
    return m && Number(m[1]) <= 23 && Number(m[2]) <= 59 ? hora : undefined;
}

function fusoValido(tz) {
    if (typeof tz !== 'string' || !RE_TZ.test(tz)) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch (e) {
        return false;
    }
}

/** Chave que identifica "o mesmo mapa": mesma data, mesma hora e mesmo lugar. */
export function chaveMapa(m) {
    return [m.data, m.hora || '-', m.local.lat.toFixed(2), m.local.lon.toFixed(2), m.local.tz].join('|');
}

/** Constroi um mapa so com a lista branca de campos, ou devolve null se nao servir. */
export function sanearMapa(bruto) {
    if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null;
    if (PERIGOSAS.some((k) => tem(bruto, k))) return null;
    if (typeof bruto.id !== 'string' || !RE_ID.test(bruto.id)) return null;
    const data = tem(bruto, 'data') ? dataValida(bruto.data) : null;
    if (!data) return null;
    const hora = tem(bruto, 'hora') ? horaValida(bruto.hora) : undefined;
    if (hora === undefined) return null;
    const l = bruto.local;
    if (!l || typeof l !== 'object' || Array.isArray(l) || PERIGOSAS.some((k) => tem(l, k))) return null;
    const { lat, lon, tz } = l;
    if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) return null;
    if (typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180) return null;
    if (!fusoValido(tz)) return null;
    const nome = limparTexto(l.nome, 120);
    const mapa = {
        id: bruto.id,
        rotulo: limparTexto(bruto.rotulo, LIMITE_ROTULO),
        data,
        hora,
        local: { nome: nome || `${lat.toFixed(2)}, ${lon.toFixed(2)}`, lat, lon, tz },
        principal: bruto.principal === true,
        escolha: bruto.escolha === 1 ? 1 : 0,
        casas: SISTEMAS_CASAS.includes(bruto.casas) ? bruto.casas : 'placidus',
        criado: typeof bruto.criado === 'string' && Number.isFinite(Date.parse(bruto.criado)) && bruto.criado.length < 40 ? new Date(bruto.criado).toISOString() : new Date(0).toISOString(),
    };
    if (!mapa.rotulo) mapa.rotulo = mapa.principal ? 'Meu mapa' : 'Mapa';
    return mapa;
}

function sanearDoc(bruto) {
    const doc = vazio();
    if (!bruto || typeof bruto !== 'object' || bruto.v !== 2) return doc;
    if (typeof bruto.apelido === 'string') {
        const ap = limparTexto(bruto.apelido, LIMITE_APELIDO);
        if (ap) doc.apelido = ap;
    }
    const ids = new Set();
    const chaves = new Set();
    let temPrincipal = false;
    if (Array.isArray(bruto.mapas)) {
        for (const b of bruto.mapas.slice(0, LIMITE_MAPAS * 2)) {
            const m = sanearMapa(b);
            if (!m || ids.has(m.id) || chaves.has(chaveMapa(m))) continue;
            if (m.principal && temPrincipal) m.principal = false;
            if (m.principal) temPrincipal = true;
            ids.add(m.id);
            chaves.add(chaveMapa(m));
            doc.mapas.push(m);
            if (doc.mapas.length >= LIMITE_MAPAS) break;
        }
    }
    return doc;
}

/* ---------- leitura e gravacao ---------- */

function carregar() {
    let bruto;
    try {
        bruto = localStorage.getItem(CHAVE_PERFIL);
        leituraFalhou = false;
    } catch (e) {
        leituraFalhou = true;
        return memoria || vazio();
    }
    if (gravacaoFalhou && memoria) return memoria;
    if (bruto == null) return vazio();
    try {
        return sanearDoc(JSON.parse(bruto));
    } catch (e) {
        return vazio();
    }
}

function gravar(doc) {
    memoria = doc;
    let ok = true;
    try {
        localStorage.setItem(CHAVE_PERFIL, JSON.stringify(doc));
        gravacaoFalhou = false;
    } catch (e) {
        gravacaoFalhou = true;
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

export function aoMudar(fn) {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key === CHAVE_PERFIL || e.key === null) avisar();
    });
}

/** O navegador deixa guardar dados? */
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

/* ---------- API ---------- */

export function apelido() {
    return carregar().apelido || '';
}

export function definirApelido(texto) {
    const doc = carregar();
    const ap = limparTexto(texto, LIMITE_APELIDO);
    if (ap) doc.apelido = ap;
    else delete doc.apelido;
    return gravar(doc);
}

/** Mapas guardados: o principal primeiro, depois do mais novo para o mais antigo. */
export function listar() {
    const ms = carregar().mapas.slice();
    return ms.sort((a, b) => (b.principal - a.principal) || (a.criado < b.criado ? 1 : a.criado > b.criado ? -1 : 0));
}

export function obter(id) {
    return carregar().mapas.find((m) => m.id === id) || null;
}

export function principal() {
    return carregar().mapas.find((m) => m.principal) || null;
}

function novoId() {
    return `mapa-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
}

/**
 * Guarda um mapa. entrada: { rotulo, data, hora, local, escolha, principal }.
 * Se ja existe o mesmo mapa (data, hora e lugar), nao duplica: devolve o existente com repetido: true.
 */
export function adicionar(entrada) {
    const doc = carregar();
    const quer = entrada.principal === true && !doc.mapas.some((m) => m.principal);
    const m = sanearMapa({ ...entrada, id: novoId(), principal: quer, criado: new Date().toISOString() });
    if (!m) return { ok: false, motivo: 'invalido' };
    const igual = doc.mapas.find((x) => chaveMapa(x) === chaveMapa(m));
    if (igual) return { ok: true, id: igual.id, repetido: true };
    if (doc.mapas.length >= LIMITE_MAPAS) return { ok: false, motivo: 'limite' };
    doc.mapas.push(m);
    return { ok: gravar(doc), id: m.id };
}

/** Os dados que definem a hora (e a leitura das casas) mudaram? Mesma data, hora e lugar = mesma definicao. */
export function mesmaDefinicao(a, b) {
    if (!a || !b || !a.local || !b.local) return false;
    return a.data === b.data && (a.hora || null) === (b.hora || null) && a.local.lat === b.local.lat && a.local.lon === b.local.lon && a.local.tz === b.local.tz;
}

/**
 * Atualiza os dados de um mapa mantendo id, criado e se e o principal.
 * Se data, hora e lugar nao mudaram, preserva a escolha da hora ambigua e o sistema de casas ja gravados;
 * se mudaram, a escolha vem da entrada e o sistema de casas volta ao padrao (a pessoa escolhe de novo).
 */
export function atualizar(id, entrada) {
    const doc = carregar();
    const i = doc.mapas.findIndex((m) => m.id === id);
    if (i < 0) return { ok: false, motivo: 'ausente' };
    const atual = doc.mapas[i];
    const mesma = mesmaDefinicao(atual, entrada);
    const escolha = mesma ? atual.escolha : entrada.escolha;
    const casas = SISTEMAS_CASAS.includes(entrada.casas) ? entrada.casas : mesma ? atual.casas : 'placidus';
    const m = sanearMapa({ ...entrada, escolha, casas, id, principal: atual.principal, criado: atual.criado });
    if (!m) return { ok: false, motivo: 'invalido' };
    if (doc.mapas.some((x, j) => j !== i && chaveMapa(x) === chaveMapa(m))) return { ok: false, motivo: 'repetido' };
    doc.mapas[i] = m;
    return { ok: gravar(doc), id };
}

/**
 * "Meus dados": grava o apelido e cria ou atualiza o mapa PRINCIPAL. entrada: { apelido?, data, hora, local, escolha }.
 * Sem principal, cria e guarda direto (a pessoa informou os proprios dados). Se esses dados ja estavam guardados
 * como outro mapa, esse mapa passa a ser o principal, sem duplicar.
 * @returns {{ok:boolean, id?:string, criado?:boolean, motivo?:string}}
 */
export function salvarMeusDados(entrada) {
    const { apelido: ap, ...dados } = entrada || {};
    const p = principal();
    let r;
    if (p) {
        r = atualizar(p.id, { ...dados, rotulo: p.rotulo });
    } else {
        r = adicionar({ ...dados, rotulo: 'Meu mapa', principal: true });
        if (r.id && r.repetido) {
            const doc = carregar();
            const m = doc.mapas.find((x) => x.id === r.id);
            if (m) {
                m.principal = true;
                m.rotulo = 'Meu mapa';
                r = { ok: gravar(doc), id: m.id };
            }
        }
        if (r.id) r.criado = true;
    }
    if (!r.id) return r;
    if (typeof ap === 'string') definirApelido(ap);
    return r;
}

/** Grava so as preferencias de leitura de um mapa guardado: qual hora vale (escolha) e o sistema de casas. */
export function definirPreferencias(id, { escolha, casas }) {
    const doc = carregar();
    const m = doc.mapas.find((x) => x.id === id);
    if (!m) return false;
    if (escolha === 0 || escolha === 1) m.escolha = escolha;
    if (SISTEMAS_CASAS.includes(casas)) m.casas = casas;
    return gravar(doc);
}

export function apagar(id) {
    const doc = carregar();
    doc.mapas = doc.mapas.filter((m) => m.id !== id);
    return gravar(doc);
}

/** Copia do perfil agora, para o Desfazer de uma exclusao. */
export function instantaneo() {
    return JSON.parse(JSON.stringify(carregar()));
}

/** Devolve o perfil ao estado da copia (o Desfazer). */
export function restaurar(copia) {
    return gravar(sanearDoc(copia));
}

/* ---------- backup (perfil e diario em um arquivo so) ---------- */

export function exportar() {
    const doc = carregar();
    const perfil = { v: 2, mapas: doc.mapas };
    if (doc.apelido) perfil.apelido = doc.apelido;
    return { app: 'aeon', formato: FORMATO_BACKUP, exportado: new Date().toISOString(), perfil, diario: exportarDiario() };
}

/**
 * Importa o backup unico. O conteudo e DADO NAO CONFIAVEL. Junta sem apagar nada e sem duplicar mapas
 * repetidos (mesma data, hora e lugar).
 * @returns {{ok:boolean, motivo?:string, mapas:number, repetidos:number, ignorados:number, diario?:{importadas:number, ignoradas:number}}}
 */
export function importar(texto) {
    const falha = (motivo) => ({ ok: false, motivo, mapas: 0, repetidos: 0, ignorados: 0 });
    if (typeof texto !== 'string' || texto.length > LIMITE_ARQUIVO) return falha('O arquivo passa de 1 MB.');
    let bruto;
    try {
        bruto = JSON.parse(texto);
    } catch (e) {
        return falha('Este arquivo não é um backup do Aeon Fool (JSON inválido).');
    }
    if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto) || bruto.app !== 'aeon' || bruto.formato !== FORMATO_BACKUP) {
        return falha('Este arquivo não é um backup do Aeon Fool.');
    }
    const doc = carregar();
    const chaves = new Set(doc.mapas.map(chaveMapa));
    const ids = new Set(doc.mapas.map((m) => m.id));
    let temPrincipal = doc.mapas.some((m) => m.principal);
    let mapas = 0;
    let repetidos = 0;
    let ignorados = 0;
    const p = bruto.perfil;
    if (p && typeof p === 'object' && !Array.isArray(p)) {
        if (!doc.apelido && typeof p.apelido === 'string') {
            const ap = limparTexto(p.apelido, LIMITE_APELIDO);
            if (ap) doc.apelido = ap;
        }
        const lista = Array.isArray(p.mapas) ? p.mapas : [];
        ignorados += Math.max(0, lista.length - LIMITE_MAPAS * 2);
        for (const b of lista.slice(0, LIMITE_MAPAS * 2)) {
            const m = sanearMapa(b);
            if (!m) {
                ignorados++;
                continue;
            }
            if (chaves.has(chaveMapa(m))) {
                repetidos++;
                continue;
            }
            if (doc.mapas.length >= LIMITE_MAPAS) {
                ignorados++;
                continue;
            }
            if (ids.has(m.id)) m.id = novoId();
            if (m.principal && temPrincipal) m.principal = false;
            if (m.principal) temPrincipal = true;
            ids.add(m.id);
            chaves.add(chaveMapa(m));
            doc.mapas.push(m);
            mapas++;
        }
    }
    const gravou = gravar(doc);
    let diario;
    if (bruto.diario && typeof bruto.diario === 'object') {
        const r = importarDiario(JSON.stringify(bruto.diario));
        diario = { importadas: r.importadas || 0, ignoradas: r.ignoradas || 0 };
    }
    return { ok: gravou, mapas, repetidos, ignorados, diario };
}
