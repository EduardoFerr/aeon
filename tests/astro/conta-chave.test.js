import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__SYNC_ATIVA__ = true;
const mem = new Map();
globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
};

let servidorMod;
try {
    servidorMod = {
        ...(await import('../../servidor/src/app.js')),
        ...(await import('../../servidor/src/db.js')),
        ...(await import('../../servidor/src/config.js')),
    };
} catch (e) {
    servidorMod = null;
}
const pular = servidorMod ? false : 'servidor/node_modules ausente (rode npm ci em servidor/)';

const D = await import('../../src/utils/diario.js');
const P = await import('../../src/utils/perfil.js');
const C = await import('../../src/utils/conta.js');
const E = await import('../../src/utils/contaEstado.js');
const K = await import('../../src/utils/contas.js');

const ORIGEM = 'https://aeonfool.com';
const SEG = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres';
const cartas = [{ order: 1, pos: 'passado' }, { order: 2, pos: 'presente' }, { order: 3, pos: 'futuro' }];
const mapa = (rotulo, data = '1990-05-01') => ({ rotulo, data, hora: '08:30', local: { nome: 'São Paulo', lat: -23.55, lon: -46.63, tz: 'America/Sao_Paulo' }, principal: true });
const RE_CHAVE = /^[a-z]+( [a-z]+){11}$/;

async function subir() {
    const config = servidorMod.lerConfig({ NODE_ENV: 'production', SEGREDO: SEG, EMAIL_MODO: 'smtp', SMTP_HOST: 'x', SMTP_USUARIO: 'x', SMTP_SENHA: 'x', EMAIL_DE: 'nao-responda@aeonfool.com' });
    let agora = Date.parse('2026-11-12T12:00:00Z');
    const enviados = [];
    const app = servidorMod.criarApp({ config, db: servidorMod.abrirBanco(':memory:'), relogio: () => agora, email: { async enviar(m) { enviados.push(m); } }, log: () => {} });
    const porta = await app.escutar(0, '127.0.0.1');
    const jar = new Map();
    const fetchComJar = (nome) => async (url, opcoes = {}) => {
        const h = { ...(opcoes.headers || {}), Origin: ORIGEM };
        const c = jar.get(nome);
        if (c) h.Cookie = c;
        const r = await fetch(url, { ...opcoes, headers: h });
        const sc = r.headers.get('set-cookie');
        if (sc) jar.set(nome, /Max-Age=0/.test(sc) ? '' : sc.split(';')[0]);
        return r;
    };
    return { app, enviados, base: `http://127.0.0.1:${porta}`, fetchComJar, jar, avancar: (ms) => { agora += ms; } };
}

/** "Aparelho": localStorage vazio e um cookie jar proprio. */
function aparelho(s, nome) {
    mem.clear();
    C.configurar({ api: s.base, fetch: s.fetchComJar(nome), esperaExclusaoMs: 0 });
}
/** Espera as rodadas de sincronizacao terminarem (pedidos que chegam durante uma viram uma segunda rodada). */
async function quieto() {
    const pausa = () => new Promise((r) => setTimeout(r, 25));
    for (let i = 0; i < 80; i++) {
        await pausa();
        if (!C.estadoConta().sincronizando) {
            await pausa();
            if (!C.estadoConta().sincronizando) return;
        }
    }
}
const contaNoServidor = (s) => s.app.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
const itensDe = (s, id) => s.app.db.prepare('SELECT tipo, id FROM itens WHERE usuario_id = ? AND apagado = 0 ORDER BY tipo, id').all(id).map((r) => `${r.tipo}/${r.id}`);

