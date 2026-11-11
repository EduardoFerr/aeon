import { texto, grauTexto, SIGNO_ELEMENTO } from './mapaComum.js';
import { SIGNOS } from '../astro/constantes.js';

/**
 * Monta a leitura do mapa por secao a partir do mapa calculado e dos textos (public/data/astro/textos.json).
 * Funcao pura (sem DOM). Cada texto vem do id certo; se algum id faltar, ele entra em `faltas` e o trecho
 * simplesmente nao aparece (nunca "undefined" nem texto vazio na tela).
 *
 * Secao = { id, titulo, glifo, intro: [texto], ponto?, itens: [Item], notas: [{tipo, texto}] }
 *   ponto = dados do Sol, da Lua ou do Ascendente (fatos, cartas do decano, do signo e da Corte, paragrafos)
 *   Item  = { glifo, titulo, tag?, linhas: [texto curto], textos: [paragrafo], cartas: [{ order, nome, rotulo }] }
 */
const SIG = { aries: 'ari', touro: 'tau', gemeos: 'gem', cancer: 'can', leao: 'leo', virgem: 'vir', libra: 'lib', escorpiao: 'esc', sagitario: 'sag', capricornio: 'cap', aquario: 'aqu', peixes: 'pei' };
const PL = { sol: 'sol', lua: 'lua', mercurio: 'mer', venus: 'ven', marte: 'mar', jupiter: 'jup', saturno: 'sat', urano: 'ura', netuno: 'net', plutao: 'plu' };
const ASP = { conjuncao: 'con', sextil: 'sex', quadratura: 'qua', trigono: 'tri', oposicao: 'opo' };
const ORDINAL = ['primeiro', 'segundo', 'terceiro'];
const PLANETAS = ['mercurio', 'venus', 'marte', 'jupiter', 'saturno', 'urano', 'netuno', 'plutao'];
const GLIFO_ELEMENTO = { fogo: 'aries', terra: 'touro', ar: 'gemeos', agua: 'cancer' };
const REGENTE = { aries: 'Marte', touro: 'Vênus', gemeos: 'Mercúrio', cancer: 'Lua', leao: 'Sol', virgem: 'Mercúrio', libra: 'Vênus', escorpio: 'Marte', escorpiao: 'Marte e Plutão', sagitario: 'Júpiter', capricornio: 'Saturno', aquario: 'Saturno e Urano', peixes: 'Júpiter e Netuno' };
const MODALIDADES = [['card', 'Cardinal'], ['fix', 'Fixo'], ['mut', 'Mutável']];
const ELEMENTOS = [['fogo', 'Fogo'], ['terra', 'Terra'], ['ar', 'Ar'], ['agua', 'Água']];
/** Regentes do signo do Ascendente; nos tres signos de dupla regencia o texto mostra as duas. */
const REGENTES = {
    aries: ['marte'], touro: ['venus'], gemeos: ['mercurio'], cancer: ['lua'], leao: ['sol'], virgem: ['mercurio'], libra: ['venus'],
    escorpiao: ['marte', 'plutao'], sagitario: ['jupiter'], capricornio: ['saturno'], aquario: ['saturno', 'urano'], peixes: ['jupiter', 'netuno'],
};
const GLIFO_PONTO = (id) => (id === 'nodo_norte' || id === 'nodo_sul' ? 'nodo' : id);

/** "Quatro de Bastões" -> "quatro-de-bastoes" (ids gh.carta.* e gh.faixa.*). */
export const slugCarta = (nome) => String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const minusculo = (s) => s.charAt(0).toLowerCase() + s.slice(1);

