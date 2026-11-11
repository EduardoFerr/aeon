import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartas, lerJson } from './util.js';
import {
    POSICOES, IDS_POSICAO, LINHAS, PLANOS, TOTAL, SINTESE, faltamSeis, sinteseLiberada, proximaVaga, proximaLeitura,
    anterior, seguinte, vizinho, elementoDe, relacaoEntre, compararLinha, compararPlanos, equilibrio, juntar, blocos, linhaResumo,
    colocarCarta, paraDiario,
} from '../../src/utils/templo.js';

// armazenamento em memoria para o diario (nao ha localStorage no Node)
const mem = new Map();
globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
};
const { sanearEntrada, guardarTemplo, guardarCruz, listar, exportar, importar, apagarEntrada, CHAVE_DIARIO, POSICOES_TEMPLO } = await import('../../src/utils/diario.js');

const c = (nome) => cartas.find((x) => x.name === nome);

/* ---------- desenho: sete cartas, tres linhas ---------- */

test('o templo tem sete posicoes: tres de voce, tres da outra pessoa e a Sintese', () => {
    assert.equal(TOTAL, 7);
    assert.deepEqual(IDS_POSICAO, ['mental-voce', 'afetivo-voce', 'fisico-voce', 'mental-outra', 'afetivo-outra', 'fisico-outra', 'sintese']);
    assert.deepEqual(POSICOES.slice(0, 3).map((p) => p.lado), ['voce', 'voce', 'voce']);
    assert.deepEqual(POSICOES.slice(3, 6).map((p) => p.lado), ['outra', 'outra', 'outra']);
    assert.equal(POSICOES[SINTESE].plano, 'sintese');
    assert.deepEqual(PLANOS, ['mental', 'afetivo', 'fisico']);
});

test('cada linha junta as cartas 1 e 4, 2 e 5, 3 e 6 (o mesmo plano dos dois lados)', () => {
    assert.deepEqual(LINHAS, [[0, 3], [1, 4], [2, 5]]);
    LINHAS.forEach(([v, o], k) => {
        assert.equal(POSICOES[v].plano, PLANOS[k]);
        assert.equal(POSICOES[o].plano, PLANOS[k]);
        assert.equal(POSICOES[v].lin, POSICOES[o].lin);
    });
});

/* ---------- Sintese, ordem e teclado ---------- */

test('a Sintese so abre depois das seis primeiras viradas', () => {
    assert.equal(faltamSeis(Array(7).fill(false)), 6);
    assert.equal(faltamSeis([true, true, true, true, false, true, true]), 1);
    assert.equal(sinteseLiberada([true, true, true, true, true, false, true]), false);
    assert.equal(sinteseLiberada([true, true, true, true, true, true, false]), true);
});

test('a proxima leitura segue a numeracao das cartas e deixa a Sintese por ultimo', () => {
    assert.equal(proximaLeitura(Array(7).fill(false)), 0);
    assert.equal(proximaLeitura([true, false, false, false, false, false, false]), 1);
    assert.equal(proximaLeitura([true, true, true, true, true, true, false]), 6);
    assert.equal(proximaLeitura(Array(7).fill(true)), -1);
    assert.equal(proximaLeitura([false, false, false, false, false, false, true]), 0);
    assert.equal(anterior(0), null);
    assert.equal(anterior(4), 3);
    assert.equal(seguinte(5), 6);
    assert.equal(seguinte(6), null);
});

