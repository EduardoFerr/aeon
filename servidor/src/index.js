import { lerConfig } from './config.js';
import { criarApp } from './app.js';
import { criarEmail } from './email.js';

const log = (obj) => console.log(JSON.stringify({ t: new Date().toISOString(), ...obj }));

let config;
try {
    config = lerConfig();
} catch (e) {
    console.error(e.message);
    process.exit(1);
}

const email = criarEmail(config, log);
const app = criarApp({ config, email, log });
const porta = await app.escutar(config.porta, config.host);
log({ evento: 'servidor_no_ar', porta, origens: config.origens });

app.limpar();
const faxina = setInterval(() => app.limpar(), 60 * 60 * 1000);
faxina.unref();

async function desligar() {
    log({ evento: 'desligando' });
    clearInterval(faxina);
    await app.fechar();
    process.exit(0);
}
process.on('SIGTERM', desligar);
process.on('SIGINT', desligar);
