import test from 'node:test';
import assert from 'node:assert/strict';
import { cartas } from './util.js';
import {
    POSICOES, IDS_POSICAO, artigo, frase, fraseDaCruz, blocos, linhaResumo, faltamQuatro, sinteseLiberada, proximaVaga,
    proximaLeitura, anterior, seguinte, vizinho, colocarCarta, paraDiario,
} from '../../src/utils/cruz.js';

// armazenamento em memoria para o diario (nao ha localStorage no Node)
const mem = new Map();
globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
};
const { sanearEntrada, guardarCruz, listar, exportar, importar, apagarEntrada, CHAVE_DIARIO, POSICOES_CRUZ } = await import('../../src/utils/diario.js');

const nomes = cartas.map((c) => c.name);
const c = (nome) => cartas.find((x) => x.name === nome);

/* ---------- frase da Sintese ---------- */

test('a frase do exemplo sai exatamente como combinado', () => {
    assert.equal(frase('A Estrela', 'A Torre', 'O Louco'), 'A Estrela ajuda, a Torre atrapalha e o Louco indica o caminho.');
});

test('a frase fecha com os 78 nomes: maiuscula inicial, ponto final, artigo e verbo concordando', () => {
    assert.equal(nomes.length, 78);
    for (const nome of nomes) {
        for (const lugar of [0, 1, 2]) {
            const tres = ['O Louco', 'A Torre', 'A Estrela'];
            tres[lugar] = nome;
            const f = frase(...tres);
            assert.match(f, /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/, f);
            assert.match(f, /\.$/, f);
            assert.ok(!f.includes('  ') && !/undefined|null/.test(f), f);
            const { a, resto } = artigo(nome);
            const esperado = `${a} ${resto}`;
            assert.ok(f.toLowerCase().includes(esperado.toLowerCase()), `${nome}: ${f}`);
        }
    }
});

test('so Os Amantes pedem verbo no plural; femininos e masculinos levam o artigo certo', () => {
    const plurais = nomes.filter((n) => ['os', 'as'].includes(artigo(n).a));
    assert.deepEqual(plurais, ['Os Amantes']);
    assert.match(frase('Os Amantes', 'A Torre', 'O Louco'), /^Os Amantes ajudam, a Torre atrapalha/);
    assert.match(frase('A Estrela', 'Os Amantes', 'O Louco'), /os Amantes atrapalham/);
    assert.match(frase('A Estrela', 'A Torre', 'Os Amantes'), /os Amantes indicam o caminho\.$/);
    for (const n of nomes) {
        const a = artigo(n).a;
        if (/^(Princesa|Rainha)\b/.test(n) || /^A /.test(n)) assert.equal(a, 'a', n);
        if (/^(Príncipe|Cavaleiro|Ás|Dois|Três|Quatro|Cinco|Seis|Sete|Oito|Nove|Dez)\b/.test(n) || /^O /.test(n)) assert.equal(a, 'o', n);
    }
    assert.equal(artigo('Princesa de Taças').a, 'a');
    assert.equal(artigo('Ás de Bastões').a, 'o');
});

test('fraseDaCruz usa Ajuda, Obstaculo e Caminho (indices 1, 2 e 3) e so existe com as tres', () => {
    const cinco = [c('A Sacerdotisa'), c('A Estrela'), c('A Torre'), c('O Louco'), c('O Universo')];
    assert.equal(fraseDaCruz(cinco), 'A Estrela ajuda, a Torre atrapalha e o Louco indica o caminho.');
    assert.equal(fraseDaCruz([cinco[0], cinco[1], null, null, null]), '');
});

/* ---------- campos de cada posicao, com as 78 cartas ---------- */

test('cada posicao le o campo combinado, sem texto novo, e nenhuma fica vazia nas 78 cartas', () => {
    for (const carta of cartas) {
        const ppf = carta.past_present_future;
        const momento = blocos(0, carta);
        assert.deepEqual(momento.map((b) => b.id), ['dilema']);
        assert.equal(momento[0].texto, ppf.present);
        const ajuda = blocos(1, carta);
        assert.deepEqual(ajuda.map((b) => b.id), ['luz']);
        assert.equal(ajuda[0].texto, carta.eighth_greater);
        const obst = blocos(2, carta);
        assert.deepEqual(obst.map((b) => b.id), ['sombra']);
        assert.equal(obst[0].texto, carta.eighth_lesser);
        const cam = blocos(3, carta);
        assert.deepEqual(cam.map((b) => b.id), ['leva', 'levar']);
        assert.equal(cam[0].texto, ppf.future);
        assert.equal(cam[1].texto, carta.meditation_reflection[0]);
        const sint = blocos(4, carta, { fraseOk: true, fraseTexto: 'Frase.' });
        assert.deepEqual(sint.map((b) => b.id), ['recado', 'desenho']);
        assert.equal(sint[0].texto, carta.message_esoteric);
        assert.equal(sint[1].texto, 'Frase.');
        assert.equal(sint[1].nota, true);
        for (let i = 0; i < 5; i++) {
            for (const b of blocos(i, carta, { fraseOk: true, fraseTexto: 'Frase.' })) assert.ok(b.texto.trim().length > 20 || b.id === 'desenho', `${carta.name} posicao ${i} bloco ${b.id}`);
        }
    }
});