export function montarLeitura(calc, textos) {
    const faltas = [];
    const T = (id, vars = {}) => {
        const bruto = textos && typeof textos[id] === 'string' ? textos[id] : '';
        const r = bruto ? texto(textos, id, vars) : '';
        if (!r.trim() || /\{\w+\}/.test(r)) {
            faltas.push(id);
            return '';
        }
        return r;
    };
    const lista = (...xs) => xs.filter((x) => typeof x === 'string' && x.trim());
    const P = calc.pontos;
    const semHora = calc.semHora;
    const casaTxt = (p) => (p.casa ? `, casa ${p.casa}` : '');

    /** Marcadores de gh.dec.*: {decano} sem artigo, {planeta} sem artigo, {grau} com o signo. */
    const varsPonte = (p) => ({
        carta: p.ponte && p.ponte.cartaDecano ? p.ponte.cartaDecano.nome : '',
        decano: `${ORDINAL[p.decano - 1]} decano`,
        planeta: p.regenteDecano,
        grau: `${p.grauInteiro}° de ${p.signoNome}`,
        signo: p.signoNome,
    });
    const perto = (p) => {
        const noDecano = p.grau % 10;
        return Math.min(noDecano, 10 - noDecano) < 1;
    };
    const pertoSigno = (p) => Math.min(p.grau, 30 - p.grau) < 1;

    /** Cartas ligadas a um ponto: decano, signo e Corte (as tres abrem o detalhe da carta). */
    const cartasDe = (p, comTodas = true) => {
        const b = p.ponte || {};
        const r = [];
        if (b.cartaDecano) r.push({ order: b.cartaDecano.order, nome: b.cartaDecano.nome, rotulo: `Carta do ${p.decano}º decano` });
        if (comTodas && b.cartaSigno) r.push({ order: b.cartaSigno.order, nome: b.cartaSigno.nome, rotulo: 'Carta do signo' });
        if (comTodas && b.cartaCorte) r.push({ order: b.cartaCorte.order, nome: b.cartaCorte.nome, rotulo: 'Corte' });
        return r;
    };
    const ponteDecano = (p, corpo) => {
        const c = p.ponte && p.ponte.cartaDecano;
        return lista(T(`gh.dec.${corpo}`, varsPonte(p)), c ? T(`gh.carta.${slugCarta(c.nome)}`) : '');
    };
    const ponteExtra = (p) => {
        const co = p.ponte && p.ponte.cartaCorte;
        return lista(co ? T(`gh.faixa.${slugCarta(co.nome)}`) : '', T(`gh.pos.${p.decano}`, { signo: p.signoNome }), perto(p) ? T('gh.cusp') : '');
    };
    const notasPonto = (p, id) => {
        const n = [];
        if (pertoSigno(p) && ['sol', 'lua', 'asc', 'mc'].includes(id)) n.push({ tipo: 'atencao', texto: T('ui.aviso.cuspide') });
        if (id === 'lua' && semHora && p.faixaDia && p.faixaDia.mudaDeSigno) n.push({ tipo: 'atencao', texto: T('ui.aviso.lua-troca') });
        return n.filter((x) => x.texto);
    };
    const fatosDe = (p) => {
        const f = [['Corpo', p.nome], ['Signo', p.signoNome], ['Grau', grauTexto(p)]];
        if (p.casa) f.push(['Casa', String(p.casa)]);
        f.push(['Decano', `${p.decano}º`]);
        const sg = SIGNOS.find((x) => x.id === p.signo);
        if (sg) {
            f.push(['Elemento', sg.elemento], ['Modalidade', sg.modalidade === 'Cardinal' ? 'Cardeal' : sg.modalidade]);
            if (REGENTE[p.signo]) f.push(['Regente', REGENTE[p.signo]]);
        }
        return f;
    };
    const ponto = (id, chave, titulo, glifo, introId) => {
        const p = P[id];
        const sig = SIG[p.signo];
        return {
            id, titulo, glifo, intro: lista(T(introId)), notas: notasPonto(p, id),
            ponto: {
                id, nome: p.nome, signo: p.signo, signoNome: p.signoNome, grau: grauTexto(p), casa: p.casa || null, decano: p.decano,
                elemento: SIGNO_ELEMENTO[p.signo], fatos: fatosDe(p), cartas: cartasDe(p),
                cartaDecano: p.ponte && p.ponte.cartaDecano,
                fraseCarta: p.ponte && p.ponte.cartaDecano ? T(`gh.carta.${slugCarta(p.ponte.cartaDecano.nome)}`) : '',
                paragrafos: [
                    ...lista(T(id === 'asc' ? `asc.${sig}` : `ps.${chave}.${sig}`)),
                    ...(id !== 'asc' && p.casa ? lista(T(`pc.${chave}.${p.casa}`)) : []),
                    ...[ponteDecano(p, chave).join(' ')].filter(Boolean),
                    ...ponteExtra(p),
                ],
            },
            itens: [],
        };
    };

    const secoes = [];
    secoes.push(ponto('sol', 'sol', `Sol em ${P.sol.signoNome}`, 'sol', 'ui.sec.sol'));
    secoes.push(ponto('lua', 'lua', `Lua em ${P.lua.signoNome}`, 'lua', 'ui.sec.lua'));

    // Ascendente (+ Meio do Ceu + regente), ou o aviso de hora desconhecida
    if (semHora) {
        secoes.push({ id: 'asc', titulo: 'Ascendente', glifo: 'asc', intro: lista(T('ui.sec.asc')), notas: [{ tipo: 'atencao', texto: T('ui.aviso.semhora') }], itens: [], semHora: true });
    } else {
        const s = ponto('asc', 'asc', `Ascendente em ${P.asc.signoNome}`, 'asc', 'ui.sec.asc');
        const mc = P.mc;
        s.itens.push({
            glifo: 'mc', titulo: `Meio do Céu em ${mc.signoNome}`, linhas: [`${grauTexto(mc)}${casaTxt({ casa: 10 })}`],
            textos: [...lista(T(`mc.${SIG[mc.signo]}`)), ...ponteDecano(mc, 'mc')],
            cartas: cartasDe(mc, false), notas: notasPonto(mc, 'mc'),
        });
        const regs = REGENTES[P.asc.signo].map((id) => P[id]).filter(Boolean);
        s.itens.push(...regs.map((r) => ({
            glifo: GLIFO_PONTO(r.id), titulo: `Regente do Ascendente: ${r.nome}${casaTxt(r)}`, linhas: [`${r.nome} em ${r.signoNome}, ${grauTexto(r)}`],
            textos: lista(T(`rg.asc.${r.casa}`, { planeta: r.nome })), cartas: [], intro: null,
        })));
        s.introRegente = T('ui.sec.regente');
        secoes.push(s);
    }

    // Planetas
    secoes.push({
        id: 'planetas', titulo: 'Planetas', glifo: 'mercurio', intro: lista(T('ui.sec.planetas')), notas: [],
        itens: PLANETAS.map((id) => {
            const p = P[id];
            return {
                glifo: id, titulo: `${p.nome} em ${p.signoNome}${casaTxt(p)}`, tag: p.retrogrado ? 'R' : null, tagTexto: p.retrogrado ? 'retrógrado' : null,
                linhas: [`${grauTexto(p)}, ${p.decano}º decano`],
                textos: [...lista(T(`ps.${PL[id]}.${SIG[p.signo]}`)), ...(p.casa ? lista(T(`pc.${PL[id]}.${p.casa}`)) : []), ...(ponteDecano(p, PL[id]).length ? [ponteDecano(p, PL[id]).join(' ')] : [])],
                cartas: cartasDe(p, false),
            };
        }),
    });

    // Casas
    if (semHora) {
        secoes.push({ id: 'casas', titulo: 'Casas', glifo: 'mc', intro: lista(T('ui.sec.casas')), notas: [{ tipo: 'atencao', texto: T('ui.aviso.semhora') }], itens: [], semHora: true });
    } else {
        const ocupantes = {};
        for (const [id, p] of Object.entries(P)) if (p.casa && id !== 'nodo_sul') (ocupantes[p.casa] ||= []).push(p.nome);
        const notas = [];
        if (calc.casas.sistema === 'signos-inteiros' && calc.casas.solicitado !== 'signos-inteiros') notas.push({ tipo: 'info', texto: T('ui.aviso.latalta') });
        secoes.push({
            id: 'casas', titulo: 'Casas', glifo: 'mc', intro: lista(T('ui.sec.casas')), notas,
            itens: calc.casas.cuspides.map((c) => ({
                glifo: 'mc', titulo: `Casa ${c.casa}, ${c.signoNome}`, linhas: [`Começa a ${c.grauInteiro}°${String(c.minuto).padStart(2, '0')}′ de ${c.signoNome}`, ocupantes[c.casa] ? `Astros: ${ocupantes[c.casa].join(', ')}` : 'Nenhum astro nesta casa'],
                textos: [], cartas: [],
            })),
        });
    }

    // Aspectos
    const itensAsp = [];
    for (const a of calc.aspectos) {
        const pa = P[a.a], pb = P[a.b];
        if (!pa || !pb || !ASP[a.tipo]) continue;
        let txt = '';
        const angulo = (id) => id === 'asc' || id === 'mc';
        if (angulo(a.a) && angulo(a.b)) continue; // Ascendente com Meio do Ceu nao tem texto proprio
        if (angulo(a.b)) {
            txt = ['conjuncao', 'quadratura', 'oposicao'].includes(a.tipo) ? T(`aa.${PL[a.a]}.${a.b}.${ASP[a.tipo]}`) : T(`ah.${a.b}`, { planeta: pa.nome });
        } else if (PL[a.a] && PL[a.b]) {
            txt = T(`as.${PL[a.a]}.${PL[a.b]}.${ASP[a.tipo]}`);
        } else continue;
        if (!txt) continue;
        const o = a.orbe;
        itensAsp.push({
            glifo: GLIFO_PONTO(a.a), glifo2: GLIFO_PONTO(a.b), titulo: `${pa.nome} ${minusculo(a.nome)} ${pb.nome}`,
            linhas: [`Orbe de ${Math.floor(o)}°${String(Math.round((o - Math.floor(o)) * 60)).padStart(2, '0')}′${a.fase && a.fase !== 'exato' ? `, ${a.fase}` : a.fase === 'exato' ? ', exato' : ''}`],
            textos: [txt], cartas: [],
        });
    }
    secoes.push({ id: 'aspectos', titulo: 'Aspectos', glifo: null, intro: lista(T('ui.sec.aspectos')), legenda: T('ui.legenda.aspectos'), notas: semHora ? [{ tipo: 'info', texto: 'Sem a hora, os aspectos da Lua não são calculados e o Ascendente e o Meio do Céu ficam de fora.' }] : [], itens: itensAsp });

    // Nodos
    const nn = P.nodo_norte, ns = P.nodo_sul;
    secoes.push({
        id: 'nodos', titulo: 'Nodos', glifo: 'nodo', intro: lista(T('ui.sec.nodos')), notas: [],
        itens: [
            { glifo: 'nodo', titulo: `Nodo Norte em ${nn.signoNome}${casaTxt(nn)}`, linhas: [grauTexto(nn)], textos: [...lista(T(`nn.s.${SIG[nn.signo]}`)), ...(nn.casa ? lista(T(`nn.c.${nn.casa}`)) : [])], cartas: cartasDe(nn, false) },
            { glifo: 'nodo', titulo: `Nodo Sul em ${ns.signoNome}${casaTxt(ns)}`, linhas: [grauTexto(ns)], textos: lista(T(`ns.s.${SIG[ns.signo]}`)), cartas: cartasDe(ns, false) },
        ],
    });

    // Retrogradacao
    const retros = PLANETAS.map((id) => P[id]).filter((p) => p.retrogrado);
    secoes.push({
        id: 'retro', titulo: 'Retrogradação', glifo: 'retro', intro: lista(T('ui.sec.retro')),
        notas: retros.length ? [] : [{ tipo: 'info', texto: T('ui.aviso.sem-retro') }].filter((n) => n.texto),
        itens: retros.map((p) => ({ glifo: GLIFO_PONTO(p.id), titulo: `${p.nome} retrógrado`, tag: 'R', tagTexto: 'retrógrado', linhas: [`${p.nome} em ${p.signoNome}, ${grauTexto(p)}`], textos: lista(T(`rt.${PL[p.id]}`)), cartas: [] })),
    });

    // Elementos e modalidades
    const itensEl = [];
    const bloco = (tabela, contagem, prefixo, eqId, glifoDe, rotuloUnidade) => {
        const dom = [], fal = [];
        for (const [k, nome] of tabela) {
            const n = contagem[nome] || 0;
            if (n >= 4) dom.push([k, nome, n]); else if (n <= 1) fal.push([k, nome, n]);
        }
        const qtd = (n) => `${n} ${n === 1 ? 'astro' : 'astros'}`;
        for (const [k, nome, n] of dom) itensEl.push({ glifo: glifoDe(k), titulo: `${rotuloUnidade(nome)} predomina`, linhas: [qtd(n)], textos: lista(T(`${prefixo}.dom.${k}`)), cartas: [] });
        for (const [k, nome, n] of fal) itensEl.push({ glifo: glifoDe(k), titulo: `${rotuloUnidade(nome)} em falta`, linhas: [qtd(n)], textos: lista(T(`${prefixo}.fal.${k}`)), cartas: [] });
        if (!dom.length && !fal.length) itensEl.push({ glifo: null, titulo: prefixo === 'el' ? 'Elementos distribuídos' : 'Modalidades distribuídas', linhas: [], textos: lista(T(eqId)), cartas: [] });
    };
    bloco(ELEMENTOS, calc.resumo.elementos, 'el', 'el.eq', (k) => GLIFO_ELEMENTO[k], (n) => n);
    bloco(MODALIDADES, calc.resumo.modalidades, 'mo', 'mo.eq', () => null, (n) => `Modalidade ${n.toLowerCase()}`);
    secoes.push({ id: 'elementos', titulo: 'Elementos e modalidades', glifo: 'aries', intro: lista(T('ui.sec.elementos')), notas: [], itens: itensEl });

    return { secoes, faltas: [...new Set(faltas)] };
}

/** Texto simples de uma secao, para copiar e compartilhar. */
export function textoDaSecao(s) {
    const partes = [s.titulo];
    if (s.ponto) partes.push(...s.ponto.paragrafos);
    for (const it of s.itens || []) {
        const cab = it.titulo + (it.linhas && it.linhas.length ? ` (${it.linhas.join('; ')})` : '');
        partes.push([cab, ...(it.textos || [])].join('\n'));
    }
    if (s.semHora) partes.push(...s.notas.map((n) => n.texto));
    return partes.join('\n\n');
}
