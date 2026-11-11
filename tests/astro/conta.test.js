import test from 'node:test';
import assert from 'node:assert/strict';

// A chave do build e o armazenamento do navegador, antes de importar os modulos (eles leem na carga).
globalThis.__SYNC_ATIVA__ = true;
const mem = new Map();
globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
};

// O servidor real (pasta servidor/), em memoria. Sem as dependencias dele instaladas, estes testes pulam.
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

const ORIGEM = 'https://aeonfool.com';
const SEG = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres';

async function subir() {
    const config = servidorMod.lerConfig({ NODE_ENV: 'production', SEGREDO: SEG, EMAIL_MODO: 'smtp', SMTP_HOST: 'x', SMTP_USUARIO: 'x', SMTP_SENHA: 'x', EMAIL_DE: 'nao-responda@aeonfool.com' });
    const enviados = [];
    const app = servidorMod.criarApp({ config, db: servidorMod.abrirBanco(':memory:'), email: { async enviar(m) { enviados.push(m); } }, log: () => {} });
    const porta = await app.escutar(0, '127.0.0.1');
    const base = `http://127.0.0.1:${porta}`;
    // fetch com "cookie jar" e Origin, como o navegador faria
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
    return { app, enviados, base, fetchComJar, jar };
}

function limparTudo() {
    mem.clear();
}

async function entrarComo(s, email) {
    await C.pedirCodigo(email);
    await s.app.ocioso();
    const codigo = /é (\d{6})\./.exec(s.enviados[s.enviados.length - 1].texto)[1];
    return C.confirmarCodigo(email, codigo);
}