test('as setas andam pela mesa como ela e desenhada', () => {
    // coluna da esquerda: 0 1 2; coluna da direita: 3 4 5; Sintese (6) embaixo, no centro
    assert.equal(vizinho(0, 'ArrowRight'), 3);
    assert.equal(vizinho(4, 'ArrowLeft'), 1);
    assert.equal(vizinho(3, 'ArrowRight'), null);
    assert.equal(vizinho(0, 'ArrowLeft'), null);
    assert.equal(vizinho(0, 'ArrowDown'), 1);
    assert.equal(vizinho(1, 'ArrowDown'), 2);
    assert.equal(vizinho(3, 'ArrowDown'), 4);
    assert.equal(vizinho(2, 'ArrowDown'), 6);
    assert.equal(vizinho(5, 'ArrowDown'), 6);
    assert.equal(vizinho(0, 'ArrowUp'), null);
    assert.equal(vizinho(5, 'ArrowUp'), 4);
    assert.equal(vizinho(6, 'ArrowUp'), 2);
    assert.equal(vizinho(6, 'ArrowUp', 1), 5, 'volta para a coluna em que estava');
    assert.equal(vizinho(6, 'ArrowLeft'), 2);
    assert.equal(vizinho(6, 'ArrowRight'), 5);
    assert.equal(vizinho(6, 'ArrowDown'), null);
    assert.equal(vizinho(4, 'Home'), 0);
    assert.equal(vizinho(1, 'End'), 6);
    assert.equal(vizinho(1, 'a'), null);
    // toda seta que anda leva a uma posicao valida
    for (let i = 0; i < 7; i++) for (const t of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
        const v = vizinho(i, t);
        assert.ok(v === null || (Number.isInteger(v) && v >= 0 && v < 7), `${i} ${t}`);
    }
});

/* ---------- elemento de cada carta ---------- */

test('o elemento vem do naipe nas cartas do baralho e do campo element nos Arcanos Maiores', () => {
    assert.deepEqual(elementoDe(c('Ás de Bastões')), { elemento: 'Fogo', maior: false });
    assert.deepEqual(elementoDe(c('Dois de Taças')), { elemento: 'Água', maior: false });
    assert.deepEqual(elementoDe(c('Três de Espadas')), { elemento: 'Ar', maior: false });
    assert.deepEqual(elementoDe(c('Quatro de Discos')), { elemento: 'Terra', maior: false });
    assert.deepEqual(elementoDe(c('Princesa de Taças')), { elemento: 'Água', maior: false });
    assert.deepEqual(elementoDe(c('O Louco')), { elemento: 'Ar', maior: true });
    assert.deepEqual(elementoDe(null), { elemento: null, maior: false });
});

test('as 78 cartas tem elemento, e naipe e campo element nunca discordam', () => {
    assert.equal(cartas.length, 78);
    let maiores = 0;
    for (const carta of cartas) {
        const e = elementoDe(carta);
        assert.ok(['Fogo', 'Água', 'Ar', 'Terra'].includes(e.elemento), carta.name);
        assert.equal(e.elemento, carta.element, `${carta.name}: naipe e element discordam`);
        if (e.maior) maiores++;
        else assert.ok(carta.suit, carta.name);
    }
    assert.equal(maiores, 22);
});

/* ---------- comparacao por linha ---------- */

test('a relacao entre elementos: sintonia, combinam, em tensao e distintos', () => {
    for (const e of ['Fogo', 'Água', 'Ar', 'Terra']) assert.equal(relacaoEntre(e, e), 'sintonia');
    assert.equal(relacaoEntre('Fogo', 'Ar'), 'combina');
    assert.equal(relacaoEntre('Ar', 'Fogo'), 'combina');
    assert.equal(relacaoEntre('Água', 'Terra'), 'combina');
    assert.equal(relacaoEntre('Terra', 'Água'), 'combina');
    assert.equal(relacaoEntre('Fogo', 'Água'), 'tensao');
    assert.equal(relacaoEntre('Água', 'Fogo'), 'tensao');
    assert.equal(relacaoEntre('Ar', 'Terra'), 'tensao');
    assert.equal(relacaoEntre('Terra', 'Ar'), 'tensao');
    assert.equal(relacaoEntre('Fogo', 'Terra'), 'distinto');
    assert.equal(relacaoEntre('Água', 'Ar'), 'distinto');
    assert.equal(relacaoEntre(null, 'Ar'), null);
});

test('a relacao e simetrica e cobre todos os pares dos quatro elementos', () => {
    const el = ['Fogo', 'Água', 'Ar', 'Terra'];
    const cont = { sintonia: 0, combina: 0, tensao: 0, distinto: 0 };
    for (const a of el) for (const b of el) {
        assert.equal(relacaoEntre(a, b), relacaoEntre(b, a));
        cont[relacaoEntre(a, b)]++;
    }
    assert.deepEqual(cont, { sintonia: 4, combina: 4, tensao: 4, distinto: 4 });
});

