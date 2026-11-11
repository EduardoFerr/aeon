import test from 'node:test';
import assert from 'node:assert/strict';

// armazenamento em memoria para o diario (nao ha localStorage no Node)
const dados = new Map();
globalThis.localStorage = {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
};
const { guardarCruz, criarLeitura, guardarTemplo, guardarDia } = await import('../../src/utils/diario.js');
const { entradaParaTela } = await import('../../src/utils/reabrir.js');
const { IDS_POSICAO: POS_CRUZ } = await import('../../src/utils/cruz.js');
const { IDS_POSICAO: POS_TEMPLO } = await import('../../src/utils/templo.js');

const baralho = Array.from({ length: 78 }, (_, i) => ({ order: i, name: `Carta ${i}` }));
const com = (ids, ordens) => ids.map((pos, i) => ({ order: ordens[i], pos }));

test('reabre a cruz com as cartas nas posicoes em que foram guardadas', () => {
    const r = guardarCruz(com(POS_CRUZ, [10, 20, 30, 40, 50]), 'e agora?');
    const t = entradaParaTela(r.id, 'cruz', POS_CRUZ, baralho);
    assert.deepEqual(t.cartas.map((c) => c.order), [10, 20, 30, 40, 50]);
    assert.equal(t.pergunta, 'e agora?');
    assert.equal(t.id, r.id);
    assert.match(t.data, /^\d{4}-\d{2}-\d{2}$/);
});

test('reabre o templo e a leitura de 3 cartas', () => {
    const tp = guardarTemplo(com(POS_TEMPLO, [1, 2, 3, 4, 5, 6, 7]), '');
    assert.deepEqual(entradaParaTela(tp.id, 'templo', POS_TEMPLO, baralho).cartas.map((c) => c.order), [1, 2, 3, 4, 5, 6, 7]);
    const posicoes = ['passado', 'presente', 'futuro'];
    const l = criarLeitura(com(posicoes, [9, 8, 7]), 'pergunta');
    assert.deepEqual(entradaParaTela(l.id, 'leitura', posicoes, baralho).cartas.map((c) => c.order), [9, 8, 7]);
});

test('devolve null se a entrada sumiu, e de outro tipo, ou tem carta fora do baralho', () => {
    assert.equal(entradaParaTela('nao-existe', 'cruz', POS_CRUZ, baralho), null);
    assert.equal(entradaParaTela(undefined, 'cruz', POS_CRUZ, baralho), null);
    const r = guardarCruz(com(POS_CRUZ, [11, 21, 31, 41, 51]), '');
    assert.equal(entradaParaTela(r.id, 'templo', POS_TEMPLO, baralho), null);
    assert.equal(entradaParaTela(r.id, 'cruz', POS_CRUZ, baralho.filter((c) => c.order !== 31)), null);
    const dia = guardarDia(5);
    assert.equal(entradaParaTela(dia.id, 'cruz', POS_CRUZ, baralho), null);
});
