import { navigateTo, consumirEstado, focarCabecalho } from '../utils/navigation.js';
import { gl, ic } from '../utils/glifos.js';
import { baixarBackup } from '../utils/backup.js';
import { apagarMapaComDesfazer } from './desfazerMapa.js';
import { avisar } from './Sobreposicao.js';
import { abrirMenuAcoes } from './menuAcoes.js';
import { loadCards } from '../utils/cardsUtil.js';
import { listar, principal, apelido, importar, persiste, aoMudar, LIMITE_ARQUIVO } from '../utils/perfil.js';
import { carregarTextos, texto, esc, calcular, dataExtenso, grauTexto, SIGNO_ELEMENTO } from '../utils/mapaComum.js';
import('./TarotCardInfo.js');

/* Textos que ainda nao tem id em textos.json (a interface criada para o Perfil). */
const T = {
    eyebrow: 'Neste aparelho',
    titulo: 'Perfil',
    ler: 'Ler o meu mapa',
    lerEste: 'Ler este mapa',
    outros: 'Mapas de outras pessoas',
    outrosVazio: 'Guarde o mapa de quem você quer ler. Fica só neste aparelho.',
    ver: 'Ver',
    emExibicao: 'Em exibição',
    semHora: 'Sem hora',
    adicionar: 'Adicionar pessoa',
    apelido: 'Apelido',
    data: 'Data',
    hora: 'Hora',
    cidade: 'Cidade',
    editarMeus: 'Editar meus dados',
    editarEste: 'Editar este mapa',
    editar: 'Editar',
    apagarMeus: 'Apagar meus dados',
    apagarEste: 'Apagar este mapa',
    apagar: 'Apagar',
    tema: 'Tema',
    mudarTema: 'Mudar o tema',
    privacidade: 'Privacidade e backup',
    exportar: 'Exportar tudo',
    importar: 'Importar',
    importarBackup: 'Importar um backup',
    naoCalculado: 'Não calculado',
    semAsc: 'Sem a hora, sem Ascendente',
    guardadoOk: 'Mapa guardado neste aparelho.',
    repetidoOk: 'Esse mapa já estava guardado. Nada foi duplicado.',
    semHoraTitulo: 'Mapa sem hora de nascimento',
    latAltaTitulo: 'Local em latitude alta',
    semArmazenamento: 'Este navegador não deixa guardar dados. O perfil vale só enquanto esta página estiver aberta.',
    exportado: 'Backup baixado. Guarde o arquivo em um lugar seguro, ele traz apelido, data, hora e lugar de nascimento.',
    erroExportar: 'Não foi possível gerar o backup.',
    erroLer: 'Não foi possível ler o arquivo.',
    erroTamanho: 'O arquivo passa de 1 MB. Escolha um backup do Aeon Fool.',
    erroCarregar: 'Não foi possível carregar o mapa agora. Recarregue a página e tente de novo.',
    acoes: 'Ações',
    acoesTitulo: 'Ações do perfil',
    abas: 'Seções do perfil',
    grupoMapas: 'Mapas',
    grupoDados: 'Dados',
};
const ABAS = [['mapas', 'Mapas'], ['dados', 'Dados'], ['prefs', 'Preferências']];
let ABA_LEMBRADA = 'mapas';

const PAPEIS = { sol: 'Sol', lua: 'Lua', asc: 'Ascendente' };
const RODA_VAZIA = (() => {
    let s = '<svg class="roda-vazia" viewBox="-110 -110 220 220" aria-hidden="true" focusable="false"><circle class="rv-a" r="100"/><circle class="rv-a" r="76"/><circle class="rv-a" r="38"/>';
    for (let i = 0; i < 12; i++) {
        const a = (i * 30 * Math.PI) / 180;
        s += `<line class="rv-b" x1="${(Math.cos(a) * 76).toFixed(1)}" y1="${(Math.sin(a) * 76).toFixed(1)}" x2="${(Math.cos(a) * 100).toFixed(1)}" y2="${(Math.sin(a) * 100).toFixed(1)}"/>`;
    }
    return s + '</svg>';
})();

