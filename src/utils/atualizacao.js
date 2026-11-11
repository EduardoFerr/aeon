import { registerSW } from 'virtual:pwa-register';
import { mostrarAvisoVersao } from '../components/AvisoVersao.js';
import { haVersaoNova, EVENTO_ANTES } from './versao.js';

/**
 * Atualizacao confiavel do app (service worker em modo "prompt").
 *
 * - O registro e feito aqui. Uma versao nova instala em segundo plano e ESPERA: a pagina so troca quando a pessoa
 *   toca em "Atualizar agora", entao nunca recarrega sozinha no meio de uma anotacao.
 * - A verificacao acontece ao abrir, quando a aba volta a ficar visivel e a cada 30 minutos.
 * - Antes de recarregar, o evento "aeon:antes-de-atualizar" avisa as telas para guardarem o que estiver pendente
 *   (o Diario salva a nota que ainda esta no tempo de espera do autosave).
 * - Nada aqui toca em localStorage, sessionStorage ou IndexedDB. "Recarregar do zero" apaga so o CacheStorage
 *   e o registro do service worker.
 */
export const VERSAO = {
    versao: typeof __APP_VERSAO__ !== 'undefined' ? __APP_VERSAO__ : '0.0.0',
    build: typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : '',
};

const INTERVALO = 30 * 60 * 1000;
const ESPERA_INSTALACAO = 30 * 1000;

let registro = null;
let trocar = null;
let iniciado = false;
let verificando = null;

const guardarPendencias = () => window.dispatchEvent(new CustomEvent(EVENTO_ANTES));

/** Aplica a versao nova (a que esta esperando) e recarrega. Sem service worker, so recarrega. */
export async function aplicarAgora() {
    guardarPendencias();
    if (trocar && registro && registro.waiting) {
        try {
            await trocar(true); // pede a troca; o recarregamento vem quando a versao nova assume
            await new Promise((r) => setTimeout(r, 6000));
        } catch (e) {
            /* cai no recarregamento simples abaixo */
        }
    }
    location.reload();
}

const mostrarAviso = () => mostrarAvisoVersao(aplicarAgora);

/** Pergunta ao servidor se ha service worker novo. Junta chamadas simultaneas. */
function verificar() {
    if (!registro) return Promise.resolve();
    if (!verificando) {
        verificando = registro
            .update()
            .catch(() => {}) // sem rede: tenta de novo no proximo gatilho
            .finally(() => {
                verificando = null;
            });
    }
    return verificando;
}

export function iniciarAtualizacao() {
    if (iniciado) return;
    iniciado = true;
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    trocar = registerSW({
        immediate: true,
        onNeedRefresh: mostrarAviso,
        onRegisteredSW(_url, reg) {
            registro = reg || null;
            verificar(); // ao abrir
        },
        onRegisterError() {
            /* sem service worker o app continua funcionando, so sem uso offline */
        },
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') verificar();
    });
    setInterval(() => {
        if (document.visibilityState === 'visible') verificar();
    }, INTERVALO);
    // Outra aba aplicou a versao: esta tambem vai recarregar, entao guarda o que estiver pendente.
    navigator.serviceWorker.addEventListener('controllerchange', guardarPendencias);
}

function esperarInstalacao(sw) {
    return new Promise((resolve, reject) => {
        const fim = () => sw.state === 'installed' || sw.state === 'activated' || sw.state === 'redundant';
        if (fim()) return resolve();
        const t = setTimeout(() => reject(new Error('demorou')), ESPERA_INSTALACAO);
        sw.addEventListener('statechange', () => {
            if (fim()) {
                clearTimeout(t);
                resolve();
            }
        });
    });
}

/** Sem service worker: compara a versao que roda com a publicada em /versao.json. */
async function buscarPorArquivo() {
    const r = await fetch('/versao.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('sem versao');
    const publicada = await r.json();
    return haVersaoNova(VERSAO, publicada) ? 'nova' : 'atual';
}

/**
 * Botao "Buscar atualizacao". Devolve 'nova' (o aviso da versao nova aparece), 'atual' ou 'erro'.
 */
export async function buscarAtualizacao() {
    try {
        if (!registro) {
            const r = await buscarPorArquivo();
            if (r === 'nova') mostrarAvisoVersao(() => location.reload());
            return r;
        }
        await registro.update();
        if (!registro.waiting && registro.installing) await esperarInstalacao(registro.installing);
        if (registro.waiting) {
            mostrarAviso();
            return 'nova';
        }
        return 'atual';
    } catch (e) {
        return 'erro';
    }
}

/**
 * "Recarregar do zero": apaga SO o CacheStorage e cancela o registro do service worker, e recarrega.
 * Nao toca em localStorage, sessionStorage nem IndexedDB (diario, mapas e preferencias ficam).
 * Antes de apagar, confirma que o servidor responde: sem rede, o app nao teria de onde carregar.
 * Devolve 'sem-rede' ou 'erro' se nao fez nada; em caso de sucesso a pagina recarrega.
 */
export async function recarregarDoZero() {
    try {
        if (navigator.onLine === false) return 'sem-rede';
        const r = await fetch('/versao.json', { cache: 'no-store' });
        if (!r.ok) return 'sem-rede';
    } catch (e) {
        return 'sem-rede';
    }
    try {
        guardarPendencias();
        if ('serviceWorker' in navigator) {
            const registros = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registros.map((x) => x.unregister()));
        }
        if (typeof caches !== 'undefined') {
            const nomes = await caches.keys();
            await Promise.all(nomes.map((n) => caches.delete(n)));
        }
    } catch (e) {
        return 'erro';
    }
    location.reload();
    return 'ok';
}
