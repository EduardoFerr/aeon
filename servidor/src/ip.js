/**
 * Chave de limite por IP. IPv6 conta por /64 (um único cliente costuma ter um /64 inteiro e poderia girar
 * endereços à vontade); IPv4 mapeado em IPv6 vira o IPv4.
 */
export function chaveIp(ip) {
    let s = String(ip || 'desconhecido').toLowerCase();
    const mapeado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (mapeado) return mapeado[1];
    if (!s.includes(':')) return s;
    s = s.split('%')[0];
    const [cabeca, cauda] = s.split('::');
    const a = cabeca ? cabeca.split(':') : [];
    const b = cauda ? cauda.split(':') : [];
    const falta = 8 - a.length - b.length;
    const todos = cauda === undefined ? a : [...a, ...Array(Math.max(0, falta)).fill('0'), ...b];
    return todos.slice(0, 4).map((h) => (h || '0').replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

/** O limite por e-mail ignora o "+etiqueta" (v+1@x.com e v+2@x.com são a mesma caixa para quem recebe). */
export const baseDoEmail = (e) => e.replace(/\+[^@]*@/, '@');
