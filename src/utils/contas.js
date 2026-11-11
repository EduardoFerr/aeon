/**
 * Contas no aparelho.
 *
 * O aparelho pode ter varias contas (cada uma com perfil, mapas, diario, rascunhos e estado de sincronizacao proprios) e
 * uma delas esta ativa. O registro fica em "aeon:v2:contas" -> { v: 1, ativa: id, lista: [{ id, rotulo, criada }] }.
 *
 * A conta inicial, "c1", usa os NOMES ANTIGOS ("aeon:v2:perfil", "aeon:v2:diario"...): quem ja usa o app nao migra nada,
 * e voltar atras e trivial. As demais usam "aeon:v2:c:<id>:<base>".
 *
 * Trocar de conta recarrega a pagina: os modulos guardam estado em memoria e recarregar e o jeito de nao deixar dado
 * da conta anterior vazar para a nova. Outras abas do mesmo navegador recarregam sozinhas.
 */
export const CHAVE_REGISTRO = 'aeon:v2:contas';
export const CONTA_INICIAL = 'c1';
export const LIMITE_CONTAS = 10;
/** Dados que pertencem a conta. Preferencias do aparelho (tema, verso escolhido, pedido de persistencia) ficam fora. */
export const BASES = ['perfil', 'diario', 'conta', 'rascunhos', 'verso-signo', 'dia', 'ultimo-backup', 'backup-dispensado'];

const RE_ID = /^[A-Za-z0-9_-]{1,40}$/;
const agora = () => new Date().toISOString();

let memoria = null; // quando o armazenamento nao deixa gravar, o registro vive aqui

function padrao() {
    return { v: 1, ativa: CONTA_INICIAL, lista: [{ id: CONTA_INICIAL, rotulo: '', criada: new Date(0).toISOString() }] };
}

function sanear(bruto) {
    if (!bruto || typeof bruto !== 'object' || bruto.v !== 1 || !Array.isArray(bruto.lista)) return padrao();
    const vistos = new Set();
    const lista = [];
    for (const c of bruto.lista.slice(0, LIMITE_CONTAS)) {
        if (!c || typeof c.id !== 'string' || !RE_ID.test(c.id) || vistos.has(c.id)) continue;
        vistos.add(c.id);
        lista.push({
            id: c.id,
            rotulo: typeof c.rotulo === 'string' ? c.rotulo.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 40) : '',
            criada: typeof c.criada === 'string' && Number.isFinite(Date.parse(c.criada)) ? c.criada : new Date(0).toISOString(),
        });
    }
    if (!lista.length) return padrao();
    return { v: 1, ativa: vistos.has(bruto.ativa) ? bruto.ativa : lista[0].id, lista };
}

function ler() {
    try {
        const bruto = localStorage.getItem(CHAVE_REGISTRO);
        if (bruto == null) return memoria || padrao();
        return sanear(JSON.parse(bruto));
    } catch (e) {
        return memoria || padrao();
    }
}

function gravar(reg) {
    memoria = reg;
    try {
        localStorage.setItem(CHAVE_REGISTRO, JSON.stringify(reg));
        memoria = null;
        return true;
    } catch (e) {
        return false;
    }
}

export function listarContas() {
    return ler().lista.map((c) => ({ ...c }));
}

export function contaAtiva() {
    return ler().ativa;
}

/** Nome da chave de armazenamento de um dado da conta. A conta inicial mantem o nome antigo. */
export function chaveDe(base, id = contaAtiva()) {
    return id === CONTA_INICIAL ? `aeon:v2:${base}` : `aeon:v2:c:${id}:${base}`;
}

const novoId = () => `c-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;

/** Cria uma conta local vazia (nao troca para ela). -> o id, ou null se passou do limite. */
export function criarContaLocal(rotulo = '') {
    const reg = ler();
    if (reg.lista.length >= LIMITE_CONTAS) return null;
    const id = novoId();
    reg.lista.push({ id, rotulo: String(rotulo).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 40), criada: agora() });
    gravar(reg);
    return id;
}

export function renomearConta(id, rotulo) {
    const reg = ler();
    const c = reg.lista.find((x) => x.id === id);
    if (!c) return false;
    c.rotulo = String(rotulo).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 40);
    return gravar(reg);
}

/** Torna a conta ativa e recarrega a pagina. `recarregar` existe para os testes. -> false se a conta nao existe. */
export function trocarConta(id, recarregar = () => location.reload()) {
    const reg = ler();
    if (!reg.lista.some((c) => c.id === id)) return false;
    if (reg.ativa !== id) {
        reg.ativa = id;
        gravar(reg);
    }
    recarregar();
    return true;
}

/** Apaga do aparelho todos os dados de uma conta. */
export function apagarDadosDaConta(id) {
    BASES.forEach((b) => {
        try {
            localStorage.removeItem(chaveDe(b, id));
        } catch (e) {
            /* sem armazenamento: nada a apagar */
        }
    });
}

/**
 * Tira a conta do aparelho e apaga os dados locais dela. Se era a unica, ela volta vazia (o aparelho sempre tem uma conta).
 * Se era a ativa, ativa outra e recarrega. -> { ok, recarregou }
 */
export function removerContaLocal(id, recarregar = () => location.reload()) {
    const reg = ler();
    if (!reg.lista.some((c) => c.id === id)) return { ok: false, recarregou: false };
    apagarDadosDaConta(id);
    if (reg.lista.length === 1) {
        reg.lista[0] = { id, rotulo: '', criada: agora() };
        gravar(reg);
        recarregar();
        return { ok: true, recarregou: true };
    }
    reg.lista = reg.lista.filter((c) => c.id !== id);
    const eraAtiva = reg.ativa === id;
    if (eraAtiva) reg.ativa = reg.lista[0].id;
    gravar(reg);
    if (eraAtiva) recarregar();
    return { ok: true, recarregou: eraAtiva };
}

/** A conta ativa foi trocada em outra aba: recarrega esta tambem, para nao misturar contas. */
export function vigiarTrocaEmOutraAba(recarregar = () => location.reload()) {
    if (typeof window === 'undefined') return;
    const aoIniciar = contaAtiva();
    window.addEventListener('storage', (e) => {
        if (e.key !== CHAVE_REGISTRO && e.key !== null) return;
        if (contaAtiva() !== aoIniciar) recarregar();
    });
}