export class PerfilScreen extends HTMLElement {
    async connectedCallback() {
        this.estado = consumirEstado() || {};
        this.sel = this.estado.selecionar || null; // mapa de outra pessoa em exibicao (o principal fica sempre no cartao)
        this.aba = this.estado.aviso === 'dados' ? 'mapas' : ABA_LEMBRADA;
        this.calculos = new Map();
        this.status = '';
        this.innerHTML = '<div class="mapa-tela" aria-busy="true"></div>';
        try {
            [this.textos] = await Promise.all([carregarTextos(), loadCards()]);
        } catch (e) {
            this.textos = {};
        }
        if (!this.isConnected) return;
        this.desligar = aoMudar(() => {
            if (!(this.sobre && this.sobre.aberto)) this.desenhar();
        });
        this.observador = new MutationObserver(() => this.marcarTema());
        this.observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        await this.desenhar();
        focarCabecalho('#perfil-h1');
        const a = this.estado.aviso;
        if (a === 'dados') avisar(this.t('ui.meusdados.salvo', {}, 'Dados atualizados.'));
        else if (a === 'guardado') avisar(T.guardadoOk);
        else if (a === 'repetido') avisar(T.repetidoOk);
    }

    disconnectedCallback() {
        if (this.desligar) this.desligar();
        if (this.observador) this.observador.disconnect();
        if (this.sobre && this.sobre.aberto) this.sobre.fechar(false);
    }

    t(id, vars, padrao) {
        return texto(this.textos, id, vars, padrao);
    }

    async calculoDe(m) {
        const chave = `${m.id}|${m.data}|${m.hora}|${m.local.lat}|${m.local.lon}|${m.local.tz}|${m.escolha}|${m.casas}`;
        if (!this.calculos.has(chave)) this.calculos.set(chave, calcular(m).catch(() => null));
        return this.calculos.get(chave);
    }

    /** Itens do menu "Ações": o que vale para o mapa em exibição (ou para os meus dados) e para o perfil todo. */
    grupos(p, emV, total) {
        const mapas = [];
        if (emV) mapas.push({ id: 'editar', rot: T.editarEste, ic: 'editar' });
        else if (p) mapas.push({ id: 'meus-dados', rot: T.editarMeus, ic: 'editar' });
        mapas.push({ id: 'novo', rot: T.adicionar, ic: 'mais' });
        const g = [[T.grupoMapas, mapas], [T.grupoDados, [...(total ? [{ id: 'exportar', rot: T.exportar, ic: 'baixar' }] : []), { id: 'importar', rot: T.importar, ic: 'copiar' }]]];
        if (emV || p) g.push(['', [{ id: 'apagar', rot: emV ? T.apagarEste : T.apagarMeus, ic: 'lixo', perigo: true }]]);
        return g;
    }

    /** Cartao "Meus dados": o resumo do mapa principal, ou o convite unico para preencher. */
    meusDados(p, calc) {
        if (!p) {
            return `<section class="painel meus-dados convite" aria-labelledby="md-t">${RODA_VAZIA}<h2 id="md-t">${esc(this.t('ui.meusdados.convite.titulo'))}</h2><p>${esc(this.t('ui.meusdados.convite.texto'))}</p>
                <div class="btn-row"><button class="btn btn-primary" type="button" data-exec="meus-dados">${esc(this.t('ui.meusdados.preencher'))}</button></div></section>`;
        }
        const ap = apelido();
        const tres = calc
            ? `<div class="visita-tres">${this.ponto(calc.pontos.sol, 'sol')}${this.ponto(calc.pontos.lua, 'lua')}${this.ponto(p.hora ? calc.pontos.asc : null, 'asc')}</div>`
            : `<p class="aviso erro" role="alert" style="display:block">${T.erroCarregar}</p>`;
        return `<section class="painel meus-dados" aria-labelledby="md-t"><h2 id="md-t">${esc(this.t('ui.meusdados.titulo'))}</h2>
            <dl class="dl-grade"><div><dt>${T.apelido}</dt><dd>${esc(ap || this.t('ui.meusdados.sem-apelido'))}</dd></div><div><dt>${T.data}</dt><dd>${dataExtenso(p.data)}</dd></div><div><dt>${T.hora}</dt><dd>${esc(p.hora || this.t('ui.meusdados.sem-hora'))}</dd></div><div><dt>${T.cidade}</dt><dd>${esc(p.local.nome)}</dd></div></dl>
            ${tres}
            <div class="btn-row"><button class="btn btn-primary" type="button" data-acao="ler" data-id="${esc(p.id)}">${T.ler}</button><button class="btn btn-terciario" type="button" data-exec="meus-dados">${esc(this.t('ui.meusdados.editar'))}</button></div></section>`;
    }

    outros(outros, emV, calcV, p) {
        if (!p && !outros.length) return '';
        const lista = outros.length
            ? `<ul class="mapas-lista">${outros.map((x) => this.itemMapa(x, emV, calcV)).join('')}</ul>`
            : `<p class="mute">${T.outrosVazio}</p>`;
        return `<section class="mapas" aria-labelledby="mp-t"><h2 class="sec-titulo" id="mp-t">${T.outros}${outros.length ? ` <small>${outros.length}</small>` : ''}</h2>${lista}
            <div><button class="btn btn-terciario" type="button" data-exec="novo">${T.adicionar}</button></div></section>`;
    }

