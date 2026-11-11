import { transacao } from './db.js';
import {
    LIMITE_LINHAS_USUARIO, LIMITE_DIARIO, LIMITE_ITEM_BYTES, LIMITE_ITENS_POR_PEDIDO, LIMITE_USUARIO_BYTES, PAGINA_SYNC,
} from './config.js';
import { ErroHttp } from './http.js';

const TIPOS = new Set(['perfil', 'diario', 'mapa']);
const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const FUTURO_TOLERADO_MS = 30 * 1000;

/**
 * Sincronização por itens. O servidor não interpreta o conteúdo: guarda o JSON como texto legível e devolve igual.
 * Quem recebe (o app) valida de novo, como já faz ao importar um backup.
 *
 * Regras:
 * - Vale a mudança mais recente por item (atualizado_em). Empate: fica o que já está no servidor.
 *   No diário, atualizado_em é a data da última edição da nota, então "a nota só é trocada por uma mais nova"
 *   já sai desta mesma regra.
 * - Item apagado vira uma marca (apagado = 1) SEM conteúdo, para a exclusão chegar aos outros aparelhos.
 *   Uma edição mais nova que a marca traz o item de volta.
 * - atualizado_em no futuro (relógio errado) é limitado ao horário do servidor.
 * - `seq` sobe a cada mudança aplicada, por usuário. O aparelho guarda o último que viu.
 */

function validarItem(bruto, posicao, agora) {
    const erro = (motivo) => new ErroHttp(400, 'item_invalido', { posicao, motivo });
    if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) throw erro('não é um objeto');
    const { tipo, id } = bruto;
    if (typeof tipo !== 'string' || !TIPOS.has(tipo)) throw erro('tipo desconhecido');
    if (typeof id !== 'string' || !RE_ID.test(id)) throw erro('id inválido');
    if (tipo === 'perfil' && id !== 'perfil') throw erro('o id do perfil é "perfil"');
    const apagado = bruto.apagado === true;
    if (bruto.apagado !== undefined && typeof bruto.apagado !== 'boolean') throw erro('apagado precisa ser verdadeiro ou falso');
    if (typeof bruto.atualizado_em !== 'string' || bruto.atualizado_em.length > 40) throw erro('atualizado_em inválido');
    let ms = Date.parse(bruto.atualizado_em);
    if (!Number.isFinite(ms)) throw erro('atualizado_em inválido');
    const ano = new Date(ms).getUTCFullYear();
    if (ano < 2000 || ano > 2100) throw erro('atualizado_em fora do intervalo');
    if (ms > agora + FUTURO_TOLERADO_MS) ms = agora;
    let dados = '';
    if (!apagado) {
        const d = bruto.dados;
        if (!d || typeof d !== 'object' || Array.isArray(d)) throw erro('dados precisa ser um objeto');
        dados = JSON.stringify(d);
        if (Buffer.byteLength(dados) > LIMITE_ITEM_BYTES) throw new ErroHttp(413, 'item_grande_demais', { posicao });
    }
    return { tipo, id, apagado, dados, atualizado_em: new Date(ms).toISOString() };
}

const paraSaida = (r) => ({
    tipo: r.tipo,
    id: r.id,
    dados: r.apagado ? null : JSON.parse(r.dados),
    atualizado_em: r.atualizado_em,
    apagado: !!r.apagado,
    seq: r.seq,
});

