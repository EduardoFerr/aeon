/**
 * Aviso fixo de versao nova: "Ha uma versao nova do Aeon." com o botao "Atualizar agora".
 * Fica acima da barra de navegacao e NAO some sozinho (a pessoa decide quando atualizar). A regiao role="status"
 * existe antes do texto entrar, para o leitor de tela anunciar. O foco nao e movido. A altura do aviso vai para
 * --versao-h, e o CSS levanta o que fica colado no rodape (aviso curto, voltar ao topo, barra da cruz) e abre
 * espaco no fim da pagina, para o aviso nunca cobrir um botao.
 */
const TEXTO = {
    mensagem: 'Há uma versão nova do Aeon.',
    botao: 'Atualizar agora',
    atualizando: 'Atualizando...',
};

let raiz = null;
let medidor = null;

function criar() {
    raiz = document.createElement('div');
    raiz.className = 'versao-nova';
    raiz.setAttribute('role', 'status');
    raiz.setAttribute('aria-live', 'polite');
    raiz.hidden = true;
    document.body.append(raiz);
    medidor = new ResizeObserver(medir);
}

function medir() {
    if (!raiz || raiz.hidden) return;
    document.documentElement.style.setProperty('--versao-h', `${Math.ceil(raiz.getBoundingClientRect().height) + 16}px`);
}

/** Mostra o aviso (uma vez; chamadas repetidas mantem o mesmo). `aoAtualizar` roda ao tocar no botao. */
export function mostrarAvisoVersao(aoAtualizar) {
    if (!raiz) criar();
    if (!raiz.hidden) return;
    raiz.innerHTML = `<p class="versao-nova-texto"></p><button class="btn btn-ghost" type="button" data-atualizar></button>`;
    const botao = raiz.querySelector('[data-atualizar]');
    botao.textContent = TEXTO.botao;
    botao.addEventListener('click', async () => {
        botao.disabled = true;
        botao.textContent = TEXTO.atualizando;
        raiz.setAttribute('aria-busy', 'true');
        try {
            await aoAtualizar();
        } finally {
            // se a pagina nao recarregou (versao nova indisponivel), devolve o botao
            botao.disabled = false;
            botao.textContent = TEXTO.botao;
            raiz.removeAttribute('aria-busy');
        }
    });
    raiz.hidden = false;
    document.body.classList.add('tem-aviso-versao');
    medidor.observe(raiz);
    medir();
    // o texto entra depois de a regiao aparecer: so assim o leitor de tela anuncia
    requestAnimationFrame(() => {
        raiz.querySelector('p').textContent = TEXTO.mensagem;
        raiz.classList.add('on');
        medir();
    });
}