test('o Arcano Maior de um lado, do outro ou dos dois marca o peso do plano', () => {
    const m = c('O Louco'); // Arcano Maior
    const a = c('Ás de Bastões');
    const b = c('Dois de Taças');
    assert.equal(compararLinha(a, b).peso, null);
    assert.equal(compararLinha(m, b).peso, 'voce');
    assert.equal(compararLinha(a, m).peso, 'outra');
    assert.equal(compararLinha(m, c('A Torre')).peso, 'ambos');
    const l = compararLinha(a, b);
    assert.deepEqual(l.elementos, ['Fogo', 'Água']);
    assert.equal(l.relacao, 'tensao');
    assert.equal(compararLinha(a, null), null);
});

const seis = (...nomes) => [...nomes.map(c), c('O Sol')];

test('compararPlanos compara 1x4, 2x5 e 3x6, e so existe com as seis cartas', () => {
    const cs = seis('Ás de Bastões', 'Dois de Taças', 'Três de Espadas', 'Dois de Bastões', 'Três de Discos', 'Quatro de Espadas');
    const l = compararPlanos(cs);
    assert.equal(l.length, 3);
    assert.deepEqual(l.map((x) => x.plano), ['mental', 'afetivo', 'fisico']);
    assert.deepEqual(l.map((x) => x.relacao), ['sintonia', 'combina', 'sintonia']);
    assert.deepEqual(l.map((x) => x.indices), [[0, 3], [1, 4], [2, 5]]);
    assert.deepEqual(compararPlanos([cs[0], cs[1], null, cs[3], cs[4], cs[5], cs[6]]), []);
    assert.deepEqual(compararPlanos([]), []);
});

test('o equilibrio aponta o plano mais sintonizado e o mais descompassado, com empates juntos', () => {
    const mk = (...rels) => rels.map((r, k) => ({ plano: PLANOS[k], relacao: r, nivel: { sintonia: 4, combina: 3, distinto: 2, tensao: 1 }[r] }));
    assert.deepEqual(equilibrio(mk('sintonia', 'tensao', 'combina')), { igual: false, mais: ['mental'], menos: ['afetivo'], alto: 4, baixo: 1 });
    assert.deepEqual(equilibrio(mk('combina', 'combina', 'combina')), { igual: true, mais: [], menos: [], alto: 3, baixo: 3 });
    const e = equilibrio(mk('sintonia', 'distinto', 'sintonia'));
    assert.deepEqual(e.mais, ['mental', 'fisico']);
    assert.deepEqual(e.menos, ['afetivo']);
    assert.equal(equilibrio([]), null);
    assert.equal(juntar([]), '');
    assert.equal(juntar(['Mental']), 'Mental');
    assert.equal(juntar(['Mental', 'Físico']), 'Mental e Físico');
    assert.equal(juntar(['Mental', 'Afetivo', 'Físico']), 'Mental, Afetivo e Físico');
});

test('em dez mil tiragens simuladas a comparacao fecha: tres linhas, relacao valida, equilibrio coerente', () => {
    for (let k = 0; k < 10000; k++) {
        const baralho = [...cartas].sort(() => Math.random() - 0.5);
        const col = baralho.slice(0, 7);
        const linhas = compararPlanos(col);
        assert.equal(linhas.length, 3);
        for (const l of linhas) {
            assert.ok(['sintonia', 'combina', 'distinto', 'tensao'].includes(l.relacao));
            assert.ok([null, 'voce', 'outra', 'ambos'].includes(l.peso));
        }
        const eq = equilibrio(linhas);
        const niveis = linhas.map((l) => l.nivel);
        assert.equal(eq.igual, new Set(niveis).size === 1);
        if (!eq.igual) {
            assert.ok(eq.mais.length >= 1 && eq.menos.length >= 1);
            assert.ok(eq.mais.every((p) => !eq.menos.includes(p)));
        }
    }
});

/* ---------- campos de cada posicao, com as 78 cartas ---------- */

