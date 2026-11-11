import { ic } from '../utils/glifos.js';
import { SYNC_ATIVA } from '../utils/contaEstado.js';
import { aoMudarConta, estadoConta } from '../utils/conta.js';
import { conviteAtivo, dispensarConvite, lerDispensa, DIAS_DISPENSA } from '../utils/convite.js';
import { avisoBackupAtivo } from '../utils/backup.js';
import { listar as listarDiario, aoMudar as aoMudarDiario } from '../utils/diario.js';
import { listar as listarMapas, aoMudar as aoMudarPerfil } from '../utils/perfil.js';
import { avisar } from './Sobreposicao.js';
import { abrirConta } from './ContaSheet.js';

const T = {
    rotulo: 'Convite para criar seu login',
    texto: 'Crie seu login para recuperar seus registros em outro aparelho.',
    ligar: 'Criar login',
    agoraNao: 'Agora não',
    dispensado: 'Tudo bem. A opção fica sempre no ícone de nuvem, no topo.',
};

/**
 * Convite discreto (Home e Diario) para ligar a sincronizacao. Decide sozinho se aparece (utils/convite.js) e
 * se refaz quando o estado da conta, o diario ou os mapas mudam. "Agora nao" esconde por 30 dias.
 */
export class ConviteConta extends HTMLElement {
    connectedCallback() {
        this.desligar = [aoMudarConta(() => this.desenhar()), aoMudarDiario(() => this.desenhar()), aoMudarPerfil(() => this.desenhar())];
        this.desenhar();
    }

    disconnectedCallback() {
        (this.desligar || []).forEach((f) => f());
    }

    ativo() {
        if (!SYNC_ATIVA) return false;
        return conviteAtivo({
            ativa: true,
            fase: estadoConta().fase,
            registros: listarDiario().length + listarMapas().length,
            backupAtivo: avisoBackupAtivo(),
            dispensadoEm: lerDispensa(),
        });
    }

    desenhar() {
        if (!this.ativo()) {
            if (this.firstElementChild) this.replaceChildren();
            return;
        }
        if (this.firstElementChild) return;
        const el = document.createElement('aside');
        el.className = 'convite-conta';
        el.setAttribute('aria-label', T.rotulo);
        el.innerHTML = `<span class="convite-ico" aria-hidden="true">${ic('nuvem')}</span><div class="convite-corpo"><p></p><div class="btn-row"><button class="btn btn-ghost" type="button" data-ligar></button><button class="btn btn-terciario" type="button" data-agora-nao></button></div></div>`;
        el.querySelector('p').textContent = T.texto;
        const ligar = el.querySelector('[data-ligar]');
        ligar.textContent = T.ligar;
        el.querySelector('[data-agora-nao]').textContent = T.agoraNao;
        ligar.addEventListener('click', () => abrirConta(ligar));
        el.querySelector('[data-agora-nao]').addEventListener('click', () => {
            dispensarConvite();
            this.replaceChildren();
            avisar(T.dispensado);
        });
        this.append(el);
    }
}

customElements.define('convite-conta', ConviteConta);