test('a Sintese sem as tres viradas mostra a espera, nao a frase', () => {
    const sint = blocos(4, c('O Universo'), { fraseOk: false });
    assert.equal(sint[1].espera, true);
    assert.equal(sint[1].texto, '');
    assert.equal(linhaResumo(4, c('O Universo'), { fraseOk: false }), c('O Universo').message_esoteric);
    assert.equal(linhaResumo(4, c('O Universo'), { fraseOk: true, fraseTexto: 'F.' }), 'F.');
    assert.equal(linhaResumo(0, c('A Torre')), c('A Torre').past_present_future.present);
});

/* ---------- ordem de leitura, Sintese e teclado ---------- */

test('a ordem de leitura e Momento, Ajuda, Obstaculo, Caminho, Sintese', () => {
    assert.deepEqual(IDS_POSICAO, ['momento', 'ajuda', 'obstaculo', 'caminho', 'sintese']);
    assert.deepEqual(POSICOES.map((p) => p.area), ['t', 'l', 'r', 'b', 'c']);
    assert.equal(anterior(0), null);
    assert.equal(anterior(3), 2);
    assert.equal(seguinte(3), 4);
    assert.equal(seguinte(4), null);
});

test('a proxima leitura sugerida segue a ordem e deixa a Sintese por ultimo', () => {
    assert.equal(proximaLeitura([false, false, false, false, false]), 0);
    assert.equal(proximaLeitura([true, false, false, false, false]), 1);
    assert.equal(proximaLeitura([true, false, true, false, false]), 1);
    assert.equal(proximaLeitura([true, true, true, true, false]), 4);
    assert.equal(proximaLeitura([true, true, true, true, true]), -1);
    assert.equal(proximaLeitura([false, false, false, false, true]), 0);
});

test('a Sintese so abre depois das quatro viradas', () => {
    assert.equal(faltamQuatro([false, false, false, false, false]), 4);
    assert.equal(faltamQuatro([true, false, true, false, true]), 2);
    assert.equal(sinteseLiberada([true, true, true, false, false]), false);
    assert.equal(sinteseLiberada([true, true, true, true, false]), true);
});

test('as setas andam pela cruz como ela e desenhada, Home vai ao Momento e End a Sintese', () => {
    // 0 Momento (topo), 1 Ajuda (esquerda), 2 Obstaculo (direita), 3 Caminho (base), 4 Sintese (centro)
    assert.equal(vizinho(0, 'ArrowDown'), 4);
    assert.equal(vizinho(4, 'ArrowUp'), 0);
    assert.equal(vizinho(4, 'ArrowLeft'), 1);
    assert.equal(vizinho(4, 'ArrowRight'), 2);
    assert.equal(vizinho(4, 'ArrowDown'), 3);
    assert.equal(vizinho(1, 'ArrowRight'), 4);
    assert.equal(vizinho(2, 'ArrowLeft'), 4);
    assert.equal(vizinho(3, 'ArrowUp'), 4);
    assert.equal(vizinho(0, 'ArrowUp'), null);
    assert.equal(vizinho(1, 'ArrowLeft'), null);
    assert.equal(vizinho(2, 'Home'), 0);
    assert.equal(vizinho(2, 'End'), 4);
});

/* ---------- montagem: nunca repete carta ---------- */

test('a ordem em que se coloca decide qual carta cai onde, e nenhuma carta repete', () => {
    const baralho = cartas.slice(0, 10);
    let col = Array(5).fill(null);
    assert.equal(proximaVaga(col), 0);
    col = colocarCarta(baralho, col, 3); // a primeira carta do baralho vai para o Caminho
    col = colocarCarta(baralho, col, 0);
    col = colocarCarta(baralho, col, 4);
    assert.equal(col[3], baralho[0]);
    assert.equal(col[0], baralho[1]);
    assert.equal(col[4], baralho[2]);
    assert.equal(proximaVaga(col), 1);
    assert.equal(colocarCarta(baralho, col, 3), col, 'posicao ocupada nao muda');
    col = colocarCarta(baralho, col, 1);
    col = colocarCarta(baralho, col, 2);
    assert.equal(new Set(col.map((x) => x.order)).size, 5);
    assert.equal(colocarCarta(baralho, col, 2), col);
    assert.equal(proximaVaga(col), -1);
});

