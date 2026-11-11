import { ic } from '../utils/glifos.js';
import { esc } from '../utils/mapaComum.js';
import { avisar, abrir } from './Sobreposicao.js';
import {
    ErroConta, aoMudarConta, aparelhos, apagarDadosDoServidor, apagarRegistrosLocais, baixarDadosDaConta, confirmarCodigo,
    encerrarAparelho, entrarComChave, estadoConta, gerarChave, gerarNovaChave, ligar, motivoDoErro, moverLigacaoParaNovaConta,
    pedirCodigo, registrosLocais, resumoParaJuntar, sair, sairDeTodos, sincronizar, verChave,
} from '../utils/conta.js';
import { contaAtiva, criarContaLocal, listarContas, removerContaLocal, trocarConta } from '../utils/contas.js';
import { lerEstado } from '../utils/contaEstado.js';

/**
 * Textos do painel de conta. Regra de produto: nenhum texto aqui diz o que e guardado nem como. So o que a pessoa
 * pode fazer (criar login, entrar, trocar de conta) e o que acontece com a conta no aparelho.
 */
const T = {
    titulo: 'Conta',
    intro: 'Crie seu login para recuperar seus registros em outro aparelho.',
    gerar: 'Gerar chave de recuperação',
    comEmail: 'Entrar com e-mail',
    comChave: 'Entrar com minha chave',
    chaveNovaTitulo: 'Sua chave de recuperação',
    chaveNovaTexto: 'Anote estas 12 palavras, na ordem. Com elas você recupera seus registros em outro aparelho.',
    copiar: 'Copiar chave',
    copiada: 'Chave copiada.',
    naoCopiou: 'Não deu para copiar. Selecione as palavras e copie.',
    anotei: 'Anotei minha chave',
    concluir: 'Concluir',
    chaveRotulo: 'Sua chave de 12 palavras',
    chaveDica: 'Cole ou digite as palavras, separadas por espaço.',
    verChave: 'Ver minha chave',
    esconderChave: 'Esconder chave',
    novaChave: 'Gerar nova chave',
    novaChaveTitulo: 'Gerar uma chave nova?',
    novaChaveCorpo: 'A chave atual deixa de funcionar. Anote a nova.',
    novaChaveSim: 'Gerar nova chave',
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
    addEmail: 'Adicionar e-mail',
    entrouComo: (e) => (e ? `Você entrou como ${e}.` : 'Você entrou.'),
    cancelar: 'Cancelar',
    voltar: 'Voltar',
    escolhaTitulo: 'O que fazer com os registros deste aparelho?',
    resumo: (a, c) => `Neste aparelho há ${a.diario} ${a.diario === 1 ? 'entrada' : 'entradas'} no diário e ${a.mapas} ${a.mapas === 1 ? 'mapa' : 'mapas'}. Na conta há ${c.diario} ${c.diario === 1 ? 'entrada' : 'entradas'} e ${c.mapas} ${c.mapas === 1 ? 'mapa' : 'mapas'}.`,
    duas: 'Ficar com as duas contas',
    duasDesc: 'Você troca entre elas quando quiser.',
    juntarTudo: 'Juntar tudo numa conta',
    juntarDesc: 'Reúne os registros dos dois lados. Nada é apagado.',
    descartar: 'Descartar os registros deste aparelho',
    descartarDesc: 'Fica só o que já estava na conta.',
    descartarTitulo: 'Descartar os registros deste aparelho?',
    descartarCorpo: 'Os registros que estão aqui serão apagados e não dá para desfazer. Ficam só os da conta em que você entrou.',
    descartarSim: 'Descartar',
    ligadaTitulo: 'Sua conta',
    ultima: (q) => `Última sincronização: ${q}.`,
    nunca: 'Ainda não sincronizou.',
    sincronizar: 'Sincronizar agora',
    sincronizando: 'Sincronizando...',
    aparelhos: 'Aparelhos conectados',
    esteAparelho: 'este aparelho',
    encerrar: 'Encerrar',
    sairTodos: 'Sair de todos os aparelhos',
    baixar: 'Baixar meus dados da conta',
    remover: 'Remover esta conta deste aparelho',
    removerTitulo: 'Remover esta conta deste aparelho?',
    removerEmail: 'Você pode entrar de novo com o e-mail. Os registros desta conta saem deste aparelho.',
    removerChave: 'Sem a chave de recuperação não será possível recuperar esta conta. Os registros dela saem deste aparelho.',
    removerLocal: 'Os registros desta conta serão apagados deste aparelho. Não dá para desfazer.',
    removerSim: 'Remover',
    manter: 'Manter',
    apagar: 'Apagar meus dados da conta',
    apagarTitulo: 'Apagar os dados da conta?',
    apagarCorpo: 'Isso apaga a conta e tudo o que ela tem, e encerra o login. Não dá para desfazer. O que está neste aparelho continua nele.',
    apagarSim: 'Apagar da conta',
    apagado: 'Sua conta foi apagada. O que está neste aparelho continua nele.',
    contas: 'Contas neste aparelho',
    usar: 'Usar',
    emUso: 'em uso',
    outra: 'Adicionar outra conta',
    contaN: (n) => `Conta ${n}`,
    tipoEmail: 'com e-mail',
    tipoChave: 'com chave',
    tipoLocal: 'só neste aparelho',
    entrarDeNovo: 'Entrar de novo',
    erros: {
        rede: 'Sem conexão. Tentamos de novo quando a internet voltar.',
        sessao: 'Sua sessão acabou. Entre de novo para continuar sincronizando.',
        limite: 'Não foi possível agora. Tente de novo mais tarde.',
        espaco: 'A conta chegou ao limite de espaço. Apague registros antigos ou baixe um backup.',
        armazenamento: 'Este navegador não deixa guardar dados, então não há o que sincronizar.',
        servidor: 'Não foi possível agora. Tentamos de novo em breve.',
        codigo_invalido: 'Código incorreto ou vencido. Confira os 6 dígitos ou peça outro.',
        email_invalido: 'Confira o e-mail digitado.',
        chave_invalida: 'Chave incorreta. Confira as 12 palavras.',
        email_ocupado: 'Este e-mail já tem uma conta. Use outro e-mail.',
    },
    aguarde: (n) => `Aguarde ${n} segundos para pedir outro código.`,
};