test('nada acontece no servidor até a pessoa pedir a chave; ao pedir, a conta nasce e os dados sobem', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    aparelho(s, 'a');
    const leitura = D.criarLeitura(cartas, 'e agora?');
    P.adicionar(mapa('Meu mapa'));
    assert.equal(contaNoServidor(s), 0);
    assert.equal(C.estadoConta().servidorId, 0);

    const r = await C.gerarChave();
    assert.equal(r.nova, true);
    assert.match(r.chave, RE_CHAVE);
    await C.sincronizar();
    const est = C.estadoConta();
    assert.equal(est.fase, 'ligada');
    assert.equal(est.anonima, true);
    assert.equal(est.temChave, true);
    assert.equal(C.verChave(), r.chave);
    assert.equal(contaNoServidor(s), 1);
    assert.deepEqual(itensDe(s, est.servidorId).filter((x) => x.startsWith('diario/')), [`diario/${leitura.id}`]);
    assert.equal(itensDe(s, est.servidorId).some((x) => x.startsWith('mapa/')), true);

    const de_novo = await C.gerarChave(); // nao cria outra
    assert.deepEqual(de_novo, { chave: r.chave, nova: false });
    assert.equal(contaNoServidor(s), 1);
});

test('outro aparelho entra com a chave, junta e recebe tudo; chave errada não entra', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    aparelho(s, 'a');
    const leitura = D.criarLeitura(cartas, 'da casa');
    const { chave } = await C.gerarChave();
    await C.sincronizar();

    aparelho(s, 'b'); // aparelho novo, vazio
    await assert.rejects(() => C.entrarComChave('abacate abaixo abalar abater abduzir abelha abraco abrir acalmar aceitar acender acesso'), (e) => C.motivoDoErro(e) === 'chave_invalida');
    await C.entrarComChave(chave.toUpperCase());
    assert.equal(C.estadoConta().fase, 'juntar');
    await C.ligar();
    assert.deepEqual(D.listar().map((e) => e.id), [leitura.id]);
    assert.equal(contaNoServidor(s), 1);
    assert.equal(C.estadoConta().fase, 'ligada');
});

test('aparelho com dados próprios que entra com a chave: os dois lados são juntados, nada se perde', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    aparelho(s, 'a');
    const daCasa = D.criarLeitura(cartas, 'da casa');
    const { chave } = await C.gerarChave();
    await C.sincronizar();

    aparelho(s, 'b');
    const doCelular = D.criarLeitura(cartas, 'do celular');
    await C.entrarComChave(chave);
    await C.ligar();
    assert.deepEqual(D.listar().map((e) => e.id).sort(), [daCasa.id, doCelular.id].sort());
    const id = C.estadoConta().servidorId;
    assert.equal(itensDe(s, id).length, 2);
});

test('destino "nova": a conta do servidor ganha uma conta local própria e a atual não é tocada', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    aparelho(s, 'a');
    D.criarLeitura(cartas, 'da casa');
    const { chave } = await C.gerarChave();
    await C.sincronizar();

    aparelho(s, 'b');
    const meuLocal = D.criarLeitura(cartas, 'so do celular');
    const r = await C.entrarComChave(chave, { destino: 'nova' });
    assert.ok(r.contaLocal);
    assert.equal(K.listarContas().length, 2);
    assert.equal(C.estadoConta().servidorId, 0); // a conta ativa continua sem conta no servidor
    assert.deepEqual(D.listar().map((e) => e.id), [meuLocal.id]);
    K.trocarConta(r.contaLocal, () => {});
    assert.equal(C.estadoConta().fase, 'ligada');
    await C.sincronizar();
    assert.deepEqual(D.listar().map((e) => e.pergunta), ['da casa']);
    K.trocarConta('c1', () => {});
    assert.deepEqual(D.listar().map((e) => e.pergunta), ['so do celular']);
});

test('duas contas no mesmo aparelho: cada uma sincroniza só os seus dados, pelo cabeçalho de conta', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    aparelho(s, 'a');
    const a = D.criarLeitura(cartas, 'primeira');
    await C.gerarChave();
    await C.sincronizar();
    const idA = C.estadoConta().servidorId;

    s.avancar(31 * 60 * 1000); // o servidor so cria uma conta anonima por IP a cada 30 minutos
    const c2 = K.criarContaLocal('Segunda');
    K.trocarConta(c2, () => {});
    const b = D.criarLeitura(cartas, 'segunda');
    await C.gerarChave();
    await C.sincronizar();
    const idB = C.estadoConta().servidorId;

    assert.notEqual(idA, idB);
    assert.equal(contaNoServidor(s), 2);
    assert.deepEqual(itensDe(s, idA), [`diario/${a.id}`]);
    assert.deepEqual(itensDe(s, idB), [`diario/${b.id}`]);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM sessoes').get().n, 1); // um cookie so
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM sessao_contas').get().n, 2);
});

