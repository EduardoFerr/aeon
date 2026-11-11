import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validarItem, filtrarLista, carregarBiscoito, limparCache, indiceAleatorio, formatarNumeros, numerosFalados,
    textoParaCopiar, textoParaCompartilhar, anuncioDaQuebra, copiarTexto, MIN_ITENS,
} from '../../src/utils/biscoito.js';

const item = (id = 1, extra = {}) => ({ id, texto: `Frase número ${id}.`, numeros: [7, 14, 23, 31, 45, 58], ...extra });
const lista = (n) => Array.from({ length: n }, (_, i) => item(i + 1));

function trocarGlobal(nome, valor) {
    const antes = Object.getOwnPropertyDescriptor(globalThis, nome);
    Object.defineProperty(globalThis, nome, { value: valor, configurable: true, writable: true });
    return () => (antes ? Object.defineProperty(globalThis, nome, antes) : delete globalThis[nome]);
}

/* ---------- validacao do item ---------- */

test('item valido: id, texto de ate 110 caracteres e 6 numeros crescentes de 1 a 60', () => {
    assert.equal(validarItem(item()), true);
    assert.equal(validarItem(item(1, { numeros: [1, 2, 3, 4, 5, 6] })), true);
    assert.equal(validarItem(item(1, { numeros: [55, 56, 57, 58, 59, 60] })), true);
    assert.equal(validarItem(item(1, { texto: 'x'.repeat(110) })), true);
});

test('item invalido: id, texto ou numeros fora da regra', () => {
    assert.equal(validarItem(null), false);
    assert.equal(validarItem('texto'), false);
    assert.equal(validarItem(item(0)), false);
    assert.equal(validarItem(item('3')), false);
    assert.equal(validarItem(item(1.5)), false);
    assert.equal(validarItem(item(1, { texto: '' })), false);
    assert.equal(validarItem(item(1, { texto: '   ' })), false);
    assert.equal(validarItem(item(1, { texto: 42 })), false);
    assert.equal(validarItem(item(1, { texto: 'x'.repeat(111) })), false);
    assert.equal(validarItem(item(1, { numeros: [7, 14, 23, 31, 45] })), false); // 5 itens
    assert.equal(validarItem(item(1, { numeros: [7, 14, 23, 31, 45, 58, 59] })), false); // 7 itens
    assert.equal(validarItem(item(1, { numeros: [0, 14, 23, 31, 45, 58] })), false); // abaixo de 1
    assert.equal(validarItem(item(1, { numeros: [7, 14, 23, 31, 45, 61] })), false); // acima de 60
    assert.equal(validarItem(item(1, { numeros: [14, 7, 23, 31, 45, 58] })), false); // fora de ordem
    assert.equal(validarItem(item(1, { numeros: [7, 7, 23, 31, 45, 58] })), false); // repetido
    assert.equal(validarItem(item(1, { numeros: ['7', 14, 23, 31, 45, 58] })), false); // texto no lugar de numero
    assert.equal(validarItem(item(1, { numeros: [7.5, 14, 23, 31, 45, 58] })), false);
    assert.equal(validarItem(item(1, { numeros: 'sete' })), false);
});

test('o limite do texto pode ser alargado (estado ja guardado aceita ate 160)', () => {
    assert.equal(validarItem(item(1, { texto: 'x'.repeat(150) }), 160), true);
    assert.equal(validarItem(item(1, { texto: 'x'.repeat(161) }), 160), false);
});

test('filtrarLista descarta item a item, id repetido e campo extra', () => {
    const bruto = [item(1), item(2, { numeros: [1, 2, 3] }), item(3), item(3, { texto: 'repetido' }), { id: 4, texto: 'ok', numeros: [1, 2, 3, 4, 5, 6], extra: 'x' }];
    const saida = filtrarLista(bruto);
    assert.deepEqual(saida.map((x) => x.id), [1, 3, 4]);
    assert.equal(saida[1].texto, 'Frase número 3.');
    assert.deepEqual(Object.keys(saida[2]).sort(), ['id', 'numeros', 'texto']);
    assert.deepEqual(filtrarLista('nao e lista'), []);
    assert.deepEqual(filtrarLista(null), []);
});