const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const quando = (iso) => (iso ? fmt.format(new Date(iso)) : '');
const soTotal = (r) => r.diario + r.mapas;

/** Pergunta de confirmacao em dialogo. -> Promise<boolean> */
function confirmar({ titulo, corpo, sim, perigo = true, gatilho }) {
    return new Promise((resolver) => {
        let respondeu = false;
        const c = abrir({
            tipo: 'confirmacao', titulo, gatilho, descricao: true,
            aoFechar: () => { if (!respondeu) resolver(false); },
            corpo: `<p>${corpo}</p>
                <div class="sob-pilha" style="margin-top:18px"><button class="btn btn-ghost" type="button" data-foco data-nao>${T.manter}</button>
                <button class="btn ${perigo ? 'btn-perigo cheio' : 'btn-ghost'}" type="button" data-sim>${perigo ? ic('lixo') : ''}${sim}</button></div>`,
        });
        c.corpo.addEventListener('click', (ev) => {
            if (ev.target.closest('[data-nao]')) {
                respondeu = true;
                c.fechar();
                resolver(false);
            } else if (ev.target.closest('[data-sim]')) {
                respondeu = true;
                c.fechar(false);
                resolver(true);
            }
        });
    });
}

async function copiarTexto(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        return true;
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = texto;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:absolute;left:-9999px';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try {
            ok = document.execCommand('copy');
        } catch (err) {
            ok = false;
        }
        ta.remove();
        return ok;
    }
}

/**
 * Painel "Conta" (Perfil, aba Dados). Passos: inicio, chave-nova, chave-entrar, email, codigo, escolha, ligada.
 * Nada daqui toca nos registros do aparelho sem a pessoa pedir; o trabalho esta em utils/conta.js e utils/contas.js.
 */
export class ContaPanel extends HTMLElement {
    connectedCallback() {
        const e = estadoConta();
        this.passo = e.fase === 'ligada' ? 'ligada' : 'inicio';
        if (e.fase === 'juntar') this.passo = 'retomar';
        this.email = e.email;
        this.vincular = false;
        this.erro = '';
        this.resumo = null;
        this.chave = '';
        this.mostrarChave = false;
        this.espera = 0;
        this.ocupado = false;
        this.lista = null;
        this.desligar = aoMudarConta(() => {
            if (this.passo === 'ligada') this.atualizarStatus();
        });
        if (this.passo === 'retomar') this.retomar();
        else this.desenhar();
    }

