import nodemailer from 'nodemailer';

/**
 * Envio de e-mail. Só texto simples, sem link: o acesso é por código digitado no app.
 * A interface é { enviar({ para, assunto, texto }) -> Promise }, o que deixa os testes usarem um envio falso.
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
        auth: { user: config.smtp.usuario, pass: config.smtp.senha },
        connectionTimeout: 10_000,
        socketTimeout: 20_000,
    });
    return {
        async enviar({ para, assunto, texto }) {
            await transporte.sendMail({ from: `Aeon <${config.de}>`, to: para, subject: assunto, text: texto });
        },
    };
}

export const mensagemCodigo = (codigo) => ({
    assunto: `Seu código do Aeon: ${codigo}`,
    texto: [
        `Seu código de acesso ao Aeon é ${codigo}.`,
        '',
        'Digite-o no app em até 10 minutos. Ele vale uma vez só.',
        '',
        'Se você não pediu este código, pode ignorar este e-mail. Nada acontece com a sua conta.',
    ].join('\n'),
});

export const mensagemContaApagada = () => ({
    assunto: 'Seus dados foram apagados do Aeon',
    texto: [
        'Seus dados e a sua conta foram apagados do servidor do Aeon, como você pediu.',
        '',
        'O que está guardado neste aparelho continua nele. Se quiser sincronizar de novo, é só ligar a sincronização no app.',
        '',
        'Se você não pediu isso, responda este e-mail avisando.',
    ].join('\n'),
});