export function criarSync({ db, relogio }) {
    const seqDe = (uid) => db.prepare('SELECT seq FROM usuarios WHERE id = ?').get(uid).seq;

    function pagina(uid, desde, excluir) {
        const linhas = db
            .prepare('SELECT * FROM itens WHERE usuario_id = ? AND seq > ? ORDER BY seq LIMIT ?')
            .all(uid, desde, PAGINA_SYNC + 1);
        const mais = linhas.length > PAGINA_SYNC;
        const dentro = mais ? linhas.slice(0, PAGINA_SYNC) : linhas;
        const proximo = dentro.length ? dentro[dentro.length - 1].seq : seqDe(uid);
        const itens = dentro.filter((r) => !excluir || r.seq < excluir.de || r.seq > excluir.ate);
        return { itens, mais, proximo };
    }

    function normalizarDesde(uid, valor) {
        const n = Number(valor ?? 0);
        if (!Number.isInteger(n) || n < 0) throw new ErroHttp(400, 'desde_invalido');
        // Cursor maior que o do servidor: a conta foi apagada e refeita. Recomeça do zero e avisa.
        if (n > seqDe(uid)) return { desde: 0, reinicio: true };
        return { desde: n, reinicio: false };
    }

    return {
        ler(uid, desdeBruto) {
            const { desde, reinicio } = normalizarDesde(uid, desdeBruto);
            const p = pagina(uid, desde, null);
            return { seq: seqDe(uid), proximo: p.proximo, mais: p.mais, reinicio, itens: p.itens.map(paraSaida) };
        },

        enviar(uid, desdeBruto, itensBrutos) {
            if (!Array.isArray(itensBrutos)) throw new ErroHttp(400, 'itens_invalidos');
            if (itensBrutos.length > LIMITE_ITENS_POR_PEDIDO) throw new ErroHttp(413, 'itens_demais');
            const agora = relogio();
            const itens = itensBrutos.map((b, i) => validarItem(b, i, agora));
            const { desde, reinicio } = normalizarDesde(uid, desdeBruto);

            const r = transacao(db, () => {
                let seq = seqDe(uid);
                const inicio = seq + 1;
                const ignorados = [];
                const buscar = db.prepare('SELECT atualizado_em FROM itens WHERE usuario_id = ? AND tipo = ? AND id = ?');
                const gravar = db.prepare(
                    `INSERT INTO itens (usuario_id, tipo, id, dados, atualizado_em, seq, apagado) VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(usuario_id, tipo, id) DO UPDATE SET dados = excluded.dados,
                     atualizado_em = excluded.atualizado_em, seq = excluded.seq, apagado = excluded.apagado`,
                );
                for (const it of itens) {
                    const atual = buscar.get(uid, it.tipo, it.id);
                    if (atual && it.atualizado_em <= atual.atualizado_em) {
                        ignorados.push(it);
                        continue;
                    }
                    seq += 1;
                    gravar.run(uid, it.tipo, it.id, it.dados, it.atualizado_em, seq, it.apagado ? 1 : 0);
                }
                if (seq >= inicio) {
                    const diario = db.prepare("SELECT COUNT(*) AS n FROM itens WHERE usuario_id = ? AND tipo = 'diario' AND apagado = 0").get(uid).n;
                    if (diario > LIMITE_DIARIO) throw new ErroHttp(413, 'limite_do_diario', { limite: LIMITE_DIARIO });
                    // conta também marcas de exclusão e itens vazios: cada linha pesa o id e um custo fixo
                    const linhas = db.prepare('SELECT COUNT(*) AS n FROM itens WHERE usuario_id = ?').get(uid).n;
                    if (linhas > LIMITE_LINHAS_USUARIO) throw new ErroHttp(413, 'limite_de_itens', { limite: LIMITE_LINHAS_USUARIO });
                    const bytes = db.prepare('SELECT COALESCE(SUM(LENGTH(CAST(dados AS BLOB)) + LENGTH(id) + 64), 0) AS b FROM itens WHERE usuario_id = ?').get(uid).b;
                    if (bytes > LIMITE_USUARIO_BYTES) throw new ErroHttp(413, 'limite_de_espaco', { limite_bytes: LIMITE_USUARIO_BYTES });
                    db.prepare('UPDATE usuarios SET seq = ? WHERE id = ?').run(seq, uid);
                }
                return { inicio, fim: seq, ignorados };
            });

            // O que este aparelho acabou de mandar não volta para ele, mas o que o servidor mantém no lugar do que
            // foi ignorado volta, mesmo que seja antigo (senão o aparelho ficaria com uma versão que perdeu).
            const excluir = r.fim >= r.inicio ? { de: r.inicio, ate: r.fim } : null;
            const p = pagina(uid, desde, excluir);
            const porChave = new Map(p.itens.map((x) => [`${x.tipo}/${x.id}`, x]));
            const buscarUm = db.prepare('SELECT * FROM itens WHERE usuario_id = ? AND tipo = ? AND id = ?');
            for (const ig of r.ignorados) {
                const linha = buscarUm.get(uid, ig.tipo, ig.id);
                if (linha) porChave.set(`${ig.tipo}/${ig.id}`, linha);
            }
            const saida = [...porChave.values()].sort((a, b) => a.seq - b.seq).map(paraSaida);
            return {
                seq: seqDe(uid),
                proximo: p.proximo,
                mais: p.mais,
                reinicio,
                aplicados: r.fim >= r.inicio ? r.fim - r.inicio + 1 : 0,
                itens: saida,
            };
        },

        /** Tudo o que o usuário tem, para o download (itens apagados não entram). */
        exportar(uid) {
            return db
                .prepare('SELECT * FROM itens WHERE usuario_id = ? AND apagado = 0 ORDER BY tipo, atualizado_em')
                .all(uid)
                .map(paraSaida);
        },

        /** Apaga a conta e tudo o que depende dela (sessões e itens saem em cascata). */
        apagarConta(uid) {
            transacao(db, () => {
                const u = db.prepare('SELECT email FROM usuarios WHERE id = ?').get(uid);
                if (u) db.prepare('DELETE FROM codigos WHERE email = ?').run(u.email);
                db.prepare('DELETE FROM usuarios WHERE id = ?').run(uid);
            });
        },
    };
}
