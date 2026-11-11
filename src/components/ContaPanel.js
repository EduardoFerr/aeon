import { ic } from '../utils/glifos.js';
import { esc } from '../utils/mapaComum.js';
import { avisar, abrir } from './Sobreposicao.js';
import {
    ErroConta, aoMudarConta, aparelhos, apagarDadosDoServidor, baixarDadosDaConta, confirmarCodigo, encerrarAparelho,
    estadoConta, ligar, motivoDoErro, pedirCodigo, resumoParaJuntar, sair, sairDeTodos, sincronizar,
} from '../utils/conta.js';

const T = {
    titulo: 'Conta e sincronização',
    intro: 'Guarde uma cópia do seu diário, dos seus mapas e do seu apelido na sua conta. Assim você não perde nada ao limpar o navegador e vê o mesmo conteúdo em outro aparelho. É opcional e fica desligada até você ligar.',
    ligar: 'Ligar a sincronização',
    antes: 'Antes de ligar',
    oQue: 'O que vai para a sua conta: seu diário (leituras, notas e perguntas), seus mapas, com data, hora e cidade de nascimento, e seu apelido.',
    onde: 'Onde fica: num servidor do Aeon, em texto legível. Quem cuida do servidor consegue ver esses dados. Não há criptografia que esconda o conteúdo de quem administra.',
    paraQue: 'Para que serve: só para guardar a cópia e mostrá-la nos seus aparelhos.',
    sair: 'Como sair: você apaga tudo da conta quando quiser, aqui mesmo, em "Apagar meus dados da conta".',
    entendi: 'Entendi e quero ligar',
    continuar: 'Continuar',
    cancelar: 'Cancelar',
    emailRotulo: 'Seu e-mail',
    emailDica: 'Enviamos um código de 6 dígitos para esse e-mail. Não há senha.',
    enviarCodigo: 'Enviar código',
    enviando: 'Enviando...',
    codigoRotulo: 'Código de 6 dígitos',
    codigoDica: (e) => `Enviamos o código para ${e}. Ele vale por 10 minutos.`,
    entrar: 'Entrar',
    reenviar: 'Reenviar código',
    reenviarEm: (n) => `Reenviar em ${n} s`,
    trocarEmail: 'Trocar e-mail',
    entrouComo: (e) => `Você entrou como ${e}.`,
    resumo: (a, c) => `Neste aparelho há ${a.diario} ${a.diario === 1 ? 'entrada' : 'entradas'} no diário e ${a.mapas} ${a.mapas === 1 ? 'mapa' : 'mapas'}. Na conta há ${c.diario} ${c.diario === 1 ? 'entrada' : 'entradas'} e ${c.mapas} ${c.mapas === 1 ? 'mapa' : 'mapas'}.`,
    juntar: 'Vamos juntar os dois lados. Nada é apagado nem trocado.',
    juntarBotao: 'Juntar e ligar',
    ligadaTitulo: 'Sincronização ligada',
    ultima: (q) => `Última sincronização: ${q}.`,
    nunca: 'Ainda não sincronizou.',
    sincronizar: 'Sincronizar agora',
    sincronizando: 'Sincronizando...',
    aparelhos: 'Aparelhos conectados',
    esteAparelho: 'este aparelho',
    encerrar: 'Encerrar',
    sairTodos: 'Sair de todos os aparelhos',
    baixar: 'Baixar meus dados da conta',
    sairAqui: 'Sair desta conta neste aparelho',
    sairAquiNota: 'Seus registros ficam neste aparelho e na conta. Só a sincronização para.',
    apagar: 'Apagar meus dados da conta',
    apagarTitulo: 'Apagar os dados da conta?',
    apagarCorpo: 'Isso apaga da nossa conta o diário, os mapas e o apelido que foram sincronizados, e encerra a conta. Não dá para desfazer. O que está neste aparelho continua nele.',
    apagarSim: 'Apagar da conta',
    manter: 'Manter',
    apagado: 'Seus dados foram apagados da conta. O que está neste aparelho continua nele.',
    voltar: 'Voltar',
    entrarDeNovo: 'Entrar de novo',
    erros: {
        rede: 'Sem conexão com a conta. Tentamos de novo quando a internet voltar.',
        sessao: 'Sua sessão acabou. Entre de novo para continuar sincronizando.',
        limite: 'Muitos pedidos seguidos. Tente de novo em alguns minutos.',
        espaco: 'A conta chegou ao limite de espaço. Apague registros antigos ou baixe um backup.',
        armazenamento: 'Este navegador não deixa guardar dados, então não há o que sincronizar.',
        servidor: 'Não foi possível sincronizar agora. Tentamos de novo em breve.',
        codigo_invalido: 'Código incorreto ou vencido. Confira os 6 dígitos ou peça outro.',
        email_invalido: 'Confira o e-mail digitado.',
    },
    aguarde: (n) => `Aguarde ${n} segundos para pedir outro código.`,
};

