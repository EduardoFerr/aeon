import { criarApp } from '../src/app.js';
import { abrirBanco } from '../src/db.js';
import { lerConfig } from '../src/config.js';

export const ORIGEM = 'https://aeonfool.com';

/** Servidor de verdade numa porta livre, banco em memória, e-mail falso e relógio que o teste controla. */
export async function subir(extra = {}) {
    const config = lerConfig({
        NODE_ENV: 'production',
        SEGREDO: 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres',
        EMAIL_MODO: 'smtp',
        SMTP_HOST: 'x', SMTP_USUARIO: 'x', SMTP_SENHA: 'x',
        EMAIL_DE: 'atendimento@aeonfool.com',
        ...extra.env,
    });
    let agora = Date.parse('2026-11-12T12:00:00Z');
    const relogio = () => agora;
    const enviados = [];
    const logs = [];
    const email = { async enviar(m) { if (extra.falhaEmail) throw extra.falhaEmail; enviados.push(m); } };
    const app = criarApp({ config, db: abrirBanco(':memory:'), email, relogio, log: (o) => logs.push(o) });
    const porta = await app.escutar(0, '127.0.0.1');
    const base = `http://127.0.0.1:${porta}`;

    async function chamar(metodo, caminho, { corpo, cookie, origem = ORIGEM, cabecalhos = {}, semOrigem = false } = {}) {
        const h = { ...cabecalhos };
        if (!semOrigem && origem) h.Origin = origem;
        if (cookie) h.Cookie = cookie;
        let body;
        if (corpo !== undefined) {
            h['Content-Type'] = 'application/json';
            body = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
        }
        const r = await fetch(base + caminho, { method: metodo, headers: h, body, redirect: 'manual' });
        const texto = await r.text();
        let json = null;
        try { json = texto ? JSON.parse(texto) : null; } catch { /* não é JSON */ }
        return { status: r.status, json, cabecalhos: r.headers, setCookie: r.headers.get('set-cookie') || '' };
    }

    /** Faz o login completo e devolve o valor do cookie (nome=valor). */
    async function entrar(emailUsuario = 'ana@exemplo.com', aparelho = 'Teste') {
        await chamar('POST', '/v1/auth/pedir', { corpo: { email: emailUsuario } });
        await app.ocioso();
        const msg = enviados[enviados.length - 1];
        const codigo = /é (\d{6})\./.exec(msg.texto)[1];
        const r = await chamar('POST', '/v1/auth/confirmar', { corpo: { email: emailUsuario, codigo, aparelho } });
        if (r.status !== 200) throw new Error(`login falhou: ${r.status} ${JSON.stringify(r.json)}`);
        return r.setCookie.split(';')[0];
    }

    return {
        app, config, chamar, entrar, enviados, logs, base,
        avancar: (ms) => { agora += ms; },
        agora: () => agora,
        fechar: () => app.fechar(),
    };
}

export const item = (tipo, id, dados, atualizado_em, apagado = false) => ({ tipo, id, dados, atualizado_em, ...(apagado ? { apagado: true } : {}) });