    disconnectedCallback() {
        if (this.desligar) this.desligar();
        clearInterval(this.contador);
    }

    erroTexto(codigo, extra) {
        if (codigo === 'limite' && extra && extra.espera_s) return T.erros.limite;
        return T.erros[codigo] || T.erros.servidor;
    }

    /* ---------- desenho ---------- */

    erroHtml() {
        return this.erro ? `<p class="erro-msg" role="alert">${ic('info')}<span>${esc(this.erro)}</span></p>` : '';
    }

    chaveHtml(frase) {
        const palavras = frase.split(' ');
        return `<ol class="chave-lista" aria-label="${T.chaveNovaTitulo}">${palavras.map((p, i) => `<li><span aria-hidden="true">${i + 1}</span>${esc(p)}</li>`).join('')}</ol>
            <div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="copiar">${ic('copiar')}${T.copiar}</button></div>`;
    }

    contasHtml() {
        const lista = listarContas();
        if (lista.length < 2) return '';
        const ativa = contaAtiva();
        const itens = lista.map((c, i) => {
            const e = lerEstado(c.id);
            const nome = c.rotulo || e.email || T.contaN(i + 1);
            const tipo = e.email ? T.tipoEmail : e.servidorId ? T.tipoChave : T.tipoLocal;
            const eu = c.id === ativa;
            return `<li><span><strong>${esc(nome)}</strong>${eu ? ` <em>(${T.emUso})</em>` : ''}<br><small>${esc(tipo)}</small></span>
                <span class="conta-acoes">${eu ? '' : `<button class="btn btn-terciario" type="button" data-usar="${esc(c.id)}">${T.usar}<span class="sr"> ${esc(nome)}</span></button>`}
                ${eu ? '' : `<button class="btn btn-perigo" type="button" data-tirar="${esc(c.id)}">${T.removerSim}<span class="sr"> ${esc(nome)}</span></button>`}</span></li>`;
        }).join('');
        return `<h4 class="conta-sub">${T.contas}</h4><ul class="conta-aparelhos" aria-label="${T.contas}">${itens}</ul>`;
    }

