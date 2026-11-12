import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
const armazenamento = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
};
globalThis.localStorage = armazenamento;
const D = await import('../../src/utils/biscoitoDia.js');
const { hash } = await import('../../src/utils/cartaDoDia.js');

const lista = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, texto: `Frase número ${i + 1}.`, numeros: [1, 2, 3, 4, 5, 6] }));
const HOJE = '2026-11-11';
const AMANHA = '2026-11-12';

// gerador deterministico (xorshift) para os testes nao dependerem de sorte
function semente(s) {
    let x = s >>> 0 || 1;
    return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
}

function limpar() {
    mem.clear();
    D.reiniciarMemoria();
    globalThis.localStorage = armazenamento;
}
const guardado = () => JSON.parse(mem.get(D.CHAVE_BISCOITO));
const ids = (lugares) => lugares.map((x) => (x ? x.id : null));

/* ---------- janela de ids vistos ---------- */

test('janela: 700 com 1000 frases, e sempre sobram ao menos 100 candidatas (ou metade, em lista pequena)', () => {
    assert.equal(D.janela(1000), 700);
    assert.equal(D.janela(5000), 700);
    assert.equal(D.janela(500), 400);
    assert.equal(D.janela(200), 100);
    assert.equal(D.janela(20), 10);
    assert.equal(D.janela(1), 1);
    for (const n of [2, 3, 10, 99, 100, 150, 1000]) assert.ok(n - D.janela(n) >= Math.min(100, Math.floor(n / 2)), `n=${n}`);
});

/* ---------- abrir por lugar ---------- */

test('abrir um lugar fechado sorteia e guarda no lugar dele; os outros ficam fechados', () => {
    limpar();
    const l = lista(50);
    assert.deepEqual(D.lerHoje(HOJE).lugares, [null, null, null]);
    const r = D.quebrar(l, 1, HOJE, semente(1));
    assert.equal(r.novo, true);
    assert.equal(r.lugar, 1);
    assert.equal(r.persiste, true);
    const { lugares, ordem } = D.lerHoje(HOJE);
    assert.equal(lugares[0], null);
    assert.equal(lugares[2], null);
    assert.deepEqual(lugares[1], r.item);
    assert.deepEqual(ordem, [1]);
    assert.deepEqual(guardado().dias[HOJE].lugares[1], r.item);
});

test('abrir um lugar ja aberto nao sorteia, nao grava e devolve a mesma frase', () => {
    limpar();
    const l = lista(50);
    const a = D.quebrar(l, 0, HOJE, semente(2));
    const antes = mem.get(D.CHAVE_BISCOITO);
    for (let i = 0; i < 20; i++) {
        const b = D.quebrar(l, 0, HOJE, semente(100 + i));
        assert.equal(b.novo, false);
        assert.deepEqual(b.item, a.item);
    }
    assert.equal(mem.get(D.CHAVE_BISCOITO), antes);
    assert.deepEqual(D.lerHoje(HOJE).ordem, [0]);
});

test('os tres lugares dao tres frases distintas, em qualquer ordem de abertura, e a ordem fica guardada', () => {
    limpar();
    const l = lista(50);
    const fonte = semente(1);
    const r2 = D.quebrar(l, 2, HOJE, fonte);
    const r0 = D.quebrar(l, 0, HOJE, fonte);
    const r1 = D.quebrar(l, 1, HOJE, fonte);
    assert.equal(new Set([r0.item.id, r1.item.id, r2.item.id]).size, 3);
    const { lugares, ordem } = D.lerHoje(HOJE);
    assert.deepEqual(ids(lugares), [r0.item.id, r1.item.id, r2.item.id]);
    assert.deepEqual(ordem, [2, 0, 1]);
});

test('lugar invalido ou lista vazia: nada acontece', () => {
    limpar();
    for (const lugar of [-1, 3, 1.5, '1', null, undefined]) assert.equal(D.quebrar(lista(50), lugar, HOJE), null);
    assert.equal(D.quebrar([], 0, HOJE), null);
    assert.deepEqual(D.lerHoje(HOJE).lugares, [null, null, null]);
    assert.equal(mem.size, 0);
});

test('o primeiro aberto no tempo, nao o primeiro da esquerda', () => {
    limpar();
    const l = lista(50);
    assert.equal(D.primeiroDeHoje(HOJE), null);
    assert.equal(D.primeiroLugar(HOJE), -1);
    const b = D.quebrar(l, 2, HOJE).item;
    D.quebrar(l, 0, HOJE);
    assert.deepEqual(D.primeiroDeHoje(HOJE), b);
    assert.equal(D.primeiroLugar(HOJE), 2);
    assert.equal(D.primeiroDeHoje(AMANHA), null);
});