    painelMapas(p, calcP, outros, emV, calcV) {
        const lado = this.outros(outros, emV, calcV, p);
        return `<div class="perfil-grid${lado ? '' : ' so-um'}">${this.meusDados(p, calcP)}${lado}</div>`;
    }

    painelAba(dados) {
        if (this.aba === 'mapas') return this.painelMapas(...dados);
        if (this.aba === 'dados') return `<div class="info-grid">${this.painelPriv(!dados[0] && !dados[2].length)}</div>`;
        return `<div class="info-grid">${this.painelTema()}</div>`;
    }

    async desenhar(foco) {
        const p = principal();
        const outros = listar().filter((x) => !p || x.id !== p.id);
        if (this.sel && !outros.some((x) => x.id === this.sel)) this.sel = null;
        const emV = this.sel ? outros.find((x) => x.id === this.sel) : null;
        const calcP = p ? await this.calculoDe(p) : null;
        const calcV = emV ? await this.calculoDe(emV) : null;
        if (!this.isConnected) return;
        this.dados = { p, emV, total: outros.length + (p ? 1 : 0) };
        const ap = apelido();
        const topo = `
            <div class="perfil-topo">
                ${ap ? `<span class="avatar" aria-hidden="true">${esc([...ap][0].toUpperCase())}</span>` : `<span class="avatar vazio" aria-hidden="true">${ic('perfil')}</span>`}
                <div><span class="eyebrow">${T.eyebrow}</span><h1 id="perfil-h1" tabindex="-1">${T.titulo}</h1></div>
                <button class="btn btn-ghost" id="abrir-acoes" data-abrir-acoes type="button" aria-haspopup="dialog" aria-expanded="false">${ic('maisv')}${T.acoes}</button>
            </div>`;
        const abas = ABAS.map(([k, n]) => `<button class="mc-tab" type="button" role="tab" id="pt-${k}" aria-selected="${k === this.aba}" aria-controls="painel-perfil" data-aba="${k}" tabindex="${k === this.aba ? 0 : -1}">${n}</button>`).join('');
        const alvo = emV || p;
        this.innerHTML = `<div class="mapa-tela perfil-c">${topo}
            <div data-avisos>${this.avisos(alvo, emV ? calcV : calcP)}</div>
            <p class="diario-aviso" role="status" aria-live="polite" data-status>${esc(this.status || (persiste() ? '' : T.semArmazenamento))}</p>
            <div class="mc-tabs perfil-tabs" role="tablist" aria-label="${T.abas}">${abas}</div>
            <div id="painel-perfil" role="tabpanel" aria-labelledby="pt-${this.aba}" tabindex="0" class="mc-painel">${this.painelAba([p, calcP, outros, emV, calcV])}</div>
            <input type="file" accept="application/json,.json" hidden data-arquivo></div>`;
        this.ligar();
        this.marcarTema();
        if (foco) {
            const el = this.querySelector(foco);
            if (el) el.focus({ preventScroll: false });
        }
    }

    /* ---------- pecas ---------- */

    aviso(tipo, icone, titulo, corpo) {
        return `<section class="aviso ${tipo}" role="${tipo === 'atencao' || tipo === 'erro' ? 'alert' : 'status'}">${ic(icone)}<h3>${esc(titulo)}</h3><div><p>${esc(corpo)}</p></div></section>`;
    }

    avisos(m, calc) {
        if (!this.estado.aviso || !m || !calc) return '';
        let h = '';
        if (!m.hora) h += this.aviso('atencao', 'relogio', T.semHoraTitulo, this.t('ui.aviso.semhora'));
        if (calc.casas && calc.casas.sistema === 'signos-inteiros' && calc.casas.solicitado !== 'signos-inteiros') {
            h += this.aviso('info', 'info', T.latAltaTitulo, this.t('ui.aviso.latalta'));
        }
        return h;
    }