const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const quando = (iso) => (iso ? fmt.format(new Date(iso)) : '');

/**
 * Painel "Conta e sincronização" (Perfil, aba Dados). Passos: inicio, consentimento, e-mail, codigo, juntar, ligada.
 * Nada daqui toca nos registros do aparelho; o trabalho esta em utils/conta.js.
 */
export class ContaPanel extends HTMLElement {
    connectedCallback() {
        const e = estadoConta();
        this.passo = e.fase === 'ligada' ? 'ligada' : e.fase === 'juntar' ? 'juntar' : 'inicio';
        this.email = e.email;
        this.erro = '';
        this.resumo = null;
        this.espera = 0;
        this.ocupado = false;
        this.lista = null;
        this.desligar = aoMudarConta(() => {
            if (this.passo === 'ligada') this.atualizarStatus();
        });
        this.desenhar();
    }

    disconnectedCallback() {
        if (this.desligar) this.desligar();
        clearInterval(this.contador);
    }

    erroTexto(codigo, extra) {
        if (codigo === 'limite' && extra && extra.espera_s) return T.aguarde(extra.espera_s);
        return T.erros[codigo] || T.erros.servidor;
    }

    /* ---------- desenho ---------- */

    corpo() {
        const p = this.passo;
        const erro = this.erro ? `<p class="erro-msg" role="alert">${ic('info')}<span>${esc(this.erro)}</span></p>` : '';
        if (p === 'inicio') {
            return `<p>${T.intro}</p><div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="comecar">${T.ligar}</button></div>`;
        }
        if (p === 'consent') {
            return `<h4 class="conta-sub" tabindex="-1" data-foco>${T.antes}</h4>
                <ul class="conta-lista"><li>${T.oQue}</li><li>${T.onde}</li><li>${T.paraQue}</li><li>${T.sair}</li></ul>
                <label class="diario-marca"><input type="checkbox" data-entendi><span>${T.entendi}</span></label>
                <div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="consent-ok" disabled>${T.continuar}</button><button class="btn btn-terciario" type="button" data-acao="voltar-inicio">${T.cancelar}</button></div>`;
        }
        if (p === 'email') {
            return `<form class="campo" data-form="email" novalidate>
                <label class="rot" for="conta-email">${T.emailRotulo}</label>
                <input class="entrada" id="conta-email" type="email" inputmode="email" autocomplete="email" maxlength="254" value="${esc(this.email)}" aria-describedby="conta-email-d"${this.erro ? ' aria-invalid="true"' : ''}>
                <span class="dica" id="conta-email-d">${T.emailDica}</span>${erro}
                <div class="btn-row"><button class="btn btn-ghost" type="submit">${this.ocupado ? T.enviando : T.enviarCodigo}</button><button class="btn btn-terciario" type="button" data-acao="voltar-inicio">${T.cancelar}</button></div></form>`;
        }
        if (p === 'codigo') {
            return `<form class="campo" data-form="codigo" novalidate>
                <label class="rot" for="conta-codigo">${T.codigoRotulo}</label>
                <input class="entrada" id="conta-codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" aria-describedby="conta-codigo-d"${this.erro ? ' aria-invalid="true"' : ''}>
                <span class="dica" id="conta-codigo-d">${esc(T.codigoDica(this.email))}</span>${erro}
                <div class="btn-row"><button class="btn btn-ghost" type="submit">${T.entrar}</button>
                <button class="btn btn-terciario" type="button" data-acao="reenviar"${this.espera > 0 ? ' disabled' : ''}>${this.espera > 0 ? T.reenviarEm(this.espera) : T.reenviar}</button>
                <button class="btn btn-terciario" type="button" data-acao="trocar-email">${T.trocarEmail}</button></div></form>`;
        }
        if (p === 'juntar') {
            const r = this.resumo;
            return `<h4 class="conta-sub" tabindex="-1" data-foco>${esc(T.entrouComo(this.email))}</h4>
                ${r ? `<p>${esc(T.resumo(r.aqui, r.naConta))}</p><p>${T.juntar}</p>` : `<p>${this.erro ? '' : '...'}</p>`}${erro}
                <div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="juntar"${r ? '' : ' disabled'}>${this.ocupado ? T.sincronizando : T.juntarBotao}</button><button class="btn btn-terciario" type="button" data-acao="sair">${T.cancelar}</button></div>`;
        }
        // ligada
        const e = estadoConta();
        const aparelhosHtml = this.lista
            ? `<ul class="conta-aparelhos" aria-label="${T.aparelhos}">${this.lista.map((a) => `<li><span><strong>${esc(a.aparelho)}</strong>${a.atual ? ` <em>(${T.esteAparelho})</em>` : ''}<br><small>${esc(quando(a.ultimo_uso))}</small></span>${a.atual ? '' : `<button class="btn btn-terciario" type="button" data-encerrar="${esc(a.id)}">${T.encerrar}<span class="sr"> ${esc(a.aparelho)}</span></button>`}</li>`).join('')}</ul>
               <div class="btn-row"><button class="btn btn-terciario" type="button" data-acao="sair-todos">${T.sairTodos}</button></div>`
            : '';
        return `<h4 class="conta-sub" tabindex="-1" data-foco>${T.ligadaTitulo}</h4>
            <p>${esc(this.email)}</p>
            <p class="diario-aviso" role="status" aria-live="polite" data-status>${esc(this.statusTexto(e))}</p>
            ${e.erro === 'sessao' ? `<div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="entrar-de-novo">${T.entrarDeNovo}</button></div>` : ''}
            ${erro}
            <div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="sincronizar"${e.sincronizando ? ' disabled' : ''}>${e.sincronizando ? T.sincronizando : T.sincronizar}</button>
            <button class="btn btn-terciario" type="button" data-acao="aparelhos" aria-expanded="${!!this.lista}">${T.aparelhos}</button>
            <button class="btn btn-terciario" type="button" data-acao="baixar">${ic('baixar')}${T.baixar}</button></div>
            ${aparelhosHtml}
            <div class="btn-row"><button class="btn btn-terciario" type="button" data-acao="sair" aria-describedby="conta-sair-d">${T.sairAqui}</button><button class="btn btn-perigo" type="button" data-acao="apagar">${ic('lixo')}${T.apagar}</button></div>
            <p class="nota-geonames" id="conta-sair-d">${T.sairAquiNota}</p>`;
    }