/* ---------- sem repeticao ---------- */

test('sem repetir: com 20 frases e 10 vistas recentes, so sai das outras 10', () => {
    const fonte = semente(7);
    const saiu = new Set();
    for (let i = 0; i < 200; i++) {
        limpar();
        mem.set(D.CHAVE_BISCOITO, JSON.stringify({ v: 1, dias: {}, vistos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }));
        saiu.add(D.quebrar(lista(20), i % 3, HOJE, fonte).item.id);
    }
    assert.ok([...saiu].every((id) => id > 10), `repetiu uma vista: ${[...saiu]}`);
    assert.ok(saiu.size >= 8);
});

test('depois de esgotar a janela volta a sortear sem erro, e vistos nunca passa da janela', () => {
    limpar();
    const l = lista(20);
    const fonte = semente(3);
    for (let d = 0; d < 30; d++) {
        const data = `2026-12-${String(d + 1).padStart(2, '0')}`;
        for (const lugar of [0, 1, 2]) {
            const r = D.quebrar(l, lugar, data, fonte);
            assert.ok(r && r.item.id >= 1 && r.item.id <= 20);
        }
        assert.ok(guardado().vistos.length <= D.janela(20));
    }
});

test('nao repete frase dentro da janela de 700 (1000 frases, 3 por dia, 230 dias)', () => {
    limpar();
    const l = lista(1000);
    const fonte = semente(11);
    const sequencia = [];
    for (let d = 0; d < 230; d++) {
        const data = new Date(2026, 0, 1 + d, 12);
        const txt = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
        for (const lugar of [0, 1, 2]) sequencia.push(D.quebrar(l, lugar, txt, fonte).item.id);
    }
    for (let i = 0; i < sequencia.length; i++) {
        const antes = sequencia.slice(Math.max(0, i - 700), i);
        assert.ok(!antes.includes(sequencia[i]), `repetiu na posicao ${i}`);
    }
    assert.ok(guardado().vistos.length <= 700);
});

/* ---------- virada do dia e dois dias seguidos ---------- */

test('virou o dia: os tres lugares voltam fechados e o dia antigo segue como estava', () => {
    limpar();
    const l = lista(50);
    for (const lugar of [0, 1, 2]) D.quebrar(l, lugar, HOJE);
    assert.ok(D.lerHoje(HOJE).lugares.every(Boolean));
    assert.deepEqual(D.lerHoje(AMANHA).lugares, [null, null, null]);
    assert.ok(D.quebrar(l, 0, AMANHA).novo);
    assert.deepEqual(D.lerHoje(AMANHA).lugares.map(Boolean), [true, false, false]);
    assert.ok(D.lerHoje(HOJE).lugares.every(Boolean));
});

test('dois dias seguidos: seis frases diferentes entre si', () => {
    limpar();
    const l = lista(20);
    const fonte = semente(5);
    const todos = [];
    for (const lugar of [0, 1, 2]) todos.push(D.quebrar(l, lugar, HOJE, fonte).item.id);
    for (const lugar of [0, 1, 2]) todos.push(D.quebrar(l, lugar, AMANHA, fonte).item.id);
    assert.equal(new Set(todos).size, 6);
});

