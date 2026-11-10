import { ANO_MINIMO, ANO_MAXIMO } from './constantes.js';

/**
 * Conversao de hora local (relogio da parede) para instante UTC, pelo banco IANA via Intl.
 * Hora ambigua (relogio atrasou) ou inexistente (relogio adiantou) NUNCA e resolvida em
 * silencio: devolve as duas possibilidades e o estado.
 */

const cache = new Map();
function formatador(tz) {
  let f = cache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', calendar: 'gregory', numberingSystem: 'latn',
      era: 'short', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    cache.set(tz, f);
  }
  return f;
}

export function fusoValido(tz) {
  try {
    formatador(tz);
    return true;
  } catch {
    return false;
  }
}

/** Deslocamento (segundos, leste positivo) do fuso no instante UTC dado (ms). */
export function deslocamentoSegundos(utcMs, tz) {
  const partes = {};
  for (const p of formatador(tz).formatToParts(new Date(utcMs))) partes[p.type] = p.value;
  let ano = Number(partes.year);
  if (partes.era === 'B') ano = 1 - ano; // a.C.
  const d = new Date(0);
  d.setUTCFullYear(ano, Number(partes.month) - 1, Number(partes.day));
  d.setUTCHours(Number(partes.hour), Number(partes.minute), Number(partes.second), 0);
  return Math.round((d.getTime() - Math.floor(utcMs / 1000) * 1000) / 1000);
}

export function textoDeslocamento(seg) {
  const s = seg < 0 ? '-' : '+';
  const a = Math.abs(seg);
  const h = String(Math.floor(a / 3600)).padStart(2, '0');
  const m = String(Math.floor((a % 3600) / 60)).padStart(2, '0');
  const r = a % 60;
  return `UTC${s}${h}:${m}${r ? ':' + String(r).padStart(2, '0') : ''}`;
}

/** Valida e decompoe "YYYY-MM-DD". */
export function parseData(data) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(data));
  if (!m) throw erro('data_invalida', 'Data inválida: use o formato AAAA-MM-DD.');
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(0);
  t.setUTCFullYear(a, me - 1, d);
  if (t.getUTCFullYear() !== a || t.getUTCMonth() !== me - 1 || t.getUTCDate() !== d) {
    throw erro('data_invalida', 'Essa data não existe no calendário.');
  }
  if (a < ANO_MINIMO || a > ANO_MAXIMO) {
    throw erro('data_fora_do_intervalo', `Data fora do intervalo calculado (${ANO_MINIMO} a ${ANO_MAXIMO}).`);
  }
  return { ano: a, mes: me, dia: d };
}

/** Valida e decompoe "HH:MM" ou "HH:MM:SS". */
export function parseHora(hora) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(hora));
  const h = m ? Number(m[1]) : NaN;
  const mi = m ? Number(m[2]) : NaN;
  const s = m && m[3] ? Number(m[3]) : 0;
  if (!m || h > 23 || mi > 59 || s > 59) throw erro('hora_invalida', 'Hora inválida: use HH:MM, de 00:00 a 23:59.');
  return { h, mi, s };
}

export function erro(codigo, mensagem) {
  const e = new Error(mensagem);
  e.codigo = codigo;
  return e;
}

/** ms "de parede" (a hora local lida como se fosse UTC). */
export function paredeMs({ ano, mes, dia }, { h, mi, s } = { h: 0, mi: 0, s: 0 }) {
  const d = new Date(0);
  d.setUTCFullYear(ano, mes - 1, dia);
  d.setUTCHours(h, mi, s, 0);
  return d.getTime();
}

const DIA = 86400000;

/**
 * Converte a hora de parede em instantes UTC possiveis.
 * @returns {{estado:'normal'|'ambigua'|'inexistente', opcoes:Array<{utcMs:number, utc:string, deslocamentoSeg:number, deslocamento:string}>}}
 *  opcoes ordenadas por instante UTC. 'normal' tem 1; 'ambigua' tem 2 (ambas reais);
 *  'inexistente' tem 2 (a hora nao ocorreu: lida com o deslocamento de antes e o de depois da virada).
 */
export function resolverHoraLocal(parede, tz) {
  if (!fusoValido(tz)) throw erro('fuso_invalido', `Fuso horário desconhecido: ${tz}`);
  const candidatos = new Set([
    deslocamentoSegundos(parede - 36 * 3600e3 * 1, tz),
    deslocamentoSegundos(parede + 36 * 3600e3 * 1, tz),
    deslocamentoSegundos(parede - DIA / 2, tz),
    deslocamentoSegundos(parede + DIA / 2, tz),
  ]);
  const validos = [];
  for (const off of candidatos) {
    const utcMs = parede - off * 1000;
    if (deslocamentoSegundos(utcMs, tz) === off) validos.push(off);
  }
  const monta = (off) => {
    const utcMs = parede - off * 1000;
    return { utcMs, utc: new Date(utcMs).toISOString(), deslocamentoSeg: off, deslocamento: textoDeslocamento(off) };
  };
  if (validos.length === 1) return { estado: 'normal', opcoes: [monta(validos[0])] };
  if (validos.length >= 2) {
    const opcoes = validos.map(monta).sort((a, b) => a.utcMs - b.utcMs);
    return { estado: 'ambigua', opcoes: [opcoes[0], opcoes[opcoes.length - 1]] };
  }
  // Lacuna: usa o deslocamento de antes e o de depois da virada.
  const antes = deslocamentoSegundos(parede - 36 * 3600e3, tz);
  const depois = deslocamentoSegundos(parede + 36 * 3600e3, tz);
  const opcoes = [monta(antes), monta(depois)].sort((a, b) => a.utcMs - b.utcMs);
  return { estado: 'inexistente', opcoes };
}