test('em mil tiragens simuladas as cinco cartas sao sempre diferentes', () => {
    for (let k = 0; k < 1000; k++) {
        const baralho = [...cartas].sort(() => Math.random() - 0.5);
        let col = Array(5).fill(null);
        const ordem = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
        for (const p of ordem) col = colocarCarta(baralho, col, p);
        assert.equal(new Set(col.map((x) => x.order)).size, 5);
    }
});

/* ---------- diario ---------- */

const cinco = () => paraDiario([c('A Sacerdotisa'), c('A Estrela'), c('A Torre'), c('O Louco'), c('O Universo')]);
const bruta = (extra = {}) => ({ id: 'cruz-teste', t: '2026-11-10T12:00:00.000Z', tipo: 'cruz', cartas: cinco(), nota: '', ...extra });

test('paraDiario leva as cinco cartas na ordem de leitura com as posicoes novas', () => {
    assert.deepEqual(cinco().map((x) => x.pos), POSICOES_CRUZ);
    assert.deepEqual(cinco().map((x) => x.order), [2, 17, 16, 0, 21]);
});

test('sanearEntrada aceita a cruz inteira e a pergunta', () => {
    const e = sanearEntrada(bruta({ pergunta: '  Devo mudar de cidade?  ', lixo: 'x' }));
    assert.equal(e.tipo, 'cruz');
    assert.equal(e.cartas.length, 5);
    assert.equal(e.pergunta, 'Devo mudar de cidade?');
    assert.equal('lixo' in e, false);
    assert.deepEqual(e.cartas.map((x) => x.pos), POSICOES_CRUZ);
});

test('sanearEntrada recusa cruz incompleta, repetida ou com posicao de outro tipo', () => {
    assert.equal(sanearEntrada(bruta({ cartas: cinco().slice(0, 3) })), null);
    assert.equal(sanearEntrada(bruta({ cartas: cinco().map((x, i) => ({ ...x, order: i === 4 ? 2 : x.order })) })), null, 'carta repetida');
    assert.equal(sanearEntrada(bruta({ cartas: cinco().map((x, i) => ({ ...x, pos: i === 4 ? 'momento' : x.pos })) })), null, 'posicao repetida');
    assert.equal(sanearEntrada(bruta({ cartas: cinco().map((x, i) => ({ order: x.order, pos: i === 0 ? 'passado' : x.pos })) })), null, 'posicao de tres cartas');
    assert.equal(sanearEntrada(bruta({ cartas: [...cinco(), { order: 5, pos: 'momento' }] })).cartas.length, 5, 'passou de cinco: corta em cinco');
});

test('os outros tipos seguem como antes: leitura com 3, cruz nao vale como leitura', () => {
    const leitura = { id: 'l1', t: '2026-11-10T12:00:00.000Z', tipo: 'leitura', cartas: [{ order: 1, pos: 'passado' }, { order: 2, pos: 'presente' }, { order: 3, pos: 'futuro' }, { order: 4, pos: 'futuro' }], nota: '', pergunta: 'Oi' };
    assert.equal(sanearEntrada(leitura).cartas.length, 3);
    assert.equal(sanearEntrada({ ...leitura, cartas: cinco() }).cartas.every((x) => !x.pos), true, 'posicoes da cruz nao entram numa leitura de tres');
    assert.equal(sanearEntrada({ ...leitura, tipo: 'tiragem-nova' }), null, 'tipo desconhecido (o que uma versao antiga faria com a cruz)');
    assert.equal(sanearEntrada({ id: 'd', t: '2026-11-10T12:00:00.000Z', tipo: 'dia', cartas: [{ order: 1 }], pergunta: 'x' }).pergunta, undefined);
});

test('guardarCruz grava a entrada, lista, exporta, importa e apaga', () => {
    mem.clear();
    const r = guardarCruz(cinco(), 'Devo mudar de cidade este ano?');
    assert.equal(r.ok, true);
    assert.match(r.id, /^cruz-/);
    const lista = listar();
    assert.equal(lista.length, 1);
    assert.equal(lista[0].tipo, 'cruz');
    assert.equal(lista[0].pergunta, 'Devo mudar de cidade este ano?');
    assert.equal(JSON.parse(mem.get(CHAVE_DIARIO)).entradas[0].cartas.length, 5);
    const copia = JSON.stringify(exportar());
    mem.clear();
    assert.equal(listar().length, 0);
    const imp = importar(copia);
    assert.equal(imp.importadas, 1);
    assert.equal(listar()[0].cartas.length, 5);
    assert.equal(apagarEntrada(r.id), true);
    assert.equal(listar().length, 0);
});

test('guardarCruz sem pergunta nao grava o campo, e uma cruz invalida nao grava nada', () => {
    mem.clear();
    const r = guardarCruz(cinco());
    assert.equal(listar()[0].pergunta, undefined);
    const ruim = guardarCruz(cinco().slice(0, 4));
    assert.equal(ruim.ok, false);
    assert.equal(listar().length, 1);
    assert.ok(r.ok);
});
