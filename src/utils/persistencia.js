import { CHAVE_PERSIST_PEDIDO } from './versao.js';

/**
 * Pede ao navegador que trate o armazenamento do site como persistente (ele nao apaga o diario e os mapas por
 * falta de espaco). Chamado depois de a pessoa guardar um registro. Pede uma vez por aparelho: a marca fica no
 * localStorage (alguns navegadores mostram uma pergunta, e repetir incomodaria). Tudo em try/catch: sem a API,
 * em modo privado ou com armazenamento bloqueado, nada acontece.
 */
let tentou = false;

export function pedirPersistencia() {
    if (tentou) return;
    tentou = true;
    try {
        const s = typeof navigator !== 'undefined' ? navigator.storage : null;
        if (!s || typeof s.persist !== 'function') return;
        if (localStorage.getItem(CHAVE_PERSIST_PEDIDO)) return;
        const marcar = () => {
            try {
                localStorage.setItem(CHAVE_PERSIST_PEDIDO, new Date().toISOString());
            } catch (e) {
                /* sem marca, o pedido so se repete na proxima visita */
            }
        };
        Promise.resolve(typeof s.persisted === 'function' ? s.persisted() : false)
            .then((ja) => (ja ? true : s.persist()))
            .then(marcar, () => {});
    } catch (e) {
        /* sem armazenamento persistente */
    }
}