    statusTexto(e) {
        if (e.sincronizando) return T.sincronizando;
        if (e.erro && e.erro !== 'sessao') return T.erros[e.erro] || T.erros.servidor;
        if (e.erro === 'sessao') return T.erros.sessao;
        return e.ultima ? T.ultima(quando(e.ultima)) : T.nunca;
    }

    desenhar(foco = true) {
        this.innerHTML = `<section class="painel conta-painel" aria-labelledby="conta-t"><div class="p-icon">${ic('cadeado')}<h3 id="conta-t">${T.titulo}</h3></div>${this.corpo()}</section>`;
        this.ligarEventos();
        if (foco) {
            const alvo = this.querySelector('input:not([type=checkbox])') || this.querySelector('[data-foco]');
            if (alvo && this.passo !== 'inicio') alvo.focus({ preventScroll: true });
        }
    }

    atualizarStatus() {
        const el = this.querySelector('[data-status]');
        if (!el) return;
        const e = estadoConta();
        el.textContent = this.statusTexto(e);
        const b = this.querySelector('[data-acao="sincronizar"]');
        if (b) {
            b.disabled = e.sincronizando;
            b.textContent = e.sincronizando ? T.sincronizando : T.sincronizar;
        }
        const tinhaSessao = this.querySelector('[data-acao="entrar-de-novo"]');
        if ((e.erro === 'sessao') !== !!tinhaSessao) this.desenhar(false);
    }