    ponto(p, papel) {
        if (!p) {
            return `<div class="vcarta sem"><span class="papel">${gl('asc')}${PAPEIS[papel]}</span><div class="img"><span>${T.semAsc}</span></div><span class="sg">${T.naoCalculado}</span><span class="gr">&nbsp;</span></div>`;
        }
        const c = p.ponte && p.ponte.cartaDecano;
        const nome = c ? c.nome : '';
        const img = c
            ? `<button class="img" type="button" data-carta="${c.order}" aria-label="Abrir a carta ${esc(nome)}" style="padding:0;border:0;cursor:pointer"><img src="assets/cards/crowley-${String(c.order).padStart(2, '0')}.jpg" alt="${esc(nome)}, carta do ${p.decano}º decano" width="274" height="410" loading="lazy" decoding="async"></button>`
            : '<div class="img"></div>';
        return `<div class="vcarta el-${SIGNO_ELEMENTO[p.signo]}"><span class="papel">${gl(papel)}${PAPEIS[papel]}</span>${img}
            <span class="sg">${gl(p.signo)}${esc(p.signoNome)}</span><span class="gr">${grauTexto(p)}</span><span class="dc">${esc(nome)}<br>${p.decano}º decano</span></div>`;
    }

    /** Item da lista de outras pessoas. O que esta em exibicao abre o resumo logo abaixo, com contorno de acento. */
    itemMapa(x, emV, calcV) {
        const s = !!emV && x.id === emV.id;
        const corpo = s
            ? `<div class="mi-corpo">${calcV ? `<div class="visita-tres">${this.ponto(calcV.pontos.sol, 'sol')}${this.ponto(calcV.pontos.lua, 'lua')}${this.ponto(x.hora ? calcV.pontos.asc : null, 'asc')}</div>` : `<p class="aviso erro" role="alert" style="display:block">${T.erroCarregar}</p>`}
                <div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="ler" data-id="${esc(x.id)}">${T.lerEste}</button><button class="btn btn-terciario" type="button" data-exec="editar">${T.editar}</button></div></div>`
            : '';
        return `<li class="mapa-item${s ? ' sel' : ''}"><div class="mi-topo"><div class="t"><span class="rot">${esc(x.rotulo)}</span><span class="res" data-res="${esc(x.id)}"></span></div>
            <button class="btn btn-terciario ver" type="button" data-ver="${esc(x.id)}" aria-pressed="${s}">${s ? T.emExibicao : T.ver}<span class="sr"> ${esc(x.rotulo)}</span></button></div>${corpo}</li>`;
    }

    painelTema() {
        return `<section class="painel" aria-labelledby="tm-t"><h3 id="tm-t">${T.tema}</h3><p>Agora: <strong style="color:var(--text)" data-tema-nome></strong>. A escolha vale para o site todo.</p>
            <div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="tema" aria-haspopup="dialog">${ic('tema')}${T.mudarTema}</button></div></section>`;
    }

    painelPriv(vazio) {
        return `<section class="painel" aria-labelledby="pv-t"><div class="p-icon">${ic('cadeado')}<h3 id="pv-t">${T.privacidade}</h3></div><p>${esc(this.t('ui.aviso.privacidade'))}</p>
            <div class="btn-row"><button class="btn btn-ghost" type="button" data-exec="exportar" aria-describedby="d-exp"${vazio ? ' disabled' : ''}>${ic('baixar')}${T.exportar}</button><button class="btn btn-ghost" type="button" data-exec="importar" aria-describedby="d-imp">${ic('copiar')}${T.importarBackup}</button></div>
            <p class="nota-geonames" id="d-exp">${esc(this.t('ui.dados.exportar'))}</p><p class="nota-geonames" id="d-imp">${esc(this.t('ui.dados.importar'))}</p></section>`;
    }

    marcarTema() {
        const t = document.documentElement.getAttribute('data-theme');
        this.querySelectorAll('[data-tema-nome]').forEach((e) => (e.textContent = t === 'aurora' ? 'Aurora' : 'Crepúsculo'));
    }

    dizer(msg) {
        this.status = msg;
        const el = this.querySelector('[data-status]');
        if (el) el.textContent = msg;
    }

    /* ---------- eventos ---------- */