test('cada posicao le o campo combinado, sem texto novo, e nenhuma fica vazia nas 78 cartas', () => {
    for (const carta of cartas) {
        const ppf = carta.past_present_future;
        for (const i of [0, 3]) {
            const b = blocos(i, carta);
            assert.deepEqual(b.map((x) => x.id), ['mostra']);
            assert.equal(b[0].texto, ppf.present);
        }
        for (const i of [1, 4]) {
            const b = blocos(i, carta);
            assert.deepEqual(b.map((x) => x.id), ['luz', 'sombra']);
            assert.equal(b[0].texto, carta.eighth_greater);
            assert.equal(b[1].texto, carta.eighth_lesser);
        }
        for (const i of [2, 5]) {
            const b = blocos(i, carta);
            assert.deepEqual(b.map((x) => x.id), ['recado']);
            assert.equal(b[0].texto, carta.message_esoteric);
        }
        const s = blocos(6, carta);
        assert.deepEqual(s.map((x) => x.id), ['leva', 'levar']);
        assert.equal(s[0].texto, ppf.future);
        assert.equal(s[1].texto, carta.meditation_reflection[0]);
        for (let i = 0; i < 7; i++) for (const b of blocos(i, carta)) assert.ok(b.texto.trim().length > 20, `${carta.name} posicao ${i} bloco ${b.id}`);
    }
    assert.equal(linhaResumo(0, c('A Torre')), c('A Torre').past_present_future.present);
    assert.equal(linhaResumo(6, c('O Sol')), c('O Sol').past_present_future.future);
});

/* ---------- montagem: nunca repete carta ---------- */

test('a ordem em que se coloca decide qual carta cai onde, e nenhuma carta repete', () => {
    const baralho = cartas.slice(0, 12);
    let col = Array(7).fill(null);
    assert.equal(proximaVaga(col), 0);
    col = colocarCarta(baralho, col, 6); // a primeira carta do baralho vai para a Sintese
    col = colocarCarta(baralho, col, 0);
    col = colocarCarta(baralho, col, 3);
    assert.equal(col[6], baralho[0]);
    assert.equal(col[0], baralho[1]);
    assert.equal(col[3], baralho[2]);
    assert.equal(proximaVaga(col), 1);
    assert.equal(colocarCarta(baralho, col, 6), col, 'posicao ocupada nao muda');
    assert.equal(colocarCarta(baralho, col, 7), col, 'posicao fora da mesa');
    for (const p of [1, 2, 4, 5]) col = colocarCarta(baralho, col, p);
    assert.equal(new Set(col.map((x) => x.order)).size, 7);
    assert.equal(colocarCarta(baralho, col, 2), col);
    assert.equal(proximaVaga(col), -1);
});

test('em mil tiragens simuladas as sete cartas sao sempre diferentes', () => {
    for (let k = 0; k < 1000; k++) {
        const baralho = [...cartas].sort(() => Math.random() - 0.5);
        let col = Array(7).fill(null);
        const ordem = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
        for (const p of ordem) col = colocarCarta(baralho, col, p);
        assert.equal(new Set(col.map((x) => x.order)).size, 7);
    }
});

/* ---------- diario ---------- */

const sete = () => paraDiario([c('A Sacerdotisa'), c('A Estrela'), c('A Torre'), c('O Louco'), c('O Universo'), c('O Sol'), c('A Lua')]);
const bruta = (extra = {}) => ({ id: 'templo-teste', t: '2026-11-10T12:00:00.000Z', tipo: 'templo', cartas: sete(), nota: '', ...extra });

test('paraDiario leva as sete cartas na ordem de 1 a 7 com as posicoes do templo', () => {
    assert.deepEqual(sete().map((x) => x.pos), POSICOES_TEMPLO);
    assert.deepEqual(POSICOES_TEMPLO, IDS_POSICAO);
    assert.deepEqual(sete().map((x) => x.order), [2, 17, 16, 0, 21, 19, 18]);
});