test('gerar a chave duas vezes seguidas em outra conta bate no freio e não deixa estado pela metade', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    aparelho(s, 'a');
    D.criarLeitura(cartas, 'um');
    await C.gerarChave();
    const c2 = K.criarContaLocal();
    K.trocarConta(c2, () => {});
    D.criarLeitura(cartas, 'dois');
    await assert.rejects(() => C.gerarChave(), (e) => C.motivoDoErro(e) === 'limite');
    assert.equal(C.estadoConta().servidorId, 0);
    assert.equal(C.estadoConta().fase, 'desligada');
    assert.equal(contaNoServidor(s), 1);
});

test('cookie perdido: quem tem a chave guardada volta sozinho e a sincronização segue', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    aparelho(s, 'a');
    D.criarLeitura(cartas, 'um');
    await C.gerarChave();
    await C.sincronizar();
    await quieto();
    const id = C.estadoConta().servidorId;
    s.jar.set('a', ''); // o navegador limpou o cookie
    const nova = D.criarLeitura([{ order: 9, pos: 'passado' }, { order: 10, pos: 'presente' }, { order: 11, pos: 'futuro' }], 'depois do cookie'); // cartas diferentes: a mesma leitura repetida nao cria entrada nova
    const r = await C.sincronizar();
    await quieto();
    assert.equal(r.ok, true);
    assert.equal(C.estadoConta().servidorId, id);
    assert.equal(contaNoServidor(s), 1); // voltou para a mesma conta, nao criou outra
    assert.ok(itensDe(s, id).includes(`diario/${nova.id}`));
});

test('sair tira só esta conta do aparelho no servidor; a anônima sem outro aparelho é apagada', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    aparelho(s, 'a');
    D.criarLeitura(cartas, 'um');
    await C.gerarChave();
    await C.sincronizar();
    await C.sair();
    assert.equal(contaNoServidor(s), 0);
    assert.equal(C.estadoConta().servidorId, 0);
    assert.equal(C.estadoConta().fase, 'desligada');
    assert.equal(D.listar().length, 1); // os dados locais ficam
});

test('login por e-mail guarda o id da conta e conta antiga sem id descobre o dela na primeira sincronização', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    aparelho(s, 'a');
    D.criarLeitura(cartas, 'um');
    await C.pedirCodigo('ana@exemplo.com');
    await s.app.ocioso();
    const codigo = /é (\d{6})\./.exec(s.enviados[s.enviados.length - 1].texto)[1];
    const u = await C.confirmarCodigo('ana@exemplo.com', codigo);
    assert.ok(u.id > 0);
    assert.equal(C.estadoConta().servidorId, u.id);
    await C.ligar();
    E.salvarEstado({ servidorId: 0 }); // estado de antes de existirem varias contas
    await C.sincronizar();
    assert.equal(C.estadoConta().servidorId, u.id);
});

test('quem tem conta com e-mail e nunca teve chave pode gerar uma, e ela entra em outro aparelho', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    aparelho(s, 'a');
    const leitura = D.criarLeitura(cartas, 'um');
    await C.pedirCodigo('ana@exemplo.com');
    await s.app.ocioso();
    const codigo = /é (\d{6})\./.exec(s.enviados[s.enviados.length - 1].texto)[1];
    await C.confirmarCodigo('ana@exemplo.com', codigo);
    await C.ligar();
    assert.equal(C.estadoConta().temChave, false);
    const r = await C.gerarChave();
    assert.match(r.chave, RE_CHAVE);
    assert.equal(C.estadoConta().temChave, true);

    aparelho(s, 'b');
    await C.entrarComChave(r.chave);
    await C.ligar();
    assert.deepEqual(D.listar().map((e) => e.id), [leitura.id]);
    assert.equal(C.estadoConta().email, 'ana@exemplo.com');
});

