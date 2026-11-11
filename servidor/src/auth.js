import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { transacao } from './db.js';
import {
    CODIGO_BLOQUEIO_MS, CODIGO_REENVIO_MS, CODIGO_TENTATIVAS, CODIGO_VALE_MS, EXPURGO_ANONIMA_VAZIA_MS, EXPURGO_MARCAS_MS, MAX_CONTAS_POR_SESSAO,
    MAX_SESSOES_POR_USUARIO, SESSAO_MS, SESSAO_RENOVA_APOS_MS,
} from './config.js';
import { ErroHttp } from './http.js';
import { PALAVRAS } from './palavras.js';

// Conservador de propósito: só ASCII comum, sem aspas, vírgula, parênteses nem comentários. Endereços com
// caracteres fora disso são recusados em vez de arriscar uma interpretação diferente no envio.
const RE_EMAIL = /^[a-z0-9._%+'-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const RE_CODIGO = /^\d{6}$/;
const MODOS = new Set(['adicionar', 'unir', 'descartar']);
const NUM_PALAVRAS = 12;
const semAcento = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const INDICE = new Map(PALAVRAS.map((p, i) => [p, i]));

/** Texto digitado -> as 12 palavras da lista, na forma canonica (minusculas, sem acento), ou null. */
export function normalizarChave(valor) {
    if (typeof valor !== 'string' || valor.length > 400) return null;
    const palavras = semAcento(valor.toLowerCase()).split(/[^a-z]+/).filter(Boolean);
    if (palavras.length !== NUM_PALAVRAS) return null;
    return palavras.every((p) => INDICE.has(p)) ? palavras.join(' ') : null;
}

export function normalizarEmail(valor) {
    if (typeof valor !== 'string') return null;
    const e = valor.trim().toLowerCase();
    return e.length <= 254 && RE_EMAIL.test(e) ? e : null;
}

const sha256 = (t) => createHash('sha256').update(t).digest('hex');
const iso = (ms) => new Date(ms).toISOString();

function aparelhoLimpo(valor) {
    if (typeof valor !== 'string') return 'Aparelho';
    const t = valor.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    return t || 'Aparelho';
}

export function criarAuth({ db, config, relogio, fundir }) {
    const hmac = (texto) => createHmac('sha256', config.segredo).update(texto).digest('hex');
    // O código nunca é guardado: sai da semente (aleatória, no banco) e do SEGREDO (fora do banco).
    const codigoDe = (email, semente) =>
        String(parseInt(hmac(`codigo:${email}:${semente}`).slice(0, 8), 16) % 1_000_000).padStart(6, '0');
    const iguais = (a, b) => {
        const x = Buffer.from(a);
        const y = Buffer.from(b);
        return x.length === y.length && timingSafeEqual(x, y);
    };

    const resumo = (c) => ({ id: c.id, email: c.email, anonimo: c.email === null, tem_chave: !!c.tem_chave });
    const contasDaSessao = (sessaoId) =>
        db.prepare(
            `SELECT u.id, u.email, u.criado_em, (u.chave_hash IS NOT NULL) AS tem_chave FROM sessao_contas sc JOIN usuarios u ON u.id = sc.usuario_id
             WHERE sc.sessao_id = ? ORDER BY sc.rowid`,
        ).all(sessaoId);
    const sessaoPorToken = (token) => {
        if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
        const s = db.prepare('SELECT id, ultimo_uso FROM sessoes WHERE token_hash = ?').get(sha256(token));
        return s && relogio() - Date.parse(s.ultimo_uso) <= SESSAO_MS ? s : null;
    };
    const novaSessao = (aparelho, agoraIso) => {
        const token = randomBytes(32).toString('base64url');
        const id = randomBytes(8).toString('hex');
        db.prepare('INSERT INTO sessoes (id, token_hash, aparelho, criada_em, ultimo_uso) VALUES (?, ?, ?, ?, ?)').run(
            id, sha256(token), aparelhoLimpo(aparelho), agoraIso, agoraIso,
        );
        return { id, token };
    };
    const chaveHash = (canonica) => hmac(`chave:${canonica}`);
    /** Sorteia 12 palavras, grava so o hash na conta (a chave anterior deixa de valer) e devolve a frase. */
    function gravarChave(uid) {
        for (;;) {
            const frase = Array.from({ length: NUM_PALAVRAS }, () => PALAVRAS[randomInt(PALAVRAS.length)]).join(' ');
            try {
                db.prepare('UPDATE usuarios SET chave_hash = ? WHERE id = ?').run(chaveHash(frase), uid);
                return frase;
            } catch (e) {
                if (!/UNIQUE/.test(String(e && e.message))) throw e; // colisao de 132 bits: nao acontece, mas sorteia de novo
            }
        }
    }
    const novoAnonimo = (agoraIso) => {
        const uid = Number(db.prepare('INSERT INTO usuarios (email, criado_em, ultimo_acesso) VALUES (NULL, ?, ?)').run(agoraIso, agoraIso).lastInsertRowid);
        return { uid, chave: gravarChave(uid) };
    };
    /**
     * A conta `existente` entra neste aparelho (e-mail ja cadastrado ou chave certa). Regras: ja estava na sessao -> nada;
     * conta ativa anonima com dados e sem modo -> { conflito }; modos adicionar, unir e descartar; conta ativa vazia troca em silencio.
     */
    function aderir({ sess, contas, ativa, existente, modo, aparelho, agoraIso }) {
        const pronto = (token, sessaoId, acao) => ({
            token, acao, usuario: { id: existente.id, email: existente.email, criado_em: existente.criado_em },
            contas: contasDaSessao(sessaoId).map(resumo),
        });
        if (sess && contas.some((c) => c.id === existente.id)) return { ...pronto(null, sess.id, 'ja_estava'), consome: true };
        if (sess && ativa && ativa.email === null) {
            let m = modo || null;
            if (!m) {
                const vivos = db.prepare('SELECT COUNT(*) AS n FROM itens WHERE usuario_id = ? AND apagado = 0').get(ativa.id).n;
                if (vivos === 0) m = 'descartar'; // nada a perder: troca em silencio
            }
            if (!m) return { conflito: true };
            ligar(sess.id, existente.id, agoraIso);
            if (m === 'unir') fundir(ativa.id, existente.id);
            if (m === 'unir' || m === 'descartar') db.prepare('DELETE FROM usuarios WHERE id = ?').run(ativa.id);
            db.prepare('UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?').run(agoraIso, existente.id);
            return { ...pronto(null, sess.id, m), consome: true };
        }
        db.prepare('UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?').run(agoraIso, existente.id);
        if (sess) {
            ligar(sess.id, existente.id, agoraIso);
            return { ...pronto(null, sess.id, 'adicionou'), consome: true };
        }
        const nova = novaSessao(aparelho, agoraIso);
        ligar(nova.id, existente.id, agoraIso);
        return { ...pronto(nova.token, nova.id, 'entrou'), consome: true };
    }
    /** Liga a conta à sessão, respeitando os tetos: contas por aparelho e aparelhos por conta (a ligação mais antiga em uso sai). */
    function ligar(sessaoId, uid, agoraIso) {
        const ja = db.prepare('SELECT 1 FROM sessao_contas WHERE sessao_id = ? AND usuario_id = ?').get(sessaoId, uid);
        if (ja) return;
        const n = db.prepare('SELECT COUNT(*) AS n FROM sessao_contas WHERE sessao_id = ?').get(sessaoId).n;
        if (n >= MAX_CONTAS_POR_SESSAO) throw new ErroHttp(409, 'muitas_contas', { limite: MAX_CONTAS_POR_SESSAO });
        db.prepare('INSERT INTO sessao_contas (sessao_id, usuario_id, vinculada_em) VALUES (?, ?, ?)').run(sessaoId, uid, agoraIso);
        db.prepare(
            `DELETE FROM sessao_contas WHERE usuario_id = ? AND sessao_id NOT IN (
                 SELECT sc.sessao_id FROM sessao_contas sc JOIN sessoes s ON s.id = sc.sessao_id
                 WHERE sc.usuario_id = ? ORDER BY s.ultimo_uso DESC, s.criada_em DESC LIMIT ?)`,
        ).run(uid, uid, MAX_SESSOES_POR_USUARIO);
        db.prepare('DELETE FROM sessoes WHERE id NOT IN (SELECT sessao_id FROM sessao_contas)').run();
    }
    /** Sessões sem nenhuma conta saem; conta anônima sem nenhuma sessão ligada está órfã (ninguém chega nela) e sai com os itens. */
    function aposDesligar() {
        db.prepare('DELETE FROM sessoes WHERE id NOT IN (SELECT sessao_id FROM sessao_contas)').run();
        db.prepare('DELETE FROM usuarios WHERE email IS NULL AND id NOT IN (SELECT usuario_id FROM sessao_contas)').run();
    }

    return {
        /**
         * Código para o e-mail. Dentro da validade, reenvia o MESMO código (as tentativas não voltam a zero).
         * Lança 429 se o último envio foi há menos de 30 s, ou se o e-mail está bloqueado (5 erros seguidos).
         * Existir conta ou não não muda nada aqui: a resposta é a mesma.
         */
        novoCodigo(email) {
            const agora = relogio();
            const bloqueio = db.prepare('SELECT ate FROM bloqueios WHERE email = ?').get(email);
            if (bloqueio && agora < bloqueio.ate) throw new ErroHttp(429, 'aguarde', { espera_s: Math.ceil((bloqueio.ate - agora) / 1000) });
            const atual = db.prepare('SELECT semente, enviado_em, expira_em, tentativas FROM codigos WHERE email = ?').get(email);
            if (atual && agora - atual.enviado_em < CODIGO_REENVIO_MS) {
                throw new ErroHttp(429, 'aguarde', { espera_s: Math.ceil((CODIGO_REENVIO_MS - (agora - atual.enviado_em)) / 1000) });
            }
            if (atual && agora <= atual.expira_em && atual.tentativas < CODIGO_TENTATIVAS) {
                db.prepare('UPDATE codigos SET enviado_em = ? WHERE email = ?').run(agora, email);
                return codigoDe(email, atual.semente);
            }
            const semente = randomBytes(16).toString('hex');
            db.prepare(
                `INSERT INTO codigos (email, semente, criado_em, enviado_em, expira_em, tentativas) VALUES (?, ?, ?, ?, ?, 0)
                 ON CONFLICT(email) DO UPDATE SET semente = excluded.semente, criado_em = excluded.criado_em,
                 enviado_em = excluded.enviado_em, expira_em = excluded.expira_em, tentativas = 0`,
            ).run(email, semente, agora, agora, agora + CODIGO_VALE_MS);
            return codigoDe(email, semente);
        },

        /**
         * Confere o código. Todo erro é o mesmo "codigo_invalido": não diz se o e-mail existe nem o que falhou.
         *
         * Com sessão de aparelho (tokenAtual) a conta do e-mail é LIGADA à sessão, sem apagar nada:
         * - conta ativa anônima e e-mail novo: o e-mail passa a ser dela ("vinculou");
         * - conta ativa anônima e e-mail que já tem conta: precisa de `modo` (adicionar, unir ou descartar). Sem modo,
         *   e se a conta ativa não está vazia, devolve { conflito: true } SEM gastar o código, para o app perguntar;
         * - qualquer outro caso: a conta do e-mail é ligada à sessão ("adicionou").
         * Sem sessão, cria uma sessão nova com a conta.
         */
        confirmar(email, codigo, aparelho, tokenAtual, contaAtivaId, modo) {
            const falha = () => new ErroHttp(400, 'codigo_invalido');
            if (typeof codigo !== 'string' || !RE_CODIGO.test(codigo)) throw falha();
            if (modo !== undefined && modo !== null && !MODOS.has(modo)) throw new ErroHttp(400, 'modo_invalido');
            const agora = relogio();
            const agoraIso = iso(agora);
            // Dentro da transação só se lança o que deve desfazer tudo; a tentativa errada precisa ficar gravada.
            const r = transacao(db, () => {
                const bloqueio = db.prepare('SELECT ate FROM bloqueios WHERE email = ?').get(email);
                if (bloqueio && agora < bloqueio.ate) return null;
                const linha = db.prepare('SELECT semente, expira_em, tentativas FROM codigos WHERE email = ?').get(email);
                if (!linha) return null;
                if (agora > linha.expira_em || linha.tentativas >= CODIGO_TENTATIVAS) {
                    db.prepare('DELETE FROM codigos WHERE email = ?').run(email);
                    return null;
                }
                if (!iguais(codigo, codigoDe(email, linha.semente))) {
                    const n = linha.tentativas + 1;
                    if (n >= CODIGO_TENTATIVAS) {
                        db.prepare('DELETE FROM codigos WHERE email = ?').run(email);
                        db.prepare('INSERT OR REPLACE INTO bloqueios (email, ate) VALUES (?, ?)').run(email, agora + CODIGO_BLOQUEIO_MS);
                    } else db.prepare('UPDATE codigos SET tentativas = ? WHERE email = ?').run(n, email);
                    return null;
                }
                const sess = sessaoPorToken(tokenAtual);
                const contas = sess ? contasDaSessao(sess.id) : [];
                const ativa = contas.find((c) => String(c.id) === String(contaAtivaId)) || contas[0] || null;
                const existente = db.prepare('SELECT id, email, criado_em FROM usuarios WHERE email = ?').get(email);
                if (existente) {
                    const r2 = aderir({ sess, contas, ativa, existente, modo, aparelho, agoraIso });
                    if (!r2.conflito) db.prepare('DELETE FROM codigos WHERE email = ?').run(email); // em conflito o codigo continua valendo
                    return r2;
                }
                db.prepare('DELETE FROM codigos WHERE email = ?').run(email);
                const pronto = (usuario, token, sessaoId, acao) => ({
                    token, acao, usuario: { id: usuario.id, email: usuario.email, criado_em: usuario.criado_em },
                    contas: contasDaSessao(sessaoId).map(resumo),
                });
                if (sess && ativa && ativa.email === null) {
                    db.prepare('UPDATE usuarios SET email = ?, ultimo_acesso = ? WHERE id = ?').run(email, agoraIso, ativa.id);
                    return pronto({ ...ativa, email }, null, sess.id, 'vinculou');
                }
                const novo = Number(db.prepare('INSERT INTO usuarios (email, criado_em, ultimo_acesso) VALUES (?, ?, ?)').run(email, agoraIso, agoraIso).lastInsertRowid);
                const usuario = db.prepare('SELECT id, email, criado_em FROM usuarios WHERE id = ?').get(novo);
                if (sess) {
                    ligar(sess.id, usuario.id, agoraIso);
                    return pronto(usuario, null, sess.id, 'adicionou');
                }
                const nova = novaSessao(aparelho, agoraIso);
                ligar(nova.id, usuario.id, agoraIso);
                return pronto(usuario, nova.token, nova.id, 'entrou');
            });
            if (!r) throw falha();
            if (r.conflito) throw new ErroHttp(409, 'conta_existente');
            return r;
        },

        /** Conta anônima com sessão nova (aparelho que ainda não tem cookie). -> { token, usuario, contas } */
        criarAnonimo(aparelho) {
            const agoraIso = iso(relogio());
            return transacao(db, () => {
                const nova = novaSessao(aparelho, agoraIso);
                const { uid, chave } = novoAnonimo(agoraIso);
                ligar(nova.id, uid, agoraIso);
                return { token: nova.token, usuario: { id: uid, email: null, criado_em: agoraIso }, chave, contas: contasDaSessao(nova.id).map(resumo) };
            });
        },

        /** Outra conta anônima na sessão do aparelho. -> { usuario, contas } */
        adicionarAnonima(sessaoId) {
            const agoraIso = iso(relogio());
            return transacao(db, () => {
                const { uid, chave } = novoAnonimo(agoraIso);
                ligar(sessaoId, uid, agoraIso);
                return { usuario: { id: uid, email: null, criado_em: agoraIso }, chave, contas: contasDaSessao(sessaoId).map(resumo) };
            });
        },

        /**
         * Entra com a chave de 12 palavras: mesma regra do e-mail (ja estava, conflito, adicionar, unir, descartar).
         * Chave errada, malformada ou de conta inexistente: o mesmo "chave_invalida".
         */
        entrarComChave(frase, aparelho, tokenAtual, contaAtivaId, modo) {
            const canonica = normalizarChave(frase);
            if (!canonica) throw new ErroHttp(400, 'chave_invalida');
            if (modo !== undefined && modo !== null && !MODOS.has(modo)) throw new ErroHttp(400, 'modo_invalido');
            const agoraIso = iso(relogio());
            const r = transacao(db, () => {
                const existente = db.prepare('SELECT id, email, criado_em FROM usuarios WHERE chave_hash = ?').get(chaveHash(canonica));
                if (!existente) return null;
                const sess = sessaoPorToken(tokenAtual);
                const contas = sess ? contasDaSessao(sess.id) : [];
                const ativa = contas.find((c) => String(c.id) === String(contaAtivaId)) || contas[0] || null;
                return aderir({ sess, contas, ativa, existente, modo, aparelho, agoraIso });
            });
            if (!r) throw new ErroHttp(400, 'chave_invalida');
            if (r.conflito) throw new ErroHttp(409, 'conta_existente');
            return r;
        },

        /** Gera uma chave nova para a conta (a anterior deixa de valer). A frase só existe nesta resposta. */
        novaChave(uid) {
            return transacao(db, () => gravarChave(uid));
        },

        /** Contas ligadas à sessão. */
        contas(sessaoId) {
            return contasDaSessao(sessaoId).map(resumo);
        },

        /**
         * Tira a conta do aparelho (a sessão perde o vínculo). Conta com e-mail continua existindo e dá para entrar de
         * novo; conta anônima sem outra sessão é apagada com os itens. -> { contas, sessaoFechada } ou null se não era da sessão
         */
        desvincular(sessaoId, uid) {
            return transacao(db, () => {
                const r = db.prepare('DELETE FROM sessao_contas WHERE sessao_id = ? AND usuario_id = ?').run(sessaoId, uid);
                if (!r.changes) return null;
                aposDesligar();
                const aberta = db.prepare('SELECT 1 FROM sessoes WHERE id = ?').get(sessaoId);
                return { contas: aberta ? contasDaSessao(sessaoId).map(resumo) : [], sessaoFechada: !aberta };
            });
        },

        /**
         * Sessão do cookie, ou null. Renova o prazo (no máximo 1 vez por hora). `contaId` (cabeçalho X-Aeon-Conta) escolhe
         * a conta em uso; tem de ser uma das ligadas à sessão (senão 403). Sem ele vale a primeira.
         * -> { usuario, contas, sessaoId, renovou }
         */
        sessaoDoToken(token, contaId) {
            if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
            const agora = relogio();
            const s = db.prepare('SELECT id, ultimo_uso FROM sessoes WHERE token_hash = ?').get(sha256(token));
            if (!s) return null;
            if (agora - Date.parse(s.ultimo_uso) > SESSAO_MS) {
                db.prepare('DELETE FROM sessoes WHERE id = ?').run(s.id);
                aposDesligar();
                return null;
            }
            const contas = contasDaSessao(s.id);
            if (!contas.length) {
                db.prepare('DELETE FROM sessoes WHERE id = ?').run(s.id);
                return null;
            }
            let u = contas[0];
            if (contaId !== undefined && contaId !== null && contaId !== '') {
                u = contas.find((c) => String(c.id) === String(contaId));
                if (!u) throw new ErroHttp(403, 'conta_invalida');
            }
            let renovou = false;
            if (agora - Date.parse(s.ultimo_uso) > SESSAO_RENOVA_APOS_MS) {
                const agoraIso = iso(agora);
                db.prepare('UPDATE sessoes SET ultimo_uso = ? WHERE id = ?').run(agoraIso, s.id);
                db.prepare('UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?').run(agoraIso, u.id);
                renovou = true;
            }
            return { usuario: { id: u.id, email: u.email, criado_em: u.criado_em }, contas: contas.map(resumo), sessaoId: s.id, renovou };
        },

        /** Encerra a sessão inteira do aparelho (todas as contas dele saem). */
        sair(sessaoId) {
            db.prepare('DELETE FROM sessoes WHERE id = ?').run(sessaoId);
            aposDesligar();
        },
        /** Esquece a conta em todos os aparelhos (as outras contas desses aparelhos ficam). */
        sairTodos(usuarioId) {
            db.prepare('DELETE FROM sessao_contas WHERE usuario_id = ?').run(usuarioId);
            aposDesligar();
        },
        aparelhos(usuarioId, sessaoAtual) {
            return db
                .prepare(
                    `SELECT s.id, s.aparelho, s.criada_em, s.ultimo_uso FROM sessoes s
                     JOIN sessao_contas sc ON sc.sessao_id = s.id WHERE sc.usuario_id = ? ORDER BY s.ultimo_uso DESC`,
                )
                .all(usuarioId)
                .map((r) => ({ id: r.id, aparelho: r.aparelho, criada_em: r.criada_em, ultimo_uso: r.ultimo_uso, atual: r.id === sessaoAtual }));
        },
        /** Tira a conta de um aparelho dela. -> true se existia */
        encerrarAparelho(usuarioId, id) {
            const ok = db.prepare('DELETE FROM sessao_contas WHERE sessao_id = ? AND usuario_id = ?').run(id, usuarioId).changes > 0;
            if (ok) aposDesligar();
            return ok;
        },
        /** Depois de apagar uma conta: sessões vazias e contas anônimas órfãs saem. */
        varrer() {
            aposDesligar();
        },
        sessaoAberta(sessaoId) {
            return !!db.prepare('SELECT 1 FROM sessoes WHERE id = ?').get(sessaoId);
        },

        /** Limpeza periódica: códigos vencidos, sessões sem uso há mais de um ano e contas anônimas órfãs. */
        limpar() {
            const agora = relogio();
            db.prepare('DELETE FROM codigos WHERE expira_em < ?').run(agora);
            db.prepare('DELETE FROM bloqueios WHERE ate < ?').run(agora);
            // marcas de exclusão (sem conteúdo) com mais de 1 ano: um aparelho parado por tanto tempo já perdeu a sessão
            db.prepare('DELETE FROM itens WHERE apagado = 1 AND atualizado_em < ?').run(iso(agora - EXPURGO_MARCAS_MS));
            db.prepare('DELETE FROM sessoes WHERE ultimo_uso < ?').run(iso(agora - SESSAO_MS));
            // conta anonima que nunca guardou nada e nao e usada ha 7 dias: sai (nao ha dado a perder)
            db.prepare(
                `DELETE FROM usuarios WHERE email IS NULL AND ultimo_acesso < ?
                 AND NOT EXISTS (SELECT 1 FROM itens WHERE itens.usuario_id = usuarios.id)`,
            ).run(iso(agora - EXPURGO_ANONIMA_VAZIA_MS));
            aposDesligar();
        },
    };
}