    /* ---------- eventos ---------- */

    ir(passo, { foco = true } = {}) {
        this.passo = passo;
        this.erro = '';
        this.desenhar(foco);
    }

    ligarEventos() {
        this.querySelectorAll('[data-acao]').forEach((b) => b.addEventListener('click', () => this.acao(b.dataset.acao, b)));
        this.querySelectorAll('[data-encerrar]').forEach((b) => b.addEventListener('click', () => this.encerrar(b.dataset.encerrar)));
        const chk = this.querySelector('[data-entendi]');
        if (chk) chk.addEventListener('change', () => (this.querySelector('[data-acao="consent-ok"]').disabled = !chk.checked));
        const fe = this.querySelector('[data-form="email"]');
        if (fe) fe.addEventListener('submit', (ev) => (ev.preventDefault(), this.enviarCodigo()));
        const fc = this.querySelector('[data-form="codigo"]');
        if (fc) fc.addEventListener('submit', (ev) => (ev.preventDefault(), this.entrar()));
        const cod = this.querySelector('#conta-codigo');
        if (cod) cod.addEventListener('input', () => (cod.value = cod.value.replace(/\D/g, '').slice(0, 6)));
    }

    async acao(nome, botao) {
        if (nome === 'comecar') return this.ir('consent');
        if (nome === 'voltar-inicio') return this.ir('inicio');
        if (nome === 'consent-ok') return this.ir('email');
        if (nome === 'trocar-email') return this.ir('email');
        if (nome === 'reenviar') return this.enviarCodigo(true);
        if (nome === 'entrar-de-novo') return this.ir('email');
        if (nome === 'juntar') return this.juntar();
        if (nome === 'sair') {
            await sair();
            avisar('Você saiu da conta neste aparelho.');
            return this.ir('inicio');
        }
        if (nome === 'sincronizar') {
            await sincronizar();
            return this.atualizarStatus();
        }
        if (nome === 'baixar') {
            try {
                await baixarDadosDaConta();
            } catch (e) {
                this.erro = this.erroTexto(motivoDoErro(e));
                this.desenhar(false);
            }
            return undefined;
        }
        if (nome === 'aparelhos') return this.alternarAparelhos();
        if (nome === 'sair-todos') {
            try {
                await sairDeTodos();
                avisar('Você saiu da conta em todos os aparelhos.');
                return this.ir('inicio');
            } catch (e) {
                this.erro = this.erroTexto(motivoDoErro(e));
                return this.desenhar(false);
            }
        }
        if (nome === 'apagar') return this.confirmarApagar(botao);
        return undefined;
    }