test('"ficar com as duas": a conta do servidor vai para uma conta local nova e a atual segue intacta', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    aparelho(s, 'a');
    D.criarLeitura(cartas, 'da casa');
    const { chave } = await C.gerarChave();
    await C.sincronizar();
    await quieto();

    aparelho(s, 'b');
    const doCelular = D.criarLeitura(cartas, 'do celular');
    assert.deepEqual(C.registrosLocais(), { diario: 1, mapas: 0 });
    await C.entrarComChave(chave);
    assert.equal(C.estadoConta().fase, 'juntar');
    const nova = C.moverLigacaoParaNovaConta();
    assert.equal(C.estadoConta().servidorId, 0); // a conta ativa voltou a ser so deste aparelho
    assert.equal(C.estadoConta().chave, undefined);
    assert.deepEqual(D.listar().map((e) => e.id), [doCelular.id]);
    K.trocarConta(nova, () => {});
    assert.equal(C.estadoConta().fase, 'ligada');
    assert.equal(C.estadoConta().temChave, true);
    await C.sincronizar();
    await quieto();
    assert.deepEqual(D.listar().map((e) => e.pergunta), ['da casa']);
});

test('"descartar": apagar os registros daqui e ligar deixa só o que já estava na conta', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    aparelho(s, 'a');
    D.criarLeitura(cartas, 'da casa');
    const { chave } = await C.gerarChave();
    await C.sincronizar();
    await quieto();

    aparelho(s, 'b');
    D.criarLeitura(cartas, 'do celular');
    await C.entrarComChave(chave);
    C.apagarRegistrosLocais();
    assert.equal(D.listar().length, 0);
    const r = await C.ligar();
    assert.equal(r.ok, true);
    await quieto();
    assert.deepEqual(D.listar().map((e) => e.pergunta), ['da casa']);
    assert.equal(contaNoServidor(s), 1);
    // nada foi anotado como exclusao: a conta continua com a leitura da casa
    assert.equal(itensDe(s, C.estadoConta().servidorId).length, 1);
});

test('adicionar e-mail a uma conta com chave; e-mail que já tem conta é recusado sem mexer em nada', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    aparelho(s, 'a');
    D.criarLeitura(cartas, 'um');
    await C.gerarChave();
    await C.sincronizar();
    await quieto();
    const id = C.estadoConta().servidorId;
    const pedir = async (email) => {
        await C.pedirCodigo(email);
        await s.app.ocioso();
        return /é (\d{6})\./.exec(s.enviados[s.enviados.length - 1].texto)[1];
    };
    await C.confirmarCodigo('ana@exemplo.com', await pedir('ana@exemplo.com'), { destino: 'vincular' });
    assert.equal(C.estadoConta().email, 'ana@exemplo.com');
    assert.equal(C.estadoConta().servidorId, id);
    assert.equal(s.app.db.prepare('SELECT email FROM usuarios WHERE id = ?').get(id).email, 'ana@exemplo.com');

    // outra conta anonima (outro "dono") tenta usar o mesmo e-mail
    s.avancar(31 * 60 * 1000);
    const c2 = K.criarContaLocal();
    K.trocarConta(c2, () => {});
    D.criarLeitura(cartas, 'dois');
    await C.gerarChave();
    const idB = C.estadoConta().servidorId;
    await assert.rejects(
        async () => C.confirmarCodigo('ana@exemplo.com', await pedir('ana@exemplo.com'), { destino: 'vincular' }),
        (e) => C.motivoDoErro(e) === 'email_ocupado',
    );
    assert.equal(C.estadoConta().email, '');
    assert.equal(C.estadoConta().servidorId, idB);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 2);
    // a conta da ana nao ficou ligada a esta sessao por engano: continuam so as duas contas deste aparelho
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM sessao_contas').get().n, 2);
});
