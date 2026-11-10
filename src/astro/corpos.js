import * as Astronomy from 'astronomy-engine';
import { CORPOS } from './constantes.js';
import { norm360, difAngular } from './zodiaco.js';

/** Longitude eclitica aparente (verdadeira da data), em graus, de um corpo num instante (Date). */
export function longitudeCorpo(engineNome, data) {
  const tempo = Astronomy.MakeTime(data);
  const body = Astronomy.Body[engineNome];
  // GeoVector devolve coordenadas J2000 (EQJ): precisa de precessao e nutacao (EQJ -> ecliptico verdadeiro da data).
  const v = Astronomy.GeoVector(body, tempo, true);
  const rot = Astronomy.Rotation_EQJ_ECT(tempo);
  const e = Astronomy.RotateVector(rot, v);
  return norm360(Astronomy.SphereFromVector(e).lon);
}

const MEIO_DIA_MS = 12 * 3600e3;

/** Velocidade em graus/dia (diferenca central de +-12h). Negativa = movimento retrogrado. */
export function velocidadeCorpo(engineNome, data) {
  const a = longitudeCorpo(engineNome, new Date(data.getTime() - MEIO_DIA_MS));
  const b = longitudeCorpo(engineNome, new Date(data.getTime() + MEIO_DIA_MS));
  return difAngular(b, a);
}

/**
 * Nodo medio ascendente da Lua (Nodo Norte), em graus.
 * Meeus, Astronomical Algorithms 2a ed., eq. 47.7, T em seculos julianos de TT desde J2000.
 */
export function nodoNorteMedio(data) {
  const T = Astronomy.MakeTime(data).tt / 36525;
  const omega =
    125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T * T * T) / 467441 - (T * T * T * T) / 60616000;
  return norm360(omega);
}

/** Velocidade media do nodo medio, graus/dia (negativa: o nodo anda para tras). */
export function velocidadeNodoMedio(data) {
  const a = nodoNorteMedio(new Date(data.getTime() - MEIO_DIA_MS));
  const b = nodoNorteMedio(new Date(data.getTime() + MEIO_DIA_MS));
  return difAngular(b, a);
}

/** Calcula longitude e velocidade dos 10 corpos. Sol e Lua nunca sao retrogrados. */
export function calcularCorpos(data) {
  const out = {};
  for (const c of CORPOS) {
    const lon = longitudeCorpo(c.engine, data);
    const velocidade = velocidadeCorpo(c.engine, data);
    out[c.id] = { id: c.id, nome: c.nome, lon, velocidade, retrogrado: c.id !== 'sol' && c.id !== 'lua' && velocidade < 0 };
  }
  return out;
}

/** Tempo sideral aparente de Greenwich em graus. */
export function tempoSideralGreenwich(data) {
  return norm360(Astronomy.SiderealTime(Astronomy.MakeTime(data)) * 15);
}

/** Obliquidade verdadeira da eclitica (graus). */
export function obliquidadeVerdadeira(data) {
  return Astronomy.e_tilt(Astronomy.MakeTime(data)).tobl;
}
