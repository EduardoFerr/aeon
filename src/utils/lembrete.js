/**
 * Lembrete opcional: um evento .ics para amanha, gerado no navegador. Nao ha push, notificacao
 * nem permissao, e nada e enviado a servidor: o arquivo e entregue pelo proprio aparelho.
 * Sem alarme embutido: quem decide se o calendario avisa e a pessoa.
 */
const ESCAPAR = (t) => t.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const dois = (n) => String(n).padStart(2, '0');
const stampLocal = (d, h, m) => `${d.getFullYear()}${dois(d.getMonth() + 1)}${dois(d.getDate())}T${dois(h)}${dois(m)}00`;
const stampUtc = (d) => `${d.getUTCFullYear()}${dois(d.getUTCMonth() + 1)}${dois(d.getUTCDate())}T${dois(d.getUTCHours())}${dois(d.getUTCMinutes())}${dois(d.getUTCSeconds())}Z`;

/** RFC 5545: linhas com no maximo 75 octetos; a continuacao comeca com um espaco. */
function dobrar(linha) {
    const enc = new TextEncoder();
    if (enc.encode(linha).length <= 75) return linha;
    const partes = [];
    let atual = '';
    for (const ch of linha) {
        const limite = partes.length ? 74 : 75;
        if (enc.encode(atual + ch).length > limite) { partes.push(atual); atual = ''; }
        atual += ch;
    }
    partes.push(atual);
    return partes.join('\r\n ');
}

/** Texto do arquivo .ics (linhas separadas por CRLF, como pede o formato). */
export function montarIcs(agora = new Date()) {
    const amanha = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
    const id = (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `${agora.getTime()}-${Math.random().toString(36).slice(2)}`);
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Aeon Fool//Carta do dia//PT',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:${id}@aeonfool.com`,
        `DTSTAMP:${stampUtc(agora)}`,
        `DTSTART:${stampLocal(amanha, 8, 0)}`,
        `DTEND:${stampLocal(amanha, 8, 15)}`,
        `SUMMARY:${ESCAPAR('Sua carta de hoje no Aeon Fool')}`,
        `DESCRIPTION:${ESCAPAR('Uma carta nova espera por você. Toque para virar em aeonfool.com')}`,
        'URL:https://aeonfool.com',
        'TRANSP:TRANSPARENT',
        'END:VEVENT',
        'END:VCALENDAR',
        '',
    ].map(dobrar).join('\r\n');
}

/** Baixa o arquivo. Devolve false se o navegador nao conseguiu entregar. */
export function baixarLembrete() {
    try {
        const blob = new Blob([montarIcs()], { type: 'text/calendar;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'aeon-carta-do-dia.ics';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
        return true;
    } catch (e) {
        return false;
    }
}
