import nodemailer from 'nodemailer';

/**
 * Envio de e-mail. Cada mensagem vai em duas versões (texto simples e HTML), sem link: o acesso é por código
 * digitado no app. A interface é { enviar({ para, assunto, texto, html }) -> Promise }, o que deixa os testes
 * usarem um envio falso.
 */
export function criarEmail(config, log) {
    if (config.emailModo === 'console') {
        return {
            async enviar({ para, assunto, texto }) {
                log({ evento: 'email_console', para, assunto, texto });
            },
        };
    }
    const transporte = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.porta,
        secure: config.smtp.porta === 465,
        requireTLS: config.smtp.porta !== 465, // porta 587: sem STARTTLS não envia (evita downgrade)
        auth: { user: config.smtp.usuario, pass: config.smtp.senha },
        connectionTimeout: 10_000,
        socketTimeout: 20_000,
    });
    return {
        async enviar({ para, assunto, texto, html }) {
            await transporte.sendMail({ from: `Aeon <${config.de}>`, to: para, subject: assunto, text: texto, html });
        },
    };
}

/* ---------- visual (as cores do tema Crepúsculo do app) ---------- */

const COR = {
    fundo: '#14101c',
    cartao: '#1e1828',
    cartao2: '#2a2236',
    texto: '#f1e9e0',
    suave: '#b8abb8',
    mudo: '#9c93aa',
    destaque: '#e8b7a0',
    linha: '#3a3247',
};
/** As imagens ficam no proprio site (public/email/), em endereco fixo e igual para todo mundo. */
const IMG = 'https://aeonfool.com/email';
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Moldura comum: marca, título, corpo e rodapé. Tabelas e estilos inline, que é o que os leitores de e-mail aceitam. */
function moldura({ previa, titulo, corpo, rodape }) {
    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${COR.fundo};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COR.fundo};font-size:1px;line-height:1px;">${esc(previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.fundo}" style="background:${COR.fundo};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
    <tr><td align="center" style="padding:0 0 16px 0;font-family:${SERIF};font-size:28px;letter-spacing:12px;color:${COR.texto};"><img src="${IMG}/aeon-topo.png" width="480" height="150" alt="AEON" style="display:block;margin:0 auto;border:0;outline:none;width:100%;max-width:480px;height:auto;font-family:${SERIF};font-size:28px;letter-spacing:12px;color:${COR.texto};"></td></tr>
    <tr><td bgcolor="${COR.cartao}" style="background:${COR.cartao};border:1px solid ${COR.linha};border-radius:16px;padding:32px 28px;font-family:${SANS};color:${COR.suave};font-size:16px;line-height:1.6;">
      <div style="text-align:center;padding:0 0 20px 0;"><img src="${IMG}/aeon-carta.png" width="80" height="120" alt="" style="display:inline-block;border:0;width:80px;height:120px;"></div>
      <h1 style="margin:0 0 16px 0;text-align:center;font-family:${SERIF};font-weight:500;font-size:26px;line-height:1.2;color:${COR.texto};">${esc(titulo)}</h1>
      ${corpo}
    </td></tr>
    <tr><td align="center" style="padding:20px 8px 0 8px;font-family:${SANS};font-size:13px;line-height:1.5;color:${COR.mudo};">${rodape}</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

const paragrafo = (t) => `<p style="margin:0 0 16px 0;font-family:${SANS};font-size:16px;line-height:1.6;color:${COR.suave};">${t}</p>`;
const RODAPE = 'Aeon Fool, tarô e mapa astral.<br>Você recebeu este e-mail porque alguém pediu acesso à conta do Aeon com este endereço.';

export const mensagemCodigo = (codigo) => {
    const c = esc(codigo);
    const corpo = `${paragrafo('Use este código para entrar no Aeon. Digite-o no app em até 10 minutos. Ele vale uma vez só.')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">
        <tr><td align="center" bgcolor="${COR.cartao2}" style="background:${COR.cartao2};border:1px solid ${COR.linha};border-radius:12px;padding:20px 12px;">
          <span style="font-family:${MONO};font-size:36px;font-weight:700;letter-spacing:10px;color:${COR.destaque};white-space:nowrap;">${c}</span>
        </td></tr>
      </table>
      ${paragrafo('Se você não pediu este código, pode ignorar este e-mail. Nada acontece com a sua conta.')}`;
    return {
        assunto: `Seu código do Aeon: ${codigo}`,
        texto: [
            `Seu código de acesso ao Aeon é ${codigo}.`,
            '',
            'Digite-o no app em até 10 minutos. Ele vale uma vez só.',
            '',
            'Se você não pediu este código, pode ignorar este e-mail. Nada acontece com a sua conta.',
        ].join('\n'),
        html: moldura({ previa: `Seu código é ${codigo}. Vale por 10 minutos.`, titulo: 'Seu código de acesso', corpo, rodape: RODAPE }),
    };
};

export const mensagemContaApagada = () => {
    const corpo = `${paragrafo('Seus dados e a sua conta foram apagados do servidor do Aeon, como você pediu.')}
      ${paragrafo('O que está guardado neste aparelho continua nele. Se quiser sincronizar de novo, é só ligar a sincronização no app.')}
      ${paragrafo('Se você não pediu isso, responda este e-mail avisando.')}`;
    return {
        assunto: 'Seus dados foram apagados do Aeon',
        texto: [
            'Seus dados e a sua conta foram apagados do servidor do Aeon, como você pediu.',
            '',
            'O que está guardado neste aparelho continua nele. Se quiser sincronizar de novo, é só ligar a sincronização no app.',
            '',
            'Se você não pediu isso, responda este e-mail avisando.',
        ].join('\n'),
        html: moldura({ previa: 'Seus dados foram apagados da sua conta do Aeon.', titulo: 'Seus dados foram apagados', corpo, rodape: RODAPE }),
    };
};
