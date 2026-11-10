import { navigateTo, consumirEstado } from '../utils/navigation.js';
import { gl, ic } from '../utils/glifos.js';
import { dataLocal } from '../utils/cartaDoDia.js';
import { loadCards } from '../utils/cardsUtil.js';
import {
    listar, obter, apelido, definirApelido, apagar, exportar, importar, persiste, aoMudar,
    LIMITE_APELIDO, LIMITE_ARQUIVO,
} from '../utils/perfil.js';
import { carregarTextos, texto, esc, calcular, dataExtenso, dataCurta, grauTexto, SIGNO_ELEMENTO } from '../utils/mapaComum.js';
import('./TarotCardInfo.js');

/* Textos que ainda nao tem id em textos.json (a interface criada para o Perfil). */
const T = {
    eyebrow: 'Perfil neste aparelho',
    semApelido: 'Seu perfil',
    apelido: 'Apelido',
    editarApelido: 'Editar o apelido',
    escolherApelido: 'Escolher um apelido',
    apelidoRotulo: 'Como quer ser chamado',
    salvar: 'Salvar',
    cancelar: 'Cancelar',
    visita: 'Carta de visita',
    ler: 'Ler o meu mapa',
    roda: 'Ver a roda',
    guardados: 'Mapas guardados',
    meu: 'Meu',
    emExibicao: 'Em exibição',
    ver: 'Ver',
    guardadoEm: 'Guardado em',
    semHora: 'Sem hora',
    dica: 'Para trocar de mapa, toque em Ver. A carta de visita e os dados mudam para o mapa escolhido. O primeiro é o seu.',
    adicionar: 'Adicionar um mapa',
    dados: 'Dados de nascimento',
    mapa: 'Mapa', data: 'Data', hora: 'Hora', local: 'Local',
    editar: 'Editar dados',
    apagarEste: 'Apagar este mapa',
    tema: 'Tema',
    mudarTema: 'Mudar o tema',
    privacidade: 'Privacidade e backup',
    exportar: 'Exportar tudo',
    importar: 'Importar',
    importarBackup: 'Importar um backup',
    calculeTitulo: 'Calcule o seu mapa',
    naoCalculado: 'Não calculado',
    semAsc: 'Sem a hora, sem Ascendente',
    guardadoTitulo: 'Mapa guardado no perfil',
    guardadoTexto: 'Ele ficou só neste aparelho. Para levar a outro, use Exportar tudo aqui no perfil.',
    repetidoTitulo: 'Esse mapa já estava guardado',
    repetidoTexto: 'Mesma data, hora e lugar: o mapa existente foi mantido, sem duplicar.',
    semHoraTitulo: 'Mapa sem hora de nascimento',
    latAltaTitulo: 'Local em latitude alta',
    inexistenteTitulo: 'A hora informada não existiu',
    ambiguaTitulo: 'Essa hora aconteceu duas vezes',
    semArmazenamento: 'Este navegador não deixa guardar dados. O perfil vale só enquanto esta página estiver aberta.',
    exportado: 'Backup baixado. Guarde o arquivo em um lugar seguro, ele traz datas, horas e lugares de nascimento.',
    erroExportar: 'Não foi possível gerar o backup.',
    erroLer: 'Não foi possível ler o arquivo.',
    erroTamanho: 'O arquivo passa de 1 MB. Escolha um backup do Aeon Fool.',
    erroCarregar: 'Não foi possível carregar o mapa agora. Recarregue a página e tente de novo.',
    apagado: 'Mapa apagado.',
};

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
        this.sel = this.estado.selecionar || null;
        this.confirmando = false;
        this.editandoApelido = false;
        this.calculos = new Map();
        this.status = '';
        this.innerHTML = '<div class="mapa-tela" aria-busy="true"></div>';
        try {
            [this.textos] = await Promise.all([carregarTextos(), loadCards()]);
        } catch (e) {
            this.textos = {};
            this.falhou = true;
        }
        if (!this.isConnected) return;
        this.desligar = aoMudar(() => {
            if (!this.editandoApelido && !this.confirmando) this.desenhar();
        });
        this.observador = new MutationObserver(() => this.marcarTema());
        this.observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        await this.desenhar();
    }

    disconnectedCallback() {
        if (this.desligar) this.desligar();
        if (this.observador) this.observador.disconnect();
    }

    t(id, vars, padrao) {
        return texto(this.textos, id, vars, padrao);
    }

    selecionado(mapas) {
        const m = mapas.find((x) => x.id === this.sel) || mapas.find((x) => x.principal) || mapas[0] || null;
        this.sel = m ? m.id : null;
        return m;
    }

    async calculoDe(m) {
        const chave = `${m.id}|${m.data}|${m.hora}|${m.local.lat}|${m.local.lon}|${m.local.tz}|${m.escolha}`;
        if (!this.calculos.has(chave)) this.calculos.set(chave, calcular(m).catch(() => null));
        return this.calculos.get(chave);
    }

    async desenhar(foco) {
        const mapas = listar();
        const m = this.selecionado(mapas);
        const calc = m ? await this.calculoDe(m) : null;
        if (!this.isConnected) return;
        const ap = apelido();
        const topo = `
            <div class="perfil-topo">
                ${ap ? `<span class="avatar" aria-hidden="true">${esc([...ap][0].toUpperCase())}</span>` : `<span class="avatar vazio" aria-hidden="true">${ic('perfil')}</span>`}
                <div><span class="eyebrow">${T.eyebrow}</span><h1 id="perfil-h1" tabindex="-1">${esc(ap || T.semApelido)}</h1></div>
                <button class="btn btn-ghost" type="button" data-acao="apelido" aria-expanded="${this.editandoApelido}" aria-controls="apelido-box">${ic('editar')}<span>${T.apelido}</span><span class="sr">${ap ? T.editarApelido : T.escolherApelido}</span></button>
            </div>
            <div id="apelido-box" ${this.editandoApelido ? '' : 'hidden'}>${this.editandoApelido ? this.formApelido(ap) : ''}</div>`;
        const avisos = this.avisos(m, calc);
        let corpo;
        if (!m) {
            corpo = `<section class="vazio-mapa" aria-labelledby="vz-t">${RODA_VAZIA}<h2 id="vz-t">${T.calculeTitulo}</h2><p>${esc(this.t('ui.vazio', {}, ''))}</p>
                <div class="btn-row"><button class="btn btn-primary" type="button" data-acao="novo">${esc(this.t('ui.btn.calcular', {}, 'Montar o mapa astral'))}</button><button class="btn btn-ghost" type="button" data-acao="importar">${T.importarBackup}</button></div></section>
                <div class="info-grid">${this.painelTema()}${this.painelPriv(true)}</div>`;
        } else {
            corpo = `<div class="perfil-grid"><div id="visita-box">${this.visita(m, calc)}</div>
                <section class="mapas" aria-labelledby="mp-t"><h2 class="sec-titulo" id="mp-t">${T.guardados} <small>${mapas.length} ${mapas.length === 1 ? 'mapa' : 'mapas'}</small></h2>
                <ul class="mapas-lista">${mapas.map((x) => this.itemMapa(x, m)).join('')}</ul>
                <p class="mapas-dica">${ic('info')}<span>${T.dica}</span></p>
                <button class="btn btn-ghost" type="button" data-acao="novo">${ic('mais')}${T.adicionar}</button></section></div>
                <div class="info-grid info3">${this.painelDados(m)}${this.painelTema()}${this.painelPriv(false)}</div>`;
        }
        this.innerHTML = `<div class="mapa-tela">${topo}
            <div data-avisos>${avisos}</div>
            <p class="diario-aviso" role="status" aria-live="polite" data-status>${esc(this.status || (persiste() ? '' : T.semArmazenamento))}</p>
            ${corpo}
            <input type="file" accept="application/json,.json" hidden data-arquivo></div>`;
        this.ligar();
        this.marcarTema();
        if (foco) {
            const el = this.querySelector(foco);
            if (el) el.focus({ preventScroll: false });
        }
    }

    /* ---------- pecas ---------- */

    aviso(tipo, icone, titulo, corpo, extra = '') {
        return `<section class="aviso ${tipo}" role="${tipo === 'atencao' || tipo === 'erro' ? 'alert' : 'status'}">${ic(icone)}<h3>${esc(titulo)}</h3><div><p>${esc(corpo)}</p></div>${extra}</section>`;
    }

    avisos(m, calc) {
        const a = this.estado.aviso;
        if (!a || !m || m.id !== this.sel) return '';
        let h = '';
        if (a === 'guardado') h += this.aviso('ok', 'ok', T.guardadoTitulo, T.guardadoTexto);
        if (a === 'repetido') h += this.aviso('info', 'info', T.repetidoTitulo, T.repetidoTexto);
        if (calc && !m.hora) h += this.aviso('atencao', 'relogio', T.semHoraTitulo, this.t('ui.aviso.semhora'));
        if (calc && calc.casas && calc.casas.sistema === 'signos-inteiros' && calc.casas.solicitado !== 'signos-inteiros') {
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

    visita(m, calc) {
        if (!calc) {
            return `<section class="visita"><p class="aviso erro" role="alert" style="display:block">${T.erroCarregar}</p></section>`;
        }
        const p = calc.pontos;
        return `<section class="visita" aria-labelledby="vis-t"><div class="visita-cab"><span class="eyebrow">${T.visita}</span><h2 class="nome" id="vis-t">${esc(m.rotulo)}</h2></div>
            <div class="visita-tres">${this.ponto(p.sol, 'sol')}${this.ponto(p.lua, 'lua')}${this.ponto(m.hora ? p.asc : null, 'asc')}</div>
            <div class="visita-acoes"><button class="btn btn-primary" type="button" data-acao="ler">${T.ler}</button><button class="btn btn-ghost" type="button" data-acao="roda">${ic('roda')}${T.roda}</button></div></section>`;
    }

    itemMapa(x, sel) {
        const s = x.id === sel.id;
        return `<li class="mapa-item${s ? ' sel' : ''}"><span class="avatar p${x.principal ? '' : ' o'}" aria-hidden="true">${esc([...x.rotulo][0].toUpperCase())}</span>
            <div class="t"><span class="rot">${esc(x.rotulo)}${x.principal ? `<span class="tag">${T.meu}</span>` : ''}</span><span class="res" data-res="${esc(x.id)}"></span>
            <span class="dt">${T.guardadoEm} ${dataCurta(x.criado) || '—'}</span></div>
            <button class="ver" type="button" data-ver="${esc(x.id)}" aria-pressed="${s}">${s ? T.emExibicao : T.ver}<span class="sr"> ${esc(x.rotulo)}</span></button></li>`;
    }

    painelDados(m) {
        if (this.confirmando) {
            return `<section class="painel diario-confirma" role="alertdialog" aria-labelledby="ap-t" aria-describedby="ap-d" style="grid-column:1/-1"><h3 id="ap-t" tabindex="-1">Apagar o mapa de ${esc(m.rotulo)}?</h3><p id="ap-d">${esc(this.t('ui.apagar.confirma'))}</p>
                <div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="manter">${esc(this.t('ui.apagar.cancela', {}, 'Cancelar'))}</button><button class="btn btn-perigo" type="button" data-acao="apagar-sim">${esc(this.t('ui.apagar.btn', {}, 'Apagar o mapa'))}</button></div></section>`;
        }
        return `<section class="painel" aria-labelledby="db-t"><h3 id="db-t">${T.dados}</h3><dl class="dl"><div><dt>${T.mapa}</dt><dd>${esc(m.rotulo)}</dd></div><div><dt>${T.data}</dt><dd>${dataExtenso(m.data)}</dd></div><div><dt>${T.hora}</dt><dd>${m.hora || T.semHora}</dd></div><div><dt>${T.local}</dt><dd>${esc(m.local.nome)}</dd></div></dl>
            <div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="editar">${ic('editar')}${T.editar}</button><button class="btn btn-perigo" type="button" data-acao="apagar" aria-expanded="false">${ic('lixo')}${T.apagarEste}</button></div></section>`;
    }

    painelTema() {
        return `<section class="painel" aria-labelledby="tm-t"><h3 id="tm-t">${T.tema}</h3><p>Agora: <strong style="color:var(--text)" data-tema-nome></strong>. A escolha vale para o site todo.</p>
            <div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="tema" aria-haspopup="dialog">${ic('tema')}${T.mudarTema}</button></div></section>`;
    }

    painelPriv(vazio) {
        return `<section class="painel" aria-labelledby="pv-t"><div class="p-icon">${ic('cadeado')}<h3 id="pv-t">${T.privacidade}</h3></div><p>${esc(this.t('ui.aviso.privacidade'))}</p>
            <div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="exportar" aria-describedby="d-exp"${vazio ? ' disabled' : ''}>${ic('baixar')}${T.exportar}</button><button class="btn btn-ghost" type="button" data-acao="importar" aria-describedby="d-imp">${ic('copiar')}${T.importar}</button></div>
            <p class="nota-geonames" id="d-exp">${esc(this.t('ui.dados.exportar'))}</p><p class="nota-geonames" id="d-imp">${esc(this.t('ui.dados.importar'))}</p></section>`;
    }

    formApelido(ap) {
        return `<form class="apelido-form" data-form-apelido novalidate><div class="campo"><label class="rot" for="apelido-in">${T.apelidoRotulo} <span class="opc">(opcional)</span></label>
            <input class="entrada" id="apelido-in" maxlength="${LIMITE_APELIDO}" autocomplete="off" value="${esc(ap)}"></div>
            <div class="btn-row"><button class="btn btn-primary" type="submit">${T.salvar}</button><button class="btn btn-ghost" type="button" data-acao="apelido-cancela">${T.cancelar}</button></div></form>`;
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
        // resumo Sol, Lua e Ascendente de cada mapa da lista (calculado sob demanda, sem travar a tela)
        listar().forEach(async (x) => {
            const alvo = this.querySelector(`[data-res="${CSS.escape(x.id)}"]`);
            const c = await this.calculoDe(x);
            if (!alvo || !c || !this.isConnected) return;
            const lin = (id, papel) => {
                const p = c.pontos[id];
                return `<span><span class="sr">${PAPEIS[papel]} em </span>${gl(papel)}${esc(p.signoNome)} ${p.grauInteiro}°</span>`;
            };
            alvo.innerHTML = lin('sol', 'sol') + lin('lua', 'lua') + (x.hora ? lin('asc', 'asc') : `<span>${T.semHora}</span>`);
        });

        this.querySelectorAll('[data-ver]').forEach((b) =>
            b.addEventListener('click', () => {
                this.sel = b.dataset.ver;
                this.estado = {};
                this.confirmando = false;
                this.desenhar(`[data-ver="${CSS.escape(this.sel)}"]`);
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
        const acao = (nome, fn) => this.querySelectorAll(`[data-acao="${nome}"]`).forEach((b) => b.addEventListener('click', fn));
        acao('novo', () => navigateTo('novo-mapa'));
        acao('editar', () => navigateTo('novo-mapa', { editar: this.sel }));
        acao('ler', () => navigateTo('mapa', { id: this.sel }));
        acao('roda', () => navigateTo('mapa', { id: this.sel }));
        acao('tema', () => {
            const b = document.querySelector('.topbar .themebtn');
            if (b) b.click();
        });
        acao('apagar', () => {
            this.confirmando = true;
            this.desenhar('#ap-t');
        });
        acao('manter', () => {
            this.confirmando = false;
            this.desenhar('[data-acao="apagar"]');
        });
        acao('apagar-sim', () => {
            const ok = apagar(this.sel);
            this.confirmando = false;
            this.sel = null;
            this.estado = {};
            this.status = ok ? T.apagado : T.erroExportar;
            this.desenhar('#perfil-h1');
        });
        acao('apelido', () => {
            this.editandoApelido = !this.editandoApelido;
            this.desenhar(this.editandoApelido ? '#apelido-in' : '[data-acao="apelido"]');
        });
        acao('apelido-cancela', () => {
            this.editandoApelido = false;
            this.desenhar('[data-acao="apelido"]');
        });
        const fa = this.querySelector('[data-form-apelido]');
        if (fa) {
            fa.addEventListener('submit', (e) => {
                e.preventDefault();
                definirApelido(fa.querySelector('input').value);
                this.editandoApelido = false;
                this.desenhar('[data-acao="apelido"]');
            });
            fa.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.querySelector('[data-acao="apelido-cancela"]').click();
            });
        }
        const conf = this.querySelector('[role="alertdialog"]');
        if (conf) {
            conf.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.querySelector('[data-acao="manter"]').click();
            });
        }

        acao('exportar', () => {
            try {
                const blob = new Blob([JSON.stringify(exportar(), null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `aeon-backup-${dataLocal()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                this.dizer(T.exportado);
            } catch (e) {
                this.dizer(T.erroExportar);
            }
        });
        const arquivo = this.querySelector('[data-arquivo]');
        acao('importar', () => arquivo.click());
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