test('sanearEntrada aceita o templo inteiro, a pergunta e a nota, e tira o que nao e da lista branca', () => {
    const e = sanearEntrada(bruta({ pergunta: '  Como está a relação?  ', nota: 'uma nota', lixo: 'x' }));
    assert.equal(e.tipo, 'templo');
    assert.equal(e.cartas.length, 7);
    assert.equal(e.pergunta, 'Como está a relação?');
    assert.equal(e.nota, 'uma nota');
    assert.equal('lixo' in e, false);
    assert.deepEqual(e.cartas.map((x) => x.pos), POSICOES_TEMPLO);
});

test('sanearEntrada recusa templo incompleto, repetido ou com posicao de outro tipo', () => {
    assert.equal(sanearEntrada(bruta({ cartas: sete().slice(0, 5) })), null, 'faltam cartas');
    assert.equal(sanearEntrada(bruta({ cartas: sete().map((x, i) => ({ ...x, order: i === 6 ? 2 : x.order })) })), null, 'carta repetida');
    assert.equal(sanearEntrada(bruta({ cartas: sete().map((x, i) => ({ ...x, pos: i === 6 ? 'mental-voce' : x.pos })) })), null, 'posicao repetida');
    assert.equal(sanearEntrada(bruta({ cartas: sete().map((x, i) => ({ order: x.order, pos: i === 0 ? 'passado' : x.pos })) })), null, 'posicao de tres cartas');
    assert.equal(sanearEntrada(bruta({ cartas: sete().map((x, i) => ({ order: x.order, pos: i === 0 ? 'momento' : x.pos })) })), null, 'posicao da cruz');
    assert.equal(sanearEntrada(bruta({ cartas: sete().map((x) => ({ order: x.order })) })), null, 'sem posicoes');
    assert.equal(sanearEntrada(bruta({ cartas: [...sete(), { order: 5, pos: 'sintese' }] })).cartas.length, 7, 'passou de sete: corta em sete');
});

test('validacao hostil: chaves perigosas, ordem fora do mapa, tipos errados e id invalido', () => {
    assert.equal(sanearEntrada(bruta({ cartas: sete().map((x, i) => (i === 3 ? { order: 99, pos: x.pos } : x)) })), null, 'order acima de 77');
    assert.equal(sanearEntrada(bruta({ cartas: sete().map((x, i) => (i === 3 ? { order: -1, pos: x.pos } : x)) })), null, 'order negativa');
    assert.equal(sanearEntrada(bruta({ cartas: sete().map((x, i) => (i === 3 ? { order: '4', pos: x.pos } : x)) })), null, 'order em texto');
    assert.equal(sanearEntrada(bruta({ cartas: sete().map((x, i) => (i === 3 ? { order: 1.5, pos: x.pos } : x)) })), null, 'order quebrada');
    assert.equal(sanearEntrada(bruta({ cartas: sete().map((x, i) => (i === 3 ? null : x)) })), null, 'carta nula');
    assert.equal(sanearEntrada(bruta({ cartas: 'sete' })), null);
    assert.equal(sanearEntrada(bruta({ cartas: { length: 7 } })), null);
    assert.equal(sanearEntrada(bruta({ id: '../x' })), null, 'id com caracteres perigosos');
    assert.equal(sanearEntrada(bruta({ id: 'a'.repeat(65) })), null, 'id grande demais');
    assert.equal(sanearEntrada(bruta({ t: 'ontem' })), null, 'data invalida');
    assert.equal(sanearEntrada(JSON.parse('{"id":"x1","t":"2026-11-10T12:00:00.000Z","tipo":"templo","cartas":[],"__proto__":{"a":1}}')), null, '__proto__');
    assert.equal(sanearEntrada(bruta({ constructor: 1 })), null, 'constructor');
    assert.equal(sanearEntrada({ ...bruta(), cartas: sete().map((x, i) => (i === 1 ? { ...x, prototype: 1 } : x)) }), null, 'prototype dentro da carta');
    const longa = sanearEntrada(bruta({ nota: 'x'.repeat(5000), pergunta: 'p'.repeat(500) }));
    assert.equal(longa.nota.length, 2000);
    assert.equal(longa.pergunta.length, 200);
    assert.equal(sanearEntrada(bruta({ pergunta: 42 })).pergunta, undefined, 'pergunta que nao e texto');
    assert.equal(sanearEntrada(bruta({ tipo: 'templo2' })), null, 'tipo desconhecido');
});