/** O "outro aparelho": fala direto com a API, com a mesma conta. */
async function outroAparelho(s, email) {
    const f = s.fetchComJar('b');
    await f(`${s.base}/v1/auth/pedir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    await s.app.ocioso();
    const codigo = /é (\d{6})\./.exec(s.enviados[s.enviados.length - 1].texto)[1];
    await f(`${s.base}/v1/auth/confirmar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, codigo, aparelho: 'B' }) });
    const post = async (itens, desde = 0) => (await f(`${s.base}/v1/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ desde, itens }) })).json();
    const ler = async (desde = 0) => (await f(`${s.base}/v1/sync?desde=${desde}`)).json();
    return { post, ler };
}

const cartasLeitura = [{ order: 1, pos: 'passado' }, { order: 2, pos: 'presente' }, { order: 3, pos: 'futuro' }];
const entradaDe = (id, nota = '', t = '2026-11-10T10:00:00.000Z') => ({ id, t, tipo: 'leitura', cartas: cartasLeitura, nota, m: nota ? '2026-11-10T11:00:00.000Z' : t });
const mapaLocal = (rotulo = 'Meu mapa', principal = true, data = '1990-05-01') => ({ rotulo, data, hora: '08:30', local: { nome: 'São Paulo', lat: -23.55, lon: -46.63, tz: 'America/Sao_Paulo' }, principal });

async function configurarAparelhoA(s) {
    limparTudo();
    C.configurar({ api: s.base, fetch: s.fetchComJar('a') });
}

test('ligar junta os dois lados sem apagar nada, e o outro aparelho recebe', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    await configurarAparelhoA(s);
    const leitura = D.criarLeitura(cartasLeitura, 'e agora?');
    D.salvarNota(leitura.id, 'minha nota');
    P.adicionar(mapaLocal());
    P.definirApelido('Ana');

    // o outro aparelho ja tinha uma entrada na conta
    await entrarComo(s, 'ana@exemplo.com');
    const outro = await outroAparelho(s, 'ana@exemplo.com');
    await outro.post([{ tipo: 'diario', id: 'leitura-b', dados: entradaDe('leitura-b', 'da conta'), atualizado_em: '2026-11-10T11:00:00.000Z' }]);

    const resumo = await C.resumoParaJuntar();
    assert.deepEqual(resumo.aqui, { diario: 1, mapas: 1 });
    assert.deepEqual(resumo.naConta, { diario: 1, mapas: 0 });
    assert.equal(C.estadoConta().fase, 'juntar');

    const r = await C.ligar();
    assert.equal(r.ok, true);
    assert.equal(C.estadoConta().fase, 'ligada');
    // aqui passou a ter as duas leituras e nada se perdeu
    const ids = D.listar().map((e) => e.id).sort();
    assert.deepEqual(ids, [leitura.id, 'leitura-b'].sort());
    assert.equal(D.obter(leitura.id).nota, 'minha nota');
    assert.equal(P.apelido(), 'Ana');
    // e a conta recebeu o que era daqui (inclusive o mapa com nascimento)
    const naConta = await outro.ler(0);
    const tipos = naConta.itens.map((i) => i.tipo).sort();
    assert.deepEqual(tipos, ['diario', 'diario', 'mapa', 'perfil']);
    assert.equal(naConta.itens.find((i) => i.tipo === 'mapa').dados.local.nome, 'São Paulo');
});

test('mudanças de outro aparelho chegam, e a edição mais recente vence nos dois sentidos', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    await configurarAparelhoA(s);
    const leitura = D.criarLeitura(cartasLeitura, '');
    await entrarComo(s, 'ana@exemplo.com');
    await C.ligar();
    const outro = await outroAparelho(s, 'ana@exemplo.com');

    // B edita a nota depois: A recebe
    const noServidor = (await outro.ler(0)).itens.find((i) => i.id === leitura.id);
    const maisNova = { ...noServidor.dados, nota: 'nota do B', m: new Date().toISOString() };
    await outro.post([{ tipo: 'diario', id: leitura.id, dados: maisNova, atualizado_em: maisNova.m }]);
    await C.sincronizar();
    assert.equal(D.obter(leitura.id).nota, 'nota do B');

    // A edita depois ainda: B nao sobrescreve
    await new Promise((r) => setTimeout(r, 15));
    D.salvarNota(leitura.id, 'nota do A, mais nova');
    await C.sincronizar();
    const final = (await outro.ler(0)).itens.find((i) => i.id === leitura.id);
    assert.equal(final.dados.nota, 'nota do A, mais nova');
});

test('apagar aqui vai para a conta depois de 15 s; o Desfazer antes disso cancela', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    await configurarAparelhoA(s);
    const a = D.criarLeitura(cartasLeitura, '');
    const b = D.criarLeitura([{ order: 4, pos: 'passado' }, { order: 5, pos: 'presente' }, { order: 6, pos: 'futuro' }], '');
    await entrarComo(s, 'ana@exemplo.com');
    await C.ligar();
    const outro = await outroAparelho(s, 'ana@exemplo.com');

    const copia = D.instantaneo();
    D.apagarEntrada(a.id);
    D.apagarEntrada(b.id);
    await C.sincronizar();
    let vivos = (await outro.ler(0)).itens.filter((i) => !i.apagado).map((i) => i.id);
    assert.equal(vivos.length, 2, 'dentro dos 15 s nada vai para a conta');

    // Desfazer: as exclusoes pendentes somem e nada chega a ser apagado
    D.restaurar(copia);
    assert.deepEqual(Object.keys(E.lerEstado().apagados), []);
    await C.sincronizar();
    assert.equal((await outro.ler(0)).itens.filter((i) => !i.apagado).length, 2);

    // Apagar de verdade: depois de 15 s a exclusao segue
    D.apagarEntrada(a.id);
    assert.ok(E.lerEstado().apagados[`diario/${a.id}`]);
    C.configurar({ esperaExclusaoMs: 0 }); // "passaram 15 s"
    await C.sincronizar();
    C.configurar({ esperaExclusaoMs: E.ESPERA_EXCLUSAO_MS });
    vivos = (await outro.ler(0)).itens.filter((i) => !i.apagado).map((i) => i.id);
    assert.deepEqual(vivos, [b.id]);
    assert.deepEqual(Object.keys(E.lerEstado().apagados), []);
});

test('exclusão feita no outro aparelho chega aqui; edição local mais nova traz o item de volta', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    await configurarAparelhoA(s);
    const a = D.criarLeitura(cartasLeitura, '');
    P.adicionar(mapaLocal());
    const mapaId = P.principal().id;
    await entrarComo(s, 'ana@exemplo.com');
    await C.ligar();
    const outro = await outroAparelho(s, 'ana@exemplo.com');
    const em = new Date(Date.now() + 5000).toISOString();
    await outro.post([{ tipo: 'diario', id: a.id, apagado: true, atualizado_em: em }, { tipo: 'mapa', id: mapaId, apagado: true, atualizado_em: em }]);
    await C.sincronizar();
    assert.equal(D.obter(a.id), null);
    assert.equal(P.obter(mapaId), null);
});

test('limpar os dados do navegador NÃO apaga nada na conta: ligar de novo traz tudo de volta', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    await configurarAparelhoA(s);
    const guardada = D.criarLeitura(cartasLeitura, 'minha pergunta');
    D.salvarNota(guardada.id, 'guardada');
    P.adicionar(mapaLocal());
    await entrarComo(s, 'ana@exemplo.com');
    await C.ligar();

    // simula "limpar dados do site": some TUDO do aparelho, inclusive o estado da conta. O cookie de sessao tambem some.
    mem.clear();
    s.jar.clear();
    assert.equal(D.listar().length, 0);
    assert.equal(P.listar().length, 0);
    assert.equal(C.estadoConta().fase, 'desligada');
    assert.equal((await outroAparelho(s, 'ana@exemplo.com').then((o) => o.ler(0))).itens.filter((i) => !i.apagado).length >= 2, true, 'a conta continua com tudo');

    await entrarComo(s, 'ana@exemplo.com');
    const r = await C.resumoParaJuntar();
    assert.deepEqual(r.aqui, { diario: 0, mapas: 0 });
    assert.deepEqual(r.naConta, { diario: 1, mapas: 1 });
    await C.ligar();
    assert.equal(D.listar().length, 1);
    assert.equal(D.listar()[0].nota, 'guardada');
    assert.equal(P.listar().length, 1);
});

test('dados locais que somem sem a pessoa apagar (leitura falhou) não viram exclusão na conta', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    await configurarAparelhoA(s);
    D.criarLeitura(cartasLeitura, '');
    await entrarComo(s, 'ana@exemplo.com');
    await C.ligar();
    mem.delete('aeon:v2:diario'); // some o diario, mas o estado da conta fica
    await C.sincronizar();
    const outro = await outroAparelho(s, 'ana@exemplo.com');
    assert.equal((await outro.ler(0)).itens.filter((i) => !i.apagado && i.tipo === 'diario').length, 1);
    assert.equal(D.listar().length, 1, 'a entrada voltou da conta');
});

test('o mesmo mapa criado em dois aparelhos não duplica; só um mapa é o principal (vence o mais novo)', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    await configurarAparelhoA(s);
    P.adicionar(mapaLocal('Meu mapa', true, '1990-05-01'));
    await entrarComo(s, 'ana@exemplo.com');
    await C.ligar();
    const outro = await outroAparelho(s, 'ana@exemplo.com');
    const agora = Date.now();
    const base = (id, rotulo, principal, data, min) => ({ tipo: 'mapa', id, dados: { id, rotulo, data, hora: '08:30', local: { nome: 'São Paulo', lat: -23.55, lon: -46.63, tz: 'America/Sao_Paulo' }, principal, escolha: 0, casas: 'placidus', criado: new Date(agora + min).toISOString(), atualizado: new Date(agora + min).toISOString() }, atualizado_em: new Date(agora + min).toISOString() });
    // mesmo mapa (mesma data, hora e lugar) com outro id: nao duplica
    await outro.post([base('mapa-b1', 'Repetido', false, '1990-05-01', 1000)]);
    // outro mapa, marcado como principal e mais novo: passa a ser o principal
    await outro.post([base('mapa-b2', 'Mãe', true, '1960-02-02', 2000)]);
    await C.sincronizar();
    const lista = P.listar();
    assert.equal(lista.length, 2);
    assert.equal(lista.filter((m) => m.principal).length, 1);
    assert.equal(P.principal().id, 'mapa-b2');
});

test('dados hostis vindos da conta são ignorados e não geram laço de envio', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    await configurarAparelhoA(s);
    D.criarLeitura(cartasLeitura, '');
    await entrarComo(s, 'ana@exemplo.com');
    await C.ligar();
    const outro = await outroAparelho(s, 'ana@exemplo.com');
    const em = new Date(Date.now() + 1000).toISOString();
    await outro.post([
        { tipo: 'diario', id: 'ruim-1', dados: { id: 'ruim-1', t: 'ontem', tipo: 'leitura', cartas: [] }, atualizado_em: em },
        { tipo: 'diario', id: 'ruim-2', dados: { id: 'outro-id', t: em, tipo: 'leitura', cartas: cartasLeitura }, atualizado_em: em },
        { tipo: 'mapa', id: 'mapa-ruim', dados: { id: 'mapa-ruim', data: '1990-13-45', local: {} }, atualizado_em: em },
        { tipo: 'diario', id: 'xss', dados: { ...entradaDe('xss', '<img src=x onerror=alert(1)>'), cartas: cartasLeitura }, atualizado_em: em },
    ]);
    const r = await C.sincronizar();
    assert.equal(r.ok, true);
    const ids = D.listar().map((e) => e.id);
    assert.ok(!ids.includes('ruim-1') && !ids.includes('ruim-2'));
    assert.equal(P.listar().length, 0);
    assert.ok(ids.includes('xss')); // texto guardado como texto; a tela escapa ao desenhar (nao e HTML)
    assert.equal(D.obter('xss').nota, '<img src=x onerror=alert(1)>');
    const r2 = await C.sincronizar();
    assert.equal(r2.ok, true);
});

test('sessão expirada: erro "sessao", dados locais intactos; entrar de novo retoma sem refazer a junção', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    await configurarAparelhoA(s);
    const l = D.criarLeitura(cartasLeitura, '');
    await entrarComo(s, 'ana@exemplo.com');
    await C.ligar();
    s.jar.set('a', 'aeon=cookie-que-nao-existe-mais-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const r = await C.sincronizar();
    assert.deepEqual(r, { ok: false, motivo: 'sessao' });
    assert.equal(C.estadoConta().erro, 'sessao');
    assert.equal(D.obter(l.id).id, l.id);
    const cursorAntes = E.lerEstado().cursor;
    await entrarComo(s, 'ana@exemplo.com');
    assert.equal(C.estadoConta().fase, 'ligada');
    assert.equal(E.lerEstado().cursor, cursorAntes);
    assert.equal((await C.sincronizar()).ok, true);
});

test('sem rede: erro "rede", nada se perde, e volta a funcionar', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    await configurarAparelhoA(s);
    const l = D.criarLeitura(cartasLeitura, '');
    await entrarComo(s, 'ana@exemplo.com');
    await C.ligar();
    const bom = s.fetchComJar('a');
    C.configurar({ fetch: async () => { throw new TypeError('Failed to fetch'); } });
    D.salvarNota(l.id, 'escrita sem rede');
    assert.deepEqual(await C.sincronizar(), { ok: false, motivo: 'rede' });
    C.configurar({ fetch: bom });
    assert.equal((await C.sincronizar()).ok, true);
    const outro = await outroAparelho(s, 'ana@exemplo.com');
    assert.equal((await outro.ler(0)).itens.find((i) => i.id === l.id).dados.nota, 'escrita sem rede');
});

test('sair encerra a sessão e esquece a conta aqui, sem tocar nos registros', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    await configurarAparelhoA(s);
    D.criarLeitura(cartasLeitura, '');
    await entrarComo(s, 'ana@exemplo.com');
    await C.ligar();
    await C.sair();
    assert.equal(C.estadoConta().fase, 'desligada');
    assert.equal(D.listar().length, 1);
    assert.equal(mem.has(E.CHAVE_CONTA), false);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM sessoes').get().n, 0);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM itens').get().n > 0, true, 'a conta guarda a copia');
});

test('apagar os dados da conta limpa o servidor e mantém tudo no aparelho', { skip: pular }, async (t) => {
    const s = await subir();
    t.after(() => s.app.fechar());
    await configurarAparelhoA(s);
    D.criarLeitura(cartasLeitura, '');
    P.adicionar(mapaLocal());
    await entrarComo(s, 'ana@exemplo.com');
    await C.ligar();
    await C.apagarDadosDoServidor();
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 0);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM itens').get().n, 0);
    assert.equal(D.listar().length, 1);
    assert.equal(P.listar().length, 1);
    assert.equal(C.estadoConta().fase, 'desligada');
});

test('com a sincronizacao desligada nada acontece: apagar nao anota exclusao', async () => {
    limparTudo();
    E.marcarApagado('diario', 'x'); // sem estado ligado: nao anota
    assert.deepEqual(E.lerEstado().apagados, {});
});

test('perfil e mapas ganham data de edição e o backup continua válido', async () => {
    limparTudo();
    P.adicionar(mapaLocal());
    const m = P.principal();
    assert.ok(m.atualizado);
    const antes = m.atualizado;
    await new Promise((r) => setTimeout(r, 5));
    P.definirPreferencias(m.id, { casas: 'igual' });
    assert.ok(P.principal().atualizado > antes);
    const arquivo = JSON.stringify(P.exportar());
    mem.clear();
    const r = P.importar(arquivo);
    assert.equal(r.ok, true);
    assert.equal(P.listar().length, 1);
});