    ligar() {
        // resumo curto (Sol, Lua e Ascendente) de cada pessoa da lista, calculado sob demanda sem travar a tela
        listar().forEach(async (x) => {
            const alvo = this.querySelector(`[data-res="${CSS.escape(x.id)}"]`);
            if (!alvo) return;
            const c = await this.calculoDe(x);
            if (!c || !this.isConnected) return;
            const lin = (id, papel) => `<span><span class="sr">${PAPEIS[papel]} em </span>${gl(papel)}${esc(c.pontos[id].signoNome)}</span>`;
            alvo.innerHTML = lin('sol', 'sol') + lin('lua', 'lua') + (x.hora ? lin('asc', 'asc') : `<span class="mute">${T.semHora}</span>`);
        });

        this.querySelectorAll('[data-ver]').forEach((b) =>
            b.addEventListener('click', () => {
                this.sel = this.sel === b.dataset.ver ? null : b.dataset.ver;
                this.estado = {};
                this.desenhar(`[data-ver="${CSS.escape(b.dataset.ver)}"]`);
            }),
        );
        this.querySelectorAll('[data-carta]').forEach((b) =>
            b.addEventListener('click', async () => {
                const lista = await loadCards();
                const carta = lista.find((c) => Number(c.order) === Number(b.dataset.carta));
                const info = document.querySelector('tarot-card-info');
                if (carta && info) info.showInfo(carta, b);
            }),
        );
        const acao = (nome, fn) => this.querySelectorAll(`[data-acao="${nome}"]`).forEach((b) => b.addEventListener('click', () => fn(b)));
        acao('ler', (b) => navigateTo('mapa', { id: b.dataset.id }));
        acao('tema', () => {
            const b = document.querySelector('.topbar .themebtn');
            if (b) b.click();
        });
        this.querySelectorAll('[data-exec]').forEach((b) => b.addEventListener('click', () => this.executar(b.dataset.exec, b)));
        this.querySelectorAll('[data-abrir-acoes]').forEach((b) => b.addEventListener('click', () => this.abrirAcoes(b)));
        this.querySelectorAll('.mc-tab').forEach((t) => {
            t.addEventListener('click', () => this.trocarAba(t.dataset.aba));
            t.addEventListener('keydown', (e) => {
                const abas = [...this.querySelectorAll('.mc-tab')];
                const i = abas.indexOf(t);
                let j = -1;
                if (e.key === 'ArrowRight') j = (i + 1) % abas.length;
                else if (e.key === 'ArrowLeft') j = (i + abas.length - 1) % abas.length;
                else if (e.key === 'Home') j = 0;
                else if (e.key === 'End') j = abas.length - 1;
                if (j < 0) return;
                e.preventDefault();
                this.trocarAba(abas[j].dataset.aba, true);
            });
        });
        const arquivo = this.querySelector('[data-arquivo]');
        arquivo.addEventListener('change', async () => {
            const f = arquivo.files && arquivo.files[0];
            arquivo.value = '';
            if (!f) return;
            if (f.size > LIMITE_ARQUIVO) return this.dizer(T.erroTamanho);
            let txt;
            try {
                txt = await f.text();
            } catch (e) {
                return this.dizer(T.erroLer);
            }
            const r = importar(txt);
            const msg = !r.ok && !r.mapas && !r.diario
                ? r.motivo || 'Não foi possível importar.'
                : this.resumoImportacao(r);
            this.status = msg;
            this.estado = {};
            await this.desenhar();
            this.dizer(msg);
        });
    }

    executar(id) {
        const { p, emV } = this.dados;
        if (id === 'novo') navigateTo('novo-mapa');
        else if (id === 'meus-dados') navigateTo('novo-mapa', p ? { editar: p.id } : { meusDados: true });
        else if (id === 'editar' && emV) navigateTo('novo-mapa', { editar: emV.id });
        else if (id === 'exportar') this.dizer(baixarBackup() ? T.exportado : T.erroExportar);
        else if (id === 'importar') this.querySelector('[data-arquivo]').click();
        else if (id === 'apagar') this.apagarMapa();
    }

    abrirAcoes(botao) {
        const { p, emV, total } = this.dados;
        this.sobre = abrirMenuAcoes({ botao, titulo: T.acoesTitulo, grupos: this.grupos(p, emV, total), aoEscolher: (id) => this.executar(id) });
    }

    trocarAba(id, foco) {
        if (id === this.aba) return;
        this.aba = id;
        ABA_LEMBRADA = id;
        this.desenhar(foco ? `#pt-${id}` : null);
    }

    apagarMapa() {
        const { p, emV } = this.dados;
        const alvo = emV || p;
        if (!alvo || !apagarMapaComDesfazer(alvo.id)) return;
        this.sel = null;
        this.estado = {};
        this.desenhar('#perfil-h1');
    }

    resumoImportacao(r) {
        const n = (k, um, varios) => `${k} ${k === 1 ? um : varios}`;
        let s = `${n(r.mapas, 'mapa importado', 'mapas importados')}`;
        if (r.repetidos) s += `, ${n(r.repetidos, 'já estava aqui', 'já estavam aqui')}`;
        if (r.diario) s += `. Diário: ${n(r.diario.importadas, 'entrada importada', 'entradas importadas')}`;
        if (r.ignorados) s += `. ${n(r.ignorados, 'item ignorado', 'itens ignorados')} por não servir`;
        return `${s}.`;
    }
}

customElements.define('perfil-screen', PerfilScreen);