/* ---------- formato dos numeros e dos textos ---------- */

test('numeros sempre com dois digitos e em ordem; o leitor de tela fala sem zero a esquerda', () => {
    assert.equal(formatarNumeros([7, 14, 23, 31, 45, 58]), '07 14 23 31 45 58');
    assert.equal(formatarNumeros([1, 2, 3, 4, 5, 6]), '01 02 03 04 05 06');
    assert.equal(formatarNumeros([55, 56, 57, 58, 59, 60]), '55 56 57 58 59 60');
    assert.equal(numerosFalados([7, 14, 23, 31, 45, 58]), '7, 14, 23, 31, 45, 58');
    assert.ok(!/(^|, )0\d/.test(numerosFalados([1, 2, 3, 4, 5, 6])));
});

test('copiar: exatamente tres linhas (frase, numeros da sorte, endereco), texto simples', () => {
    const t = textoParaCopiar(item(412, { texto: 'A calma também é uma forma de coragem.' }));
    assert.equal(t, 'A calma também é uma forma de coragem.\nNúmeros da sorte: 07 14 23 31 45 58\naeonfool.com');
    assert.equal(t.split('\n').length, 3);
    assert.ok(!/[<>]/.test(t));
});

test('texto de compartilhar e anuncio do leitor de tela', () => {
    const x = item(1, { texto: 'A calma também é uma forma de coragem.' });
    assert.equal(textoParaCompartilhar(x), 'Meu biscoito da sorte no Aeon Fool: “A calma também é uma forma de coragem.” Números: 07 14 23 31 45 58. aeonfool.com');
    assert.equal(anuncioDaQuebra(x), 'Biscoito quebrado. A calma também é uma forma de coragem. Seus números da sorte: 7, 14, 23, 31, 45, 58.');
});

test('copiarTexto usa a area de transferencia; se ela falha e nao ha document, devolve false sem lancar', async () => {
    let gravado = null;
    let volta = trocarGlobal('navigator', { clipboard: { writeText: async (t) => { gravado = t; } } });
    assert.equal(await copiarTexto('olá'), true);
    assert.equal(gravado, 'olá');
    volta();
    volta = trocarGlobal('navigator', { clipboard: { writeText: async () => { throw new Error('negado'); } } });
    assert.equal(await copiarTexto('olá'), false); // sem document no node
    volta();
    volta = trocarGlobal('navigator', {});
    assert.equal(await copiarTexto('olá'), false);
    volta();
});

test('copiarTexto cai no textarea + execCommand quando a Clipboard API falha', async () => {
    const criados = [];
    const doc = {
        body: { appendChild: (el) => criados.push(el) },
        createElement: () => ({ style: {}, setAttribute() {}, select() {}, setSelectionRange() {}, remove() { this.removido = true; } }),
        execCommand: (c) => c === 'copy',
    };
    const v1 = trocarGlobal('navigator', { clipboard: { writeText: async () => { throw new Error('x'); } } });
    const v2 = trocarGlobal('document', doc);
    assert.equal(await copiarTexto('olá'), true);
    assert.equal(criados.length, 1);
    assert.equal(criados[0].value, 'olá');
    assert.equal(criados[0].removido, true);
    v1(); v2();
});

/* ---------- sorteio do indice ---------- */

test('indiceAleatorio cobre 0 a n-1 em 5000 sorteios e nunca devolve n', () => {
    for (const n of [1, 2, 7, 10, 1000]) {
        const vistos = new Set();
        for (let i = 0; i < 5000; i++) {
            const k = indiceAleatorio(n);
            assert.ok(Number.isInteger(k) && k >= 0 && k < n, `fora da faixa: ${k} (n=${n})`);
            vistos.add(k);
        }
        if (n <= 10) assert.equal(vistos.size, n);
        else assert.ok(vistos.size > n * 0.95);
    }
});