test('poda: ficam so os ultimos 7 dias', () => {
    limpar();
    const l = lista(100);
    for (let d = 1; d <= 12; d++) D.quebrar(l, 0, `2026-11-${String(d).padStart(2, '0')}`);
    assert.deepEqual(Object.keys(guardado().dias).sort(), ['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
});

test('o que e guardado tem so id, texto e numeros, e cabe em poucos KB', () => {
    limpar();
    const l = lista(1000);
    for (let d = 0; d < 10; d++) for (const lugar of [0, 1, 2]) D.quebrar(l, lugar, `2026-11-${String(d + 1).padStart(2, '0')}`);
    const e = guardado();
    assert.equal(e.v, 1);
    for (const dia of Object.values(e.dias)) {
        assert.equal(dia.lugares.length, 3);
        for (const x of dia.lugares) assert.deepEqual(Object.keys(x).sort(), ['id', 'numeros', 'texto']);
    }
    assert.ok(mem.get(D.CHAVE_BISCOITO).length < 8000);
});

test('ler nao grava e o estado e do aparelho (a chave nao leva o id da conta)', () => {
    limpar();
    D.quebrar(lista(50), 0, HOJE);
    const antes = mem.get(D.CHAVE_BISCOITO);
    D.lerHoje(HOJE); D.primeiroDeHoje(HOJE); D.primeiroLugar(HOJE);
    assert.equal(mem.get(D.CHAVE_BISCOITO), antes);
    assert.equal(D.CHAVE_BISCOITO, 'aeon:v2:biscoito');
    assert.deepEqual([...mem.keys()], ['aeon:v2:biscoito']);
});

/* ---------- migracao do estado antigo (lista de itens sem lugar) ---------- */

const bom = (id) => ({ id, texto: `Uma frase boa ${id}.`, numeros: [3, 9, 12, 33, 41, 60] });

test('estado antigo de hoje (itens) vira lugares 0..n-1 na ordem em que estavam', () => {
    limpar();
    mem.set(D.CHAVE_BISCOITO, JSON.stringify({ v: 1, dias: { [HOJE]: { itens: [bom(5), bom(8)] }, '2026-11-10': { itens: [bom(1), bom(2), bom(3)] } }, vistos: [1, 2, 3, 5, 8] }));
    const { lugares, ordem } = D.lerHoje(HOJE);
    assert.deepEqual(ids(lugares), [5, 8, null]);
    assert.deepEqual(ordem, [0, 1]);
    assert.deepEqual(ids(D.lerHoje('2026-11-10').lugares), [1, 2, 3]);
    assert.deepEqual(D.primeiroDeHoje(HOJE), bom(5));
    // a proxima gravacao ja sai no formato novo, sem perder os itens migrados
    const r = D.quebrar(lista(50), 2, HOJE, semente(9));
    assert.equal(r.novo, true);
    const dia = guardado().dias[HOJE];
    assert.equal(dia.itens, undefined);
    assert.deepEqual(ids(dia.lugares).slice(0, 2), [5, 8]);
    assert.deepEqual(dia.ordem, [0, 1, 2]);
    assert.ok(![5, 8].includes(r.item.id)); // nao repete o que ja saiu hoje
});

test('estado antigo com um item invalido no meio: os validos continuam em lugares seguidos', () => {
    limpar();
    mem.set(D.CHAVE_BISCOITO, JSON.stringify({ v: 1, dias: { [HOJE]: { itens: [bom(5), { id: '7', texto: 'x', numeros: [1] }, bom(9)] } }, vistos: [] }));
    assert.deepEqual(ids(D.lerHoje(HOJE).lugares), [5, 9, null]);
});

/* ---------- saneamento do estado ---------- */

test('JSON corrompido ou versao errada: estado vazio, sem quebrar, e a proxima abertura regrava limpo', () => {
    for (const bruto of ['{nao e json', '', 'null', '[]', '42', '{"v":2,"dias":{},"vistos":[]}', '{"dias":{}}']) {
        limpar();
        mem.set(D.CHAVE_BISCOITO, bruto);
        assert.deepEqual(D.lerHoje(HOJE).lugares, [null, null, null], bruto);
        assert.equal(D.primeiroDeHoje(HOJE), null, bruto);
        const r = D.quebrar(lista(50), 1, HOJE);
        assert.ok(r && r.novo, bruto);
        assert.equal(guardado().v, 1);
    }
});

test('item invalido num lugar vira lugar fechado, sem afetar os outros (id como texto, numeros fora da faixa, texto de 500 caracteres)', () => {
    limpar();
    const ruins = [
        { id: '7', texto: 'x', numeros: [1, 2, 3, 4, 5, 6] },
        { id: 7, texto: 'x', numeros: [1, 2, 3, 4, 5] },
        { id: 7, texto: 'x', numeros: [1, 2, 3, 4, 5, 61] },
        { id: 7, texto: 'x', numeros: [6, 5, 4, 3, 2, 1] },
        { id: 7, texto: 'y'.repeat(500), numeros: [1, 2, 3, 4, 5, 6] },
        null, 'texto', 12,
    ];
    for (const ruim of ruins) {
        mem.set(D.CHAVE_BISCOITO, JSON.stringify({ v: 1, dias: { [HOJE]: { lugares: [ruim, bom(5), ruim], ordem: [0, 1, 2] } }, vistos: [] }));
        const { lugares, ordem } = D.lerHoje(HOJE);
        assert.deepEqual(lugares, [null, bom(5), null], JSON.stringify(ruim));
        assert.deepEqual(ordem, [1]);
    }
});

test('dia com data invalida, lugares que nao e lista, dia sem nenhum item e vistos com lixo: ignorados', () => {
    limpar();
    mem.set(D.CHAVE_BISCOITO, JSON.stringify({
        v: 1,
        dias: { ontem: { lugares: [bom(1), null, null] }, [HOJE]: { lugares: 'nada' }, '2026-11-10': { lugares: [bom(2), null, null] }, '2026-11-09': 5, '2026-11-08': { lugares: [null, null, null] } },
        vistos: [1, '2', 3.5, null, 4, -1, 0],
    }));
    assert.deepEqual(D.lerHoje(HOJE).lugares, [null, null, null]);
    assert.deepEqual(D.lerHoje('2026-11-10').lugares, [bom(2), null, null]);
    D.quebrar(lista(50), 0, HOJE);
    const e = guardado();
    assert.deepEqual(Object.keys(e.dias).sort(), ['2026-11-10', HOJE]);
    assert.ok(e.vistos.slice(0, 2).every((x) => x === 1 || x === 4));
});

test('lugares com mais de 3 posicoes: so as 3 primeiras valem; ordem com lixo e refeita', () => {
    limpar();
    mem.set(D.CHAVE_BISCOITO, JSON.stringify({ v: 1, dias: { [HOJE]: { lugares: [bom(1), bom(2), bom(3), bom(4), bom(5)], ordem: [2, 2, 'x', 7, 0] } }, vistos: [] }));
    const { lugares, ordem } = D.lerHoje(HOJE);
    assert.deepEqual(ids(lugares), [1, 2, 3]);
    assert.deepEqual(ordem, [2, 0, 1]); // 2 e 0 como estavam, o que faltava (1) entra no fim
});

/* ---------- sem armazenamento ---------- */

function semArmazenamento() {
    globalThis.localStorage = {
        getItem() { throw new Error('bloqueado'); },
        setItem() { throw new Error('bloqueado'); },
        removeItem() { throw new Error('bloqueado'); },
    };
}

test('sem armazenamento: cada lugar sai da data e do lugar (igual em duas visitas), distintos entre si, sem lancar', () => {
    limpar();
    semArmazenamento();
    const l = lista(1000);
    const visita = () => [0, 1, 2].map((lugar) => D.quebrar(l, lugar, HOJE).item.id);
    const a = visita();
    assert.equal(new Set(a).size, 3);
    assert.deepEqual(a, [0, 1, 2].map((lugar) => l[D.indiceDaData(HOJE, lugar, l.length)].id));
    assert.equal(a[0], l[hash(HOJE) % 1000].id);
    D.reiniciarMemoria(); // simula recarregar a pagina
    assert.deepEqual(visita(), a);
    D.reiniciarMemoria();
    const outro = [0, 1, 2].map((lugar) => D.quebrar(l, lugar, AMANHA).item.id);
    assert.equal(new Set(outro).size, 3);
    assert.notDeepEqual(outro, a);
});

test('sem armazenamento: na mesma visita reabrir um lugar devolve a mesma frase e o que a tela mostra e o que esta em memoria', () => {
    limpar();
    semArmazenamento();
    const l = lista(1000);
    const r = D.quebrar(l, 2, HOJE);
    assert.equal(r.persiste, false);
    assert.equal(D.quebrar(l, 2, HOJE).novo, false);
    assert.deepEqual(D.lerHoje(HOJE).lugares[2], r.item);
    assert.equal(D.lerHoje(HOJE).persiste, false);
    assert.deepEqual(D.lerHoje(HOJE).ordem, [2]);
});

test('quota cheia (leitura funciona, gravacao falha): mesmo caminho, sem excecao', () => {
    limpar();
    globalThis.localStorage = { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); }, removeItem() {} };
    const l = lista(1000);
    const a = D.quebrar(l, 1, HOJE);
    assert.equal(a.persiste, false);
    assert.equal(a.item.id, l[D.indiceDaData(HOJE, 1, 1000)].id);
    assert.ok(D.quebrar(l, 0, HOJE));
    assert.equal(D.lerHoje(HOJE).lugares.filter(Boolean).length, 2);
});

test('quando o armazenamento volta a funcionar, a gravacao recomeca', () => {
    limpar();
    const l = lista(1000);
    globalThis.localStorage = { getItem: () => null, setItem() { throw new Error('cheio'); }, removeItem() {} };
    D.quebrar(l, 0, HOJE);
    globalThis.localStorage = armazenamento;
    D.reiniciarMemoria();
    const r = D.quebrar(l, 0, AMANHA);
    assert.equal(r.persiste, true);
    assert.equal(guardado().dias[AMANHA].lugares[0].id, r.item.id);
});

test('indiceDaData: tres lugares distintos para qualquer data e tamanho de lista a partir de 3', () => {
    for (const n of [3, 4, 100, 999, 1000]) {
        for (let d = 1; d <= 28; d++) {
            const data = `2026-02-${String(d).padStart(2, '0')}`;
            const x = [0, 1, 2].map((lugar) => D.indiceDaData(data, lugar, n));
            assert.equal(new Set(x).size, 3, `${data} n=${n}`);
            assert.ok(x.every((i) => i >= 0 && i < n));
        }
    }
});
