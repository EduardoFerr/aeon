import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularMapa } from '../../src/astro/mapa.js';
import { cartas } from './util.js';

const mem = new Map();
globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
};
const P = await import('../../src/utils/perfil.js');
const V = await import('../../src/utils/verso.js');

// o calculo de verdade (motor astronomico), sem a leitura do navegador
const calcular = async (m) => calcularMapa({ data: m.data, hora: m.hora, local: m.local, escolhaHora: m.escolha || 0, casas: m.casas || 'placidus', cartas });
const SP = { nome: 'São Paulo', lat: -23.55, lon: -46.63, tz: 'America/Sao_Paulo' };
const mapa = (data, hora = '08:30') => ({ rotulo: 'Meu mapa', data, hora, local: SP, principal: true });

test('sem mapa principal, o verso é o padrão do Aeon', () => {
    mem.clear();
    const v = V.versoAtual();
    assert.equal(v.id, 'padrao');
    assert.equal(v.url, '/assets/versos/verso-padrao.webp');
    assert.equal(v.temMapa, false);
});

test('com mapa principal o verso passa a ser o do signo solar, sozinho (modo auto)', async () => {
    mem.clear();
    P.adicionar(mapa('1990-05-01')); // Sol em Touro
    assert.equal(V.versoAtual().id, 'padrao', 'antes de calcular ainda é o padrão');
    assert.equal(V.versoAtual().temMapa, true);
    assert.equal(await V.atualizarSigno(calcular), 'touro');
    const v = V.versoAtual();
    assert.equal(v.id, 'touro');
    assert.equal(v.url, '/assets/versos/verso-touro.webp');
});

test('cada data cai no signo solar certo (virada de signo incluída)', async () => {
    const casos = [['1990-03-25', 'aries'], ['1990-07-30', 'leao'], ['1990-08-25', 'virgem'], ['1990-12-25', 'capricornio'], ['1991-02-25', 'peixes'], ['1990-01-15', 'capricornio'], ['1990-01-25', 'aquario']];
    for (const [data, esperado] of casos) {
        mem.clear();
        P.adicionar(mapa(data, '12:00'));
        assert.equal(await V.atualizarSigno(calcular), esperado, data);
    }
});

test('voltar ao padrão vale, e a escolha fica guardada; voltar ao do signo também', async () => {
    mem.clear();
    P.adicionar(mapa('1990-05-01'));
    await V.atualizarSigno(calcular);
    assert.equal(V.lerPreferencia(), 'auto');
    V.definirPreferencia('padrao');
    assert.equal(V.versoAtual().id, 'padrao');
    assert.equal(V.versoAtual().signo, 'touro', 'o signo continua conhecido, para a tela oferecer a volta');
    V.definirPreferencia('auto');
    assert.equal(V.versoAtual().id, 'touro');
});

test('mudar data, hora ou lugar do mapa invalida o signo guardado; só apagar o mapa volta ao padrão', async () => {
    mem.clear();
    P.adicionar(mapa('1990-05-01'));
    await V.atualizarSigno(calcular);
    const m = P.principal();
    assert.equal(V.signoGuardado(m), 'touro');
    P.atualizar(m.id, { ...m, data: '1990-07-30', rotulo: m.rotulo });
    assert.equal(V.signoGuardado(), null, 'o mapa mudou: o signo guardado não vale mais');
    assert.equal(V.versoAtual().id, 'padrao');
    assert.equal(await V.atualizarSigno(calcular), 'leao');
    assert.equal(V.versoAtual().id, 'leao');
    P.apagar(P.principal().id);
    assert.equal(V.versoAtual().id, 'padrao');
});

test('o cache do signo não vaza para outro mapa', async () => {
    mem.clear();
    P.adicionar(mapa('1990-05-01'));
    await V.atualizarSigno(calcular);
    const a = P.principal();
    P.apagar(a.id);
    P.adicionar(mapa('1990-08-25'));
    assert.equal(V.signoGuardado(), null);
    assert.notEqual(V.assinaturaDoMapa(a), V.assinaturaDoMapa(P.principal()));
});

test('falha no cálculo ou dado de cache corrompido não quebra: fica no padrão', async () => {
    mem.clear();
    P.adicionar(mapa('1990-05-01'));
    assert.equal(await V.atualizarSigno(async () => { throw new Error('sem motor'); }), null);
    assert.equal(await V.atualizarSigno(async () => ({ pontos: { sol: { signo: '../../x' } } })), null);
    assert.equal(V.versoAtual().id, 'padrao');
    mem.set(V.CHAVE_SIGNO, '{quebrado');
    mem.set(V.CHAVE_PREFERENCIA, 'lixo');
    assert.equal(V.versoAtual().id, 'padrao');
    assert.equal(V.lerPreferencia(), 'auto');
});

test('urlDoVerso só devolve arquivos conhecidos (nada de caminho vindo de dado)', () => {
    assert.equal(V.urlDoVerso('leao'), '/assets/versos/verso-leao.webp');
    for (const ruim of ['../../x', 'leao.webp', '', null, undefined, 'LEAO', 'padrao/../leao']) {
        assert.equal(V.urlDoVerso(ruim), '/assets/versos/verso-padrao.webp', String(ruim));
    }
});
