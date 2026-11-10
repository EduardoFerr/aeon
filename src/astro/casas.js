import { LATITUDE_LIMITE_PLACIDUS } from './constantes.js';
import { norm360 } from './zodiaco.js';
import { tempoSideralGreenwich, obliquidadeVerdadeira } from './corpos.js';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Longitude eclitica de um ponto da eclitica com ascensao reta `ra` (graus) e obliquidade `eps`. */
function lonDaAscensaoReta(ra, eps) {
  return norm360(Math.atan2(Math.sin(ra * RAD), Math.cos(ra * RAD) * Math.cos(eps * RAD)) * DEG);
}

/** Declinacao de um ponto da eclitica de longitude `lon`. */
function declinacaoDaLongitude(lon, eps) {
  return Math.asin(Math.sin(eps * RAD) * Math.sin(lon * RAD)) * DEG;
}

/**
 * Ascendente e Meio do Ceu.
 * @param {Date} data instante UTC
 * @param {number} lat latitude (graus, norte positivo)
 * @param {number} lon longitude (graus, leste positivo)
 * @returns {{asc:number, mc:number, ramc:number, obliquidade:number}}
 */
export function calcularAngulos(data, lat, lon) {
  const eps = obliquidadeVerdadeira(data);
  const ramc = norm360(tempoSideralGreenwich(data) + lon);
  const th = ramc * RAD;
  const e = eps * RAD;
  const mc = norm360(Math.atan2(Math.sin(th), Math.cos(th) * Math.cos(e)) * DEG);
  // Ascendente: ponto da eclitica que nasce no horizonte leste.
  const asc = norm360(
    Math.atan2(Math.cos(th), -(Math.sin(th) * Math.cos(e) + Math.tan(lat * RAD) * Math.sin(e))) * DEG
  );
  return { asc, mc, ramc, obliquidade: eps };
}

/**
 * Cuspides Placidus (casas 1 a 12) por semiarcos. Devolve null se nao existir (latitude polar)
 * ou se a iteracao nao convergir.
 */
export function cuspidesPlacidus({ asc, mc, ramc, obliquidade }, lat) {
  const eps = obliquidade;
  const tanLat = Math.tan(lat * RAD);
  // frac: fracao do semiarco; diurno: casas 11 e 12 (acima do horizonte), noturno: 2 e 3.
  const cuspide = (frac, diurno) => {
    let ra = diurno ? ramc + 30 : ramc + 150; // chute inicial
    for (let i = 0; i < 60; i++) {
      const lonC = lonDaAscensaoReta(ra, eps);
      const dec = declinacaoDaLongitude(lonC, eps);
      const x = -tanLat * Math.tan(dec * RAD);
      if (!(Math.abs(x) < 1)) return null; // circumpolar neste ponto
      const sda = Math.acos(x) * DEG; // semiarco diurno
      const nova = diurno ? ramc + frac * sda : ramc + 180 - frac * (180 - sda);
      if (Math.abs(nova - ra) < 1e-10) return lonDaAscensaoReta(nova, eps);
      ra = nova;
    }
    return null;
  };
  const c11 = cuspide(1 / 3, true);
  const c12 = cuspide(2 / 3, true);
  const c2 = cuspide(2 / 3, false);
  const c3 = cuspide(1 / 3, false);
  if ([c11, c12, c2, c3].some((v) => v === null || Number.isNaN(v))) return null;
  const c = [asc, c2, c3, norm360(mc + 180), norm360(c11 + 180), norm360(c12 + 180), norm360(asc + 180), norm360(c2 + 180), norm360(c3 + 180), mc, c11, c12];
  return c.map(norm360);
}

export function cuspidesSignosInteiros(asc) {
  const base = Math.floor(norm360(asc) / 30) * 30;
  return Array.from({ length: 12 }, (_, i) => norm360(base + i * 30));
}

export function cuspidesIguais(asc) {
  return Array.from({ length: 12 }, (_, i) => norm360(asc + i * 30));
}

/**
 * Calcula as casas pelo sistema pedido, com fallback automatico.
 * @returns {{sistema:string, solicitado:string, cuspides:number[], avisos:Array<{codigo:string, mensagem:string}>}}
 */
export function calcularCasas(angulos, lat, solicitado = 'placidus') {
  const avisos = [];
  let sistema = solicitado;
  let cuspides = null;
  if (solicitado === 'placidus') {
    if (Math.abs(lat) > LATITUDE_LIMITE_PLACIDUS) {
      avisos.push({
        codigo: 'latitude_alta',
        mensagem: `Acima de ${LATITUDE_LIMITE_PLACIDUS} graus de latitude o sistema Placidus não existe. As casas foram calculadas por Signos Inteiros.`,
      });
      sistema = 'signos-inteiros';
    } else {
      cuspides = cuspidesPlacidus(angulos, lat);
      if (!cuspides) {
        avisos.push({
          codigo: 'placidus_indisponivel',
          mensagem: 'O sistema Placidus não pôde ser calculado para este lugar e instante. As casas foram calculadas por Signos Inteiros.',
        });
        sistema = 'signos-inteiros';
      }
    }
  }
  if (sistema === 'signos-inteiros') cuspides = cuspidesSignosInteiros(angulos.asc);
  else if (sistema === 'igual') cuspides = cuspidesIguais(angulos.asc);
  return { sistema, solicitado, cuspides, avisos };
}

/** Casa (1 a 12) que contem a longitude, dadas as cuspides em ordem. */
export function casaDaLongitude(cuspides, lon) {
  const l = norm360(lon);
  for (let i = 0; i < 12; i++) {
    const ini = cuspides[i];
    const fim = cuspides[(i + 1) % 12];
    const arco = norm360(fim - ini);
    if (norm360(l - ini) < (arco === 0 ? 360 : arco)) return i + 1;
  }
  return 1;
}