test('os outros tipos seguem como antes: o templo nao vale como leitura, cruz ou dia', () => {
    const leitura = { id: 'l1', t: '2026-11-10T12:00:00.000Z', tipo: 'leitura', cartas: sete(), nota: '', pergunta: 'Oi' };
    const l = sanearEntrada(leitura);
    assert.equal(l.cartas.length, 3, 'leitura corta em tres');
    assert.equal(l.cartas.every((x) => !x.pos), true, 'posicoes do templo nao entram numa leitura de tres');
    assert.equal(sanearEntrada({ ...leitura, tipo: 'cruz' }), null, 'sete cartas do templo nao fecham uma cruz');
    assert.equal(sanearEntrada({ id: 'd', t: '2026-11-10T12:00:00.000Z', tipo: 'dia', cartas: [{ order: 1 }], pergunta: 'x' }).pergunta, undefined);
    const cruz = { id: 'cz', t: '2026-11-10T12:00:00.000Z', tipo: 'cruz', cartas: ['momento', 'ajuda', 'obstaculo', 'caminho', 'sintese'].map((pos, i) => ({ order: i + 1, pos })), nota: '' };
    assert.equal(sanearEntrada(cruz).cartas.length, 5, 'a cruz continua valendo com cinco');
    assert.equal(sanearEntrada({ ...cruz, tipo: 'templo' }), null, 'cinco cartas nao fecham o templo');
});

test('guardarTemplo grava a entrada, lista, exporta, importa e apaga', () => {
    mem.clear();
    const r = guardarTemplo(sete(), 'Como está a relação nos próximos meses?');
    assert.equal(r.ok, true);
    assert.match(r.id, /^templo-/);
    const lista = listar();
    assert.equal(lista.length, 1);
    assert.equal(lista[0].tipo, 'templo');
    assert.equal(lista[0].pergunta, 'Como está a relação nos próximos meses?');
    assert.equal(JSON.parse(mem.get(CHAVE_DIARIO)).entradas[0].cartas.length, 7);
    const copia = JSON.stringify(exportar());
    mem.clear();
    assert.equal(listar().length, 0);
    const imp = importar(copia);
    assert.equal(imp.importadas, 1);
    assert.equal(listar()[0].cartas.length, 7);
    assert.equal(listar()[0].tipo, 'templo');
    assert.equal(importar(copia).importadas, 0, 'importar de novo nao duplica');
    assert.equal(apagarEntrada(r.id), true);
    assert.equal(listar().length, 0);
});

test('o backup com templo hostil ignora o que nao presta e importa o que presta', () => {
    mem.clear();
    const bom = bruta({ id: 'templo-bom' });
    const ruins = [
        bruta({ id: 'templo-r1', cartas: sete().slice(0, 4) }),
        bruta({ id: 'templo-r2', cartas: sete().map((x) => ({ ...x, order: 5 })) }),
        bruta({ id: 'templo r3' }),
        { id: 'templo-r4', t: '2026-11-10T12:00:00.000Z', tipo: 'templo', cartas: [{ order: 1, pos: 'sintese', __proto__: 1 }] },
    ];
    const r = importar(JSON.stringify({ v: 2, entradas: [bom, ...ruins, 'texto', 7, null, []] }));
    assert.equal(r.importadas, 1);
    assert.equal(r.ignoradas, ruins.length + 4);
    assert.equal(listar().length, 1);
    assert.equal(listar()[0].id, 'templo-bom');
    assert.equal(importar('{"v":2,"entradas":"x"}').ok, false);
    assert.equal(importar('nao e json').ok, false);
});

test('guardarTemplo sem pergunta nao grava o campo, e um templo invalido nao grava nada', () => {
    mem.clear();
    const r = guardarTemplo(sete());
    assert.equal(listar()[0].pergunta, undefined);
    const ruim = guardarTemplo(sete().slice(0, 6));
    assert.equal(ruim.ok, false);
    assert.equal(listar().length, 1);
    assert.ok(r.ok);
    // a cruz segue gravando como antes
    const cruz = guardarCruz(['momento', 'ajuda', 'obstaculo', 'caminho', 'sintese'].map((pos, i) => ({ order: i + 1, pos })));
    assert.equal(cruz.ok, true);
    assert.equal(listar().length, 2);
});

