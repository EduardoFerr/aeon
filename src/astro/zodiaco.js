import { SIGNOS, ORDEM_CALDEIA } from './constantes.js';

/** Normaliza qualquer angulo para [0, 360). */
export function norm360(x) {
  const r = x % 360;
  const v = r < 0 ? r + 360 : r;
  return v >= 360 ? 0 : v; // protege -1e-17 % 360
}

/** Diferenca assinada a - b normalizada para [-180, 180). */
export function difAngular(a, b) {
  return norm360(a - b + 180) - 180;
}

/**
 * Posicao zodiacal de uma longitude eclitica.
 * @returns {{lon:number, signo:string, signoNome:string, signoIndice:number, grau:number, grauInteiro:number, minuto:number, decano:number, regenteDecano:string}}
 */
export function posicaoZodiacal(lon) {
  const l = norm360(lon);
  let idx = Math.floor(l / 30);
  if (idx > 11) idx = 11;
  const grau = l - idx * 30; // [0, 30)
  const decano = Math.min(2, Math.floor(grau / 10)) + 1;
  const grauInteiro = Math.floor(grau);
  const minuto = Math.min(59, Math.floor((grau - grauInteiro) * 60));
  return {
    lon: l,
    signo: SIGNOS[idx].id,
    signoNome: SIGNOS[idx].nome,
    signoIndice: idx,
    grau,
    grauInteiro,
    minuto,
    decano,
    regenteDecano: regenteDoDecano(idx, decano),
  };
}

/** Regente do decano na ordem caldeia, a partir de Marte em Aries (decano 1). */
export function regenteDoDecano(signoIndice, decano) {
  return ORDEM_CALDEIA[(signoIndice * 3 + (decano - 1)) % 7];
}

/** "20° Câncer a 20° Leão" -> { inicio, fim } em longitude (fim pode ser < inicio quando cruza 0 Aries). */
export function parseFaixaCorte(texto) {
  const m = /^(\d+)°\s*(\S+)\s+a\s+(\d+)°\s*(\S+)$/u.exec(String(texto || '').trim());
  if (!m) return null;
  const idx = (nome) => SIGNOS.findIndex((s) => s.nome === nome);
  const a = idx(m[2]);
  const b = idx(m[4]);
  if (a < 0 || b < 0) return null;
  return { inicio: a * 30 + Number(m[1]), fim: b * 30 + Number(m[3]) };
}

function resumoCarta(c) {
  if (!c) return null;
  return { order: c.order, nome: c.name, titulo: c.title ?? null };
}

/**
 * Indexa cards.json para consultas por signo, decano, planeta e faixa de Corte.
 * @param {Array} cartas conteudo de public/data/cards.json
 */
export function indexarCartas(cartas) {
  const porSigno = {};
  const porPlaneta = {};
  const decanos = {};
  const corte = [];
  for (const c of cartas || []) {
    if (c.isMajorArcana && c.sign) porSigno[c.sign] = c;
    if (c.isMajorArcana && c.planet) porPlaneta[c.planet] = c;
    if (c.decan && c.decan.sign && c.decan.number) decanos[`${c.decan.sign}|${c.decan.number}`] = c;
    if (c.zodiac_range) {
      const f = parseFaixaCorte(c.zodiac_range);
      if (f) corte.push({ ...f, carta: c });
    }
  }
  return { porSigno, porPlaneta, decanos, corte };
}

/** Carta de Corte cuja faixa contem a longitude (intervalo semiaberto [inicio, fim)). */
export function cartaDeCorte(idx, lon) {
  const l = norm360(lon);
  for (const f of idx.corte) {
    const dentro = f.inicio <= f.fim ? l >= f.inicio && l < f.fim : l >= f.inicio || l < f.fim;
    if (dentro) return f.carta;
  }
  return null;
}

/** Ponte com o Tarot de Thoth para uma longitude: carta do signo, do decano e de Corte. */
export function ponteDaLongitude(idx, lon) {
  const p = posicaoZodiacal(lon);
  const decan = idx.decanos[`${p.signoNome}|${p.decano}`] || null;
  return {
    cartaSigno: resumoCarta(idx.porSigno[p.signoNome]),
    cartaDecano: resumoCarta(decan),
    regenteDecanoConfere: decan ? decan.decan.planet === p.regenteDecano : null,
    cartaCorte: resumoCarta(cartaDeCorte(idx, lon)),
  };
}

export function cartaDoPlaneta(idx, nomePlaneta) {
  return resumoCarta(idx.porPlaneta[nomePlaneta]);
}
