/*
 * Transicao do service worker antigo (autoUpdate) para o novo (aviso "Atualizar agora").
 *
 * O antigo trocava de versao sozinho, e a pagina antiga nao sabe mandar o pedido de troca que o novo espera.
 * Sem este arquivo, a primeira versao nova ficaria esperando ate a pessoa fechar TODAS as abas do app.
 *
 * Regra: a marca "aeon-sw-aviso" so existe depois que um service worker desta geracao ativou. Sem a marca,
 * quem esta instalando e o primeiro da geracao, entao assume na hora (como o antigo fazia). Com a marca, o
 * novo espera o aviso. A marca e um cache vazio de proposito: "Recarregar do zero" apaga os caches e a marca
 * junto, o que tambem esta certo (nao ha versao ativa para proteger).
 */
const MARCA = "aeon-sw-aviso";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .has(MARCA)
      .then((temMarca) => {
        if (!temMarca) self.skipWaiting();
      })
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(caches.open(MARCA));
});