test('indiceAleatorio rejeita os valores da cauda (sem vies de modulo) e recusa n invalido', () => {
    const n = 3;
    const limite = Math.floor(0x100000000 / n) * n; // 4294967295: so 0xffffffff fica de fora (2^32 nao e multiplo de 3)
    assert.equal(limite, 0xffffffff);
    const fila = [0xffffffff, 7];
    assert.equal(indiceAleatorio(n, () => fila.shift()), 7 % 3);
    assert.equal(fila.length, 0); // o valor da cauda foi descartado e outro foi pedido
    const aceito = [0xfffffffe];
    assert.equal(indiceAleatorio(n, () => aceito.shift()), 0xfffffffe % 3);
    assert.throws(() => indiceAleatorio(0), RangeError);
    assert.throws(() => indiceAleatorio(-1), RangeError);
    assert.throws(() => indiceAleatorio(2.5), RangeError);
});

test('indiceAleatorio e uniforme o bastante (qui-quadrado grosseiro em 10 faixas)', () => {
    const n = 10, total = 20000, cont = new Array(n).fill(0);
    for (let i = 0; i < total; i++) cont[indiceAleatorio(n)]++;
    const esperado = total / n;
    const qui = cont.reduce((s, c) => s + (c - esperado) ** 2 / esperado, 0);
    assert.ok(qui < 40, `qui-quadrado alto demais: ${qui}`); // gl = 9; 40 e folga larga (p ~ 1e-5)
});

/* ---------- carregamento ---------- */

function fetchFalso(corpo, { ok = true, status = 200 } = {}) {
    const f = async () => {
        f.chamadas++;
        return { ok, status, json: async () => (typeof corpo === 'function' ? corpo() : corpo) };
    };
    f.chamadas = 0;
    return f;
}

test('carrega, valida item a item e guarda a promessa (uma busca por visita)', async () => {
    limparCache();
    const sujo = [...lista(MIN_ITENS + 20), item(9999, { numeros: [1, 2, 3, 4, 5, 99] }), { lixo: true }];
    const f = fetchFalso(sujo);
    const volta = trocarGlobal('fetch', f);
    try {
        const a = await carregarBiscoito();
        const b = await carregarBiscoito();
        assert.equal(a.length, MIN_ITENS + 20); // os dois invalidos ficaram de fora
        assert.equal(a, b);
        assert.equal(f.chamadas, 1);
    } finally {
        volta();
        limparCache();
    }
});

test('resposta 404, JSON invalido, lista curta e rede fora: erro, e o cache e zerado para tentar de novo', async () => {
    const casos = {
        '404': fetchFalso([], { ok: false, status: 404 }),
        'json invalido': fetchFalso(() => { throw new SyntaxError('JSON'); }),
        'nao e lista': fetchFalso({ a: 1 }),
        '50 itens': fetchFalso(lista(50)),
        'rede fora': Object.assign(async () => { throw new TypeError('Failed to fetch'); }, { chamadas: 0 }),
    };
    for (const [nome, f] of Object.entries(casos)) {
        limparCache();
        const volta = trocarGlobal('fetch', f);
        try {
            await assert.rejects(carregarBiscoito(), undefined, nome);
            await new Promise((r) => setImmediate(r)); // deixa o cache se limpar
            // a proxima chamada refaz a busca (e agora com sucesso)
            volta();
            const g = fetchFalso(lista(MIN_ITENS));
            const volta2 = trocarGlobal('fetch', g);
            const ok = await carregarBiscoito();
            volta2();
            assert.equal(ok.length, MIN_ITENS, nome);
            assert.equal(g.chamadas, 1, nome);
        } finally {
            limparCache();
        }
    }
});

test('limparCache faz a proxima chamada baixar de novo', async () => {
    limparCache();
    const f = fetchFalso(lista(MIN_ITENS));
    const volta = trocarGlobal('fetch', f);
    try {
        await carregarBiscoito();
        limparCache();
        await carregarBiscoito();
        assert.equal(f.chamadas, 2);
    } finally {
        volta();
        limparCache();
    }
});