    async enviarCodigo(reenvio = false) {
        const campo = this.querySelector('#conta-email');
        if (campo) this.email = campo.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
            this.erro = T.erros.email_invalido;
            return this.desenhar();
        }
        this.ocupado = true;
        if (!reenvio) this.desenhar(false);
        try {
            await pedirCodigo(this.email);
            this.ocupado = false;
            this.passo = 'codigo';
            this.erro = '';
            this.iniciarContagem(30);
            this.desenhar();
        } catch (e) {
            this.ocupado = false;
            this.erro = e instanceof ErroConta && e.codigo === 'aguarde'
                ? T.aguarde((e.extra && e.extra.espera_s) || 30)
                : this.erroTexto(motivoDoErro(e), e.extra);
            this.desenhar();
        }
        return undefined;
    }

    iniciarContagem(n) {
        clearInterval(this.contador);
        this.espera = n;
        this.contador = setInterval(() => {
            this.espera -= 1;
            const b = this.querySelector('[data-acao="reenviar"]');
            if (b) {
                b.disabled = this.espera > 0;
                b.textContent = this.espera > 0 ? T.reenviarEm(this.espera) : T.reenviar;
            }
            if (this.espera <= 0) clearInterval(this.contador);
        }, 1000);
    }

    async entrar() {
        const campo = this.querySelector('#conta-codigo');
        const codigo = campo ? campo.value.trim() : '';
        if (!/^\d{6}$/.test(codigo)) {
            this.erro = T.erros.codigo_invalido;
            return this.desenhar();
        }
        try {
            await confirmarCodigo(this.email, codigo);
        } catch (e) {
            this.erro = this.erroTexto(motivoDoErro(e), e.extra);
            return this.desenhar();
        }
        clearInterval(this.contador);
        const e = estadoConta();
        if (e.fase === 'ligada') return this.ir('ligada'); // voltou a entrar numa conta ja ligada
        this.resumo = null;
        this.ir('juntar');
        try {
            this.resumo = await resumoParaJuntar();
            this.erro = '';
        } catch (err) {
            this.erro = this.erroTexto(motivoDoErro(err));
        }
        if (this.isConnected) this.desenhar(false);
        return undefined;
    }

    async juntar() {
        this.ocupado = true;
        this.desenhar(false);
        const r = await ligar();
        this.ocupado = false;
        if (!r.ok) {
            this.erro = this.erroTexto(r.motivo);
            return this.desenhar(false);
        }
        avisar('Sincronização ligada.');
        return this.ir('ligada');
    }

    async alternarAparelhos() {
        if (this.lista) {
            this.lista = null;
            return this.desenhar(false);
        }
        try {
            this.lista = await aparelhos();
            this.erro = '';
        } catch (e) {
            this.erro = this.erroTexto(motivoDoErro(e));
        }
        return this.desenhar(false);
    }

    async encerrar(id) {
        try {
            await encerrarAparelho(id);
            this.lista = await aparelhos();
        } catch (e) {
            this.erro = this.erroTexto(motivoDoErro(e));
        }
        this.desenhar(false);
    }

    confirmarApagar(gatilho) {
        const c = abrir({
            tipo: 'confirmacao', titulo: T.apagarTitulo, gatilho, descricao: true,
            corpo: `<p>${T.apagarCorpo}</p>
                <div class="sob-pilha" style="margin-top:18px"><button class="btn btn-ghost" type="button" data-foco data-manter>${T.manter}</button>
                <button class="btn btn-perigo cheio" type="button" data-apagar>${ic('lixo')}${T.apagarSim}</button></div>`,
        });
        c.corpo.addEventListener('click', async (ev) => {
            if (ev.target.closest('[data-manter]')) return c.fechar();
            if (!ev.target.closest('[data-apagar]')) return undefined;
            try {
                await apagarDadosDoServidor();
            } catch (e) {
                c.fechar(false);
                this.erro = this.erroTexto(motivoDoErro(e));
                return this.desenhar(false);
            }
            c.fechar(false);
            avisar(T.apagado);
            return this.ir('inicio');
        });
    }
}

customElements.define('conta-panel', ContaPanel);