    corpo() {
        const p = this.passo;
        const erro = this.erroHtml();
        if (p === 'inicio') {
            return `${this.contasHtml()}<p>${T.intro}</p>${erro}
                <div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="gerar"${this.ocupado ? ' disabled' : ''}>${T.gerar}</button>
                <button class="btn btn-terciario" type="button" data-acao="com-email">${T.comEmail}</button>
                <button class="btn btn-terciario" type="button" data-acao="com-chave">${T.comChave}</button></div>
                <div class="btn-row"><button class="btn btn-terciario" type="button" data-acao="outra">${T.outra}</button></div>`;
        }
        if (p === 'chave-nova') {
            return `<h4 class="conta-sub" tabindex="-1" data-foco>${T.chaveNovaTitulo}</h4><p>${T.chaveNovaTexto}</p>${this.chaveHtml(this.chave)}
                <label class="diario-marca"><input type="checkbox" data-anotei><span>${T.anotei}</span></label>
                <div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="concluir" disabled>${T.concluir}</button></div>`;
        }
        if (p === 'chave-entrar') {
            return `<form class="campo" data-form="chave" novalidate>
                <label class="rot" for="conta-chave">${T.chaveRotulo}</label>
                <textarea class="entrada" id="conta-chave" rows="3" autocomplete="off" autocapitalize="none" spellcheck="false" style="padding:12px 16px;min-height:96px;resize:vertical" aria-describedby="conta-chave-d"${this.erro ? ' aria-invalid="true"' : ''}></textarea>
                <span class="dica" id="conta-chave-d">${T.chaveDica}</span>${erro}
                <div class="btn-row"><button class="btn btn-ghost" type="submit"${this.ocupado ? ' disabled' : ''}>${T.entrar}</button><button class="btn btn-terciario" type="button" data-acao="voltar-inicio">${T.cancelar}</button></div></form>`;
        }
        if (p === 'email') {
            return `<form class="campo" data-form="email" novalidate>
                <label class="rot" for="conta-email">${T.emailRotulo}</label>
                <input class="entrada" id="conta-email" type="email" inputmode="email" autocomplete="email" maxlength="254" value="${esc(this.email)}" aria-describedby="conta-email-d"${this.erro ? ' aria-invalid="true"' : ''}>
                <span class="dica" id="conta-email-d">${T.emailDica}</span>${erro}
                <div class="btn-row"><button class="btn btn-ghost" type="submit">${this.ocupado ? T.enviando : T.enviarCodigo}</button><button class="btn btn-terciario" type="button" data-acao="voltar">${T.cancelar}</button></div></form>`;
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
        if (p === 'escolha') {
            const r = this.resumo;
            return `<h4 class="conta-sub" tabindex="-1" data-foco>${T.escolhaTitulo}</h4>
                ${r ? `<p>${esc(T.resumo(r.aqui, r.naConta))}</p>` : `<p>${this.erro ? '' : '...'}</p>`}${erro}
                <div class="conta-opcoes">
                <button class="conta-opcao" type="button" data-acao="duas"${r ? '' : ' disabled'}><strong>${T.duas}</strong><span>${T.duasDesc}</span></button>
                <button class="conta-opcao" type="button" data-acao="juntar"${r ? '' : ' disabled'}><strong>${T.juntarTudo}</strong><span>${T.juntarDesc}</span></button>
                <button class="conta-opcao perigo" type="button" data-acao="descartar"${r ? '' : ' disabled'}><strong>${T.descartar}</strong><span>${T.descartarDesc}</span></button></div>
                <div class="btn-row"><button class="btn btn-terciario" type="button" data-acao="cancelar-login">${T.cancelar}</button></div>`;
        }
        // ligada
        const e = estadoConta();
        const aparelhosHtml = this.lista
            ? `<ul class="conta-aparelhos" aria-label="${T.aparelhos}">${this.lista.map((a) => `<li><span><strong>${esc(a.aparelho)}</strong>${a.atual ? ` <em>(${T.esteAparelho})</em>` : ''}<br><small>${esc(quando(a.ultimo_uso))}</small></span>${a.atual ? '' : `<button class="btn btn-terciario" type="button" data-encerrar="${esc(a.id)}">${T.encerrar}<span class="sr"> ${esc(a.aparelho)}</span></button>`}</li>`).join('')}</ul>
               <div class="btn-row"><button class="btn btn-terciario" type="button" data-acao="sair-todos">${T.sairTodos}</button></div>`
            : '';
        const chaveBloco = e.temChave
            ? `<div class="btn-row"><button class="btn btn-terciario" type="button" data-acao="ver-chave" aria-expanded="${this.mostrarChave}">${this.mostrarChave ? T.esconderChave : T.verChave}</button><button class="btn btn-terciario" type="button" data-acao="nova-chave">${T.novaChave}</button></div>${this.mostrarChave && verChave() ? this.chaveHtml(verChave()) : ''}`
            : `<div class="btn-row"><button class="btn btn-terciario" type="button" data-acao="gerar">${T.gerar}</button></div>`;
        return `${this.contasHtml()}<h4 class="conta-sub" tabindex="-1" data-foco>${T.ligadaTitulo}</h4>
            ${e.email ? `<p>${esc(e.email)}</p>` : ''}
            <p class="diario-aviso" role="status" aria-live="polite" data-status>${esc(this.statusTexto(e))}</p>
            ${e.erro === 'sessao' ? `<div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="entrar-de-novo">${T.entrarDeNovo}</button></div>` : ''}
            ${erro}
            <div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="sincronizar"${e.sincronizando ? ' disabled' : ''}>${e.sincronizando ? T.sincronizando : T.sincronizar}</button>
            <button class="btn btn-terciario" type="button" data-acao="aparelhos" aria-expanded="${!!this.lista}">${T.aparelhos}</button>
            <button class="btn btn-terciario" type="button" data-acao="baixar">${ic('baixar')}${T.baixar}</button></div>
            ${aparelhosHtml}
            ${chaveBloco}
            ${e.email ? '' : `<div class="btn-row"><button class="btn btn-terciario" type="button" data-acao="add-email">${T.addEmail}</button></div>`}
            <div class="btn-row"><button class="btn btn-terciario" type="button" data-acao="remover">${T.remover}</button><button class="btn btn-perigo" type="button" data-acao="apagar">${ic('lixo')}${T.apagar}</button></div>
            <div class="btn-row"><button class="btn btn-terciario" type="button" data-acao="outra">${T.outra}</button></div>`;
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
            const alvo = this.querySelector('input:not([type=checkbox]), textarea') || this.querySelector('[data-foco]');
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
        this.querySelectorAll('[data-usar]').forEach((b) => b.addEventListener('click', () => trocarConta(b.dataset.usar)));
        this.querySelectorAll('[data-tirar]').forEach((b) => b.addEventListener('click', () => this.tirarOutra(b.dataset.tirar, b)));
        const chk = this.querySelector('[data-anotei]');
        if (chk) chk.addEventListener('change', () => (this.querySelector('[data-acao="concluir"]').disabled = !chk.checked));
        const fe = this.querySelector('[data-form="email"]');
        if (fe) fe.addEventListener('submit', (ev) => (ev.preventDefault(), this.enviarCodigo()));
        const fc = this.querySelector('[data-form="codigo"]');
        if (fc) fc.addEventListener('submit', (ev) => (ev.preventDefault(), this.entrar()));
        const fk = this.querySelector('[data-form="chave"]');
        if (fk) fk.addEventListener('submit', (ev) => (ev.preventDefault(), this.entrarChave()));
        const cod = this.querySelector('#conta-codigo');
        if (cod) cod.addEventListener('input', () => (cod.value = cod.value.replace(/\D/g, '').slice(0, 6)));
    }

    async acao(nome, botao) {
        if (nome === 'gerar') return this.gerar();
        if (nome === 'com-email') {
            this.vincular = false;
            return this.ir('email');
        }
        if (nome === 'add-email') {
            this.vincular = true;
            return this.ir('email');
        }
        if (nome === 'com-chave') return this.ir('chave-entrar');
        if (nome === 'voltar-inicio') return this.ir(estadoConta().fase === 'ligada' ? 'ligada' : 'inicio');
        if (nome === 'voltar') return this.ir(this.vincular ? 'ligada' : 'inicio');
        if (nome === 'concluir') return this.ir('ligada');
        if (nome === 'copiar') {
            const ok = await copiarTexto(this.chave || verChave());
            return avisar(ok ? T.copiada : T.naoCopiou);
        }
        if (nome === 'ver-chave') {
            this.mostrarChave = !this.mostrarChave;
            return this.desenhar(false);
        }
        if (nome === 'nova-chave') return this.novaChave(botao);
        if (nome === 'trocar-email') return this.ir('email');
        if (nome === 'reenviar') return this.enviarCodigo(true);
        if (nome === 'entrar-de-novo') {
            this.vincular = false;
            return this.ir(estadoConta().temChave ? 'chave-entrar' : 'email');
        }
        if (nome === 'duas') return this.ficarComAsDuas();
        if (nome === 'juntar') return this.juntar();
        if (nome === 'descartar') return this.descartarAqui(botao);
        if (nome === 'cancelar-login') {
            await sair();
            return this.ir('inicio');
        }
        if (nome === 'outra') {
            const id = criarContaLocal();
            if (!id) {
                this.erro = T.erros.servidor;
                return this.desenhar(false);
            }
            return trocarConta(id);
        }
        if (nome === 'remover') return this.removerEsta(botao);
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

    /* ---------- criar e entrar ---------- */

    async gerar() {
        this.ocupado = true;
        this.erro = '';
        this.desenhar(false);
        try {
            const r = await gerarChave();
            this.ocupado = false;
            this.chave = r.chave;
            return this.ir(r.nova ? 'chave-nova' : 'ligada');
        } catch (e) {
            this.ocupado = false;
            this.erro = this.erroTexto(motivoDoErro(e), e.extra);
            return this.desenhar(false);
        }
    }

    async novaChave(gatilho) {
        const sim = await confirmar({ titulo: T.novaChaveTitulo, corpo: T.novaChaveCorpo, sim: T.novaChaveSim, perigo: false, gatilho });
        if (!sim) return undefined;
        try {
            this.chave = await gerarNovaChave();
            return this.ir('chave-nova');
        } catch (e) {
            this.erro = this.erroTexto(motivoDoErro(e), e.extra);
            return this.desenhar(false);
        }
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

    /** Conta ja ligada: o login entra como conta nova no aparelho (nunca mexe na que esta em uso). Senao, liga esta. */
    destino() {
        return estadoConta().servidorId ? 'nova' : 'esta';
    }

    async entrar() {
        const campo = this.querySelector('#conta-codigo');
        const codigo = campo ? campo.value.trim() : '';
        if (!/^\d{6}$/.test(codigo)) {
            this.erro = T.erros.codigo_invalido;
            return this.desenhar();
        }
        try {
            if (this.vincular) {
                await confirmarCodigo(this.email, codigo, { destino: 'vincular' });
                clearInterval(this.contador);
                this.vincular = false;
                avisar('E-mail adicionado.');
                return this.ir('ligada');
            }
            const r = await confirmarCodigo(this.email, codigo, { destino: this.destino() });
            clearInterval(this.contador);
            return this.depoisDeEntrar(r);
        } catch (e) {
            this.erro = this.erroTexto(motivoDoErro(e), e.extra);
            return this.desenhar();
        }
    }

    async entrarChave() {
        const campo = this.querySelector('#conta-chave');
        const frase = campo ? campo.value.trim() : '';
        if (!frase) {
            this.erro = T.erros.chave_invalida;
            return this.desenhar();
        }
        this.ocupado = true;
        try {
            const r = await entrarComChave(frase, { destino: this.destino() });
            this.ocupado = false;
            return this.depoisDeEntrar(r);
        } catch (e) {
            this.ocupado = false;
            this.erro = this.erroTexto(motivoDoErro(e), e.extra);
            return this.desenhar();
        }
    }

    /** Entrou numa conta do servidor: decide sozinho quando nao ha o que perguntar. */
    async depoisDeEntrar(r) {
        if (r && r.contaLocal) return trocarConta(r.contaLocal); // conta nova no aparelho: vai para ela
        return this.retomar();
    }

    /** A conta local esta ligada a uma conta do servidor e espera juntar: sem registros de um dos lados, liga direto; senao pergunta. */
    async retomar() {
        const e = estadoConta();
        if (e.fase === 'ligada') return this.ir('ligada');
        this.resumo = null;
        this.ir('escolha');
        try {
            this.resumo = await resumoParaJuntar();
            this.erro = '';
        } catch (err) {
            this.erro = this.erroTexto(motivoDoErro(err));
            return this.desenhar(false);
        }
        if (soTotal(this.resumo.aqui) === 0 || soTotal(this.resumo.naConta) === 0) return this.juntar(); // nada a perguntar
        return this.desenhar(false);
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
        return this.ir('ligada');
    }

    ficarComAsDuas() {
        try {
            return trocarConta(moverLigacaoParaNovaConta());
        } catch (e) {
            this.erro = this.erroTexto(motivoDoErro(e));
            return this.desenhar(false);
        }
    }

    async descartarAqui(gatilho) {
        const sim = await confirmar({ titulo: T.descartarTitulo, corpo: T.descartarCorpo, sim: T.descartarSim, gatilho });
        if (!sim) return undefined;
        apagarRegistrosLocais();
        return this.juntar();
    }

    /* ---------- contas do aparelho ---------- */

    async removerEsta(gatilho) {
        const e = estadoConta();
        const corpo = e.email ? T.removerEmail : e.servidorId ? T.removerChave : T.removerLocal;
        const sim = await confirmar({ titulo: T.removerTitulo, corpo, sim: T.removerSim, gatilho });
        if (!sim) return undefined;
        try {
            if (e.servidorId) await sair();
        } catch (err) {
            /* sem rede: a conta sai do aparelho do mesmo jeito */
        }
        return removerContaLocal(contaAtiva());
    }

    async tirarOutra(id, gatilho) {
        const e = lerEstado(id);
        const corpo = e.email ? T.removerEmail : e.servidorId ? T.removerChave : T.removerLocal;
        const sim = await confirmar({ titulo: T.removerTitulo, corpo, sim: T.removerSim, gatilho });
        if (!sim) return undefined;
        removerContaLocal(id);
        return this.desenhar(false);
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

    async confirmarApagar(gatilho) {
        const sim = await confirmar({ titulo: T.apagarTitulo, corpo: T.apagarCorpo, sim: T.apagarSim, gatilho });
        if (!sim) return undefined;
        try {
            await apagarDadosDoServidor();
        } catch (e) {
            this.erro = this.erroTexto(motivoDoErro(e));
            return this.desenhar(false);
        }
        avisar(T.apagado);
        return this.ir('inicio');
    }
}

customElements.define('conta-panel', ContaPanel);