/* ---------- textos de interface: tudo que a tela le existe, com o tamanho e os marcadores certos ---------- */

test('todos os textos ui.templo usados pela tela existem em textos.json e na lista de ids', () => {
    const textos = lerJson('public/data/astro/textos.json');
    const ids = new Map(lerJson('tools/astro-ids.json').map((e) => [e.id, e]));
    const fonte = readFileSync(new URL('../../src/components/TemploScreen.js', import.meta.url), 'utf8');
    // ids escritos por inteiro na tela
    for (const m of fonte.matchAll(/'(ui\.(?:templo|cruz)\.[a-z.-]+)'/g)) {
        assert.ok(m[1] in textos, `falta ${m[1]}`);
        assert.ok(ids.has(m[1]), `falta ${m[1]} em astro-ids.json`);
    }
    // ids montados em tempo de execucao
    const montados = [];
    for (const p of POSICOES.filter((x) => x.plano !== 'sintese')) montados.push(`ui.templo.pos.${p.id}.sig`, `ui.templo.plano.${p.plano}`, `ui.templo.col.${p.lado}`);
    for (const pl of PLANOS) montados.push(`ui.templo.plano.${pl}.curto`);
    for (const r of ['sintonia', 'combina', 'distinto', 'tensao']) montados.push(`ui.templo.rel.${r}`, `ui.templo.rel.${r}.frase`);
    for (const w of ['voce', 'outra', 'ambos']) montados.push(`ui.templo.peso.${w}`);
    for (const k of ['periodo', 'linhas', 'outra']) montados.push(`ui.templo.dica.${k}`);
    for (const b of ['luz', 'sombra', 'recado', 'leva', 'levar']) montados.push(`ui.cruz.rot.${b}`);
    montados.push('ui.templo.pos.sintese.sig', 'ui.templo.rot.mostra', 'ui.cruz.pos.sintese');
    for (const id of montados) {
        assert.ok(id in textos, `falta ${id}`);
        assert.ok(ids.has(id), `falta ${id} em astro-ids.json`);
    }
});

test('os textos novos respeitam o limite, os marcadores e as palavras vetadas', () => {
    const textos = lerJson('public/data/astro/textos.json');
    const lista = lerJson('tools/astro-ids.json').filter((e) => e.id.startsWith('ui.templo.'));
    assert.ok(lista.length >= 60);
    const veto = /(?<![\p{L}\p{N}])(vai|v[aã]o|pede|pedem|pedir|gestos?|r[eé]guas?|travessias?|atravess\p{L}*|sempre|nunca|Crowley)(?![\p{L}\p{N}])|[—–]/iu;
    for (const e of lista) {
        const t = textos[e.id];
        assert.equal(typeof t, 'string', e.id);
        assert.ok([...t].length <= e.limite, `${e.id} acima do limite`);
        assert.ok(!veto.test(t), `${e.id} tem termo vetado`);
        for (const m of t.matchAll(/\{([^{}]*)\}/g)) assert.ok(e.marcadores.includes(m[1]), `${e.id}: marcador ${m[1]}`);
        if (/voc[eê]/i.test(t)) assert.deepEqual(e.permite, ['você'], `${e.id} usa "você" sem permissao`);
    }
});

test('o aviso e as frases da comparacao nao fazem previsao nem dao veredito', () => {
    const textos = lerJson('public/data/astro/textos.json');
    assert.match(textos['ui.templo.aviso'], /simbólica/);
    assert.match(textos['ui.templo.aviso'], /não mostra com certeza/);
    assert.match(textos['ui.templo.aviso'], /não dá veredito/);
    for (const id of Object.keys(textos).filter((k) => k.startsWith('ui.templo.rel.') || k.startsWith('ui.templo.peso.') || k.startsWith('ui.templo.eq.'))) {
        assert.ok(!/(dá certo|dar certo|vai dar|terminar|terminam|acaba|separa|fim da relação|toxic|tóxic|terapia|psicólog)/i.test(textos[id]), id);
    }
});
