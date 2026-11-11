import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Banco: um arquivo SQLite. Os dados dos usuários ficam em texto legível (JSON), por decisão do produto:
 * o painel de administração da etapa 3 lê direto daqui.
 *
 * Migrações por PRAGMA user_version: cada função roda uma vez, em ordem, dentro de uma transação.
 */
const MIGRACOES = [
    (db) =>
        db.exec(`
        CREATE TABLE usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            criado_em TEXT NOT NULL,
            ultimo_acesso TEXT NOT NULL,
            seq INTEGER NOT NULL DEFAULT 0
        );
        -- O código não é guardado: sai de HMAC(SEGREDO, e-mail + semente). Pedir de novo dentro da validade reenvia
        -- o mesmo código e NÃO zera as tentativas (senão cada pedido daria mais 5 palpites).
        CREATE TABLE codigos (
            email TEXT PRIMARY KEY,
            semente TEXT NOT NULL,
            criado_em INTEGER NOT NULL,
            enviado_em INTEGER NOT NULL,
            expira_em INTEGER NOT NULL,
            tentativas INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE bloqueios (
            email TEXT PRIMARY KEY,
            ate INTEGER NOT NULL
        );
        CREATE TABLE sessoes (
            id TEXT PRIMARY KEY,
            token_hash TEXT NOT NULL UNIQUE,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            aparelho TEXT NOT NULL,
            criada_em TEXT NOT NULL,
            ultimo_uso TEXT NOT NULL
        );
        CREATE INDEX sessoes_usuario ON sessoes(usuario_id);
        CREATE TABLE itens (
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            tipo TEXT NOT NULL CHECK (tipo IN ('perfil', 'diario', 'mapa')),
            id TEXT NOT NULL,
            dados TEXT NOT NULL,
            atualizado_em TEXT NOT NULL,
            seq INTEGER NOT NULL,
            apagado INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (usuario_id, tipo, id)
        );
        CREATE INDEX itens_seq ON itens(usuario_id, seq);
    `),
    // 2: contas anonimas. O e-mail passa a poder ser nulo (a conta nasce sem e-mail; o login so o associa depois).
    // O SQLite nao troca NOT NULL no lugar: recria a tabela (com as chaves estrangeiras desligadas, como ele manda).
    (db) =>
        db.exec(`
        CREATE TABLE usuarios_novo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            criado_em TEXT NOT NULL,
            ultimo_acesso TEXT NOT NULL,
            seq INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO usuarios_novo (id, email, criado_em, ultimo_acesso, seq) SELECT id, email, criado_em, ultimo_acesso, seq FROM usuarios;
        DROP TABLE usuarios;
        ALTER TABLE usuarios_novo RENAME TO usuarios;
    `),
    // 3: varias contas por aparelho. A sessao (um cookie por aparelho) deixa de ter uma conta so e passa a ligar-se a varias,
    // pela tabela sessao_contas. Recria sessoes sem usuario_id, com as ligacoes atuais copiadas antes.
    (db) =>
        db.exec(`
        CREATE TABLE sessoes_nova (
            id TEXT PRIMARY KEY,
            token_hash TEXT NOT NULL UNIQUE,
            aparelho TEXT NOT NULL,
            criada_em TEXT NOT NULL,
            ultimo_uso TEXT NOT NULL
        );
        INSERT INTO sessoes_nova (id, token_hash, aparelho, criada_em, ultimo_uso) SELECT id, token_hash, aparelho, criada_em, ultimo_uso FROM sessoes;
        CREATE TABLE sessao_contas (
            sessao_id TEXT NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            vinculada_em TEXT NOT NULL,
            PRIMARY KEY (sessao_id, usuario_id)
        );
        INSERT INTO sessao_contas (sessao_id, usuario_id, vinculada_em) SELECT id, usuario_id, criada_em FROM sessoes;
        CREATE INDEX sessao_contas_usuario ON sessao_contas (usuario_id);
        DROP TABLE sessoes;
        ALTER TABLE sessoes_nova RENAME TO sessoes;
    `),
    // 4: chave de recuperacao (12 palavras). So o hash fica no banco; a chave aparece uma vez para a pessoa.
    (db) =>
        db.exec(`
        ALTER TABLE usuarios ADD COLUMN chave_hash TEXT;
        CREATE UNIQUE INDEX usuarios_chave ON usuarios (chave_hash) WHERE chave_hash IS NOT NULL;
    `),
    // 5: encerrar conta. A conta sai de circulacao (sem sessao, sem e-mail e sem chave, que ficam livres para uma conta nova).
    (db) =>
        db.exec(`
        ALTER TABLE usuarios ADD COLUMN desativada_em TEXT;
        ALTER TABLE usuarios ADD COLUMN email_anterior TEXT;
    `),
];

export function abrirBanco(caminho, { ateVersao = MIGRACOES.length } = {}) {
    if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
    const db = new DatabaseSync(caminho);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec('PRAGMA synchronous = NORMAL');
    const versao = db.prepare('PRAGMA user_version').get().user_version;
    for (let v = versao; v < ateVersao; v++) {
        // PRAGMA foreign_keys nao muda dentro de transacao: desliga antes, confere depois e religa.
        db.exec('PRAGMA foreign_keys = OFF');
        db.exec('BEGIN');
        try {
            MIGRACOES[v](db);
            db.exec(`PRAGMA user_version = ${v + 1}`);
            const quebradas = db.prepare('PRAGMA foreign_key_check').all();
            if (quebradas.length) throw new Error(`migracao ${v + 1} deixou chaves estrangeiras quebradas`);
            db.exec('COMMIT');
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        } finally {
            db.exec('PRAGMA foreign_keys = ON');
        }
    }
    return db;
}

/** Executa fn dentro de uma transação que já pega o bloqueio de escrita. Desfaz tudo se fn lançar. */
export function transacao(db, fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
        const r = fn();
        db.exec('COMMIT');
        return r;
    } catch (e) {
        db.exec('ROLLBACK');
        throw e;
    }
}
