/** Utilidades HTTP mínimas, sem framework: menos código de terceiros num servidor que guarda dados de nascimento. */

export class ErroHttp extends Error {
    constructor(status, codigo, extra = {}) {
        super(codigo);
        this.status = status;
        this.codigo = codigo;
        this.extra = extra;
    }
}

export function lerCorpo(req, limite) {
    return new Promise((resolve, reject) => {
        const tipo = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        const declarado = Number(req.headers['content-length'] || 0);
        if (declarado > limite) {
            req.resume();
            return reject(new ErroHttp(413, 'corpo_grande_demais'));
        }
        const partes = [];
        let total = 0;
        req.on('data', (c) => {
            total += c.length;
            if (total > limite) {
                req.destroy();
                reject(new ErroHttp(413, 'corpo_grande_demais'));
                return;
            }
            partes.push(c);
        });
        req.on('error', () => reject(new ErroHttp(400, 'corpo_invalido')));
        req.on('end', () => {
            if (!total) return resolve({});
            if (tipo !== 'application/json') return reject(new ErroHttp(415, 'tipo_de_conteudo_invalido'));
            try {
                const obj = JSON.parse(Buffer.concat(partes).toString('utf8'));
                if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return reject(new ErroHttp(400, 'corpo_invalido'));
                resolve(obj);
            } catch {
                reject(new ErroHttp(400, 'json_invalido'));
            }
        });
    });
}

export function responder(res, status, corpo, cabecalhos = {}) {
    const texto = corpo === undefined ? '' : JSON.stringify(corpo);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(texto),
        ...cabecalhos,
    });
    res.end(texto);
}

export function lerCookies(req) {
    const saida = {};
    for (const par of String(req.headers.cookie || '').split(';')) {
        const i = par.indexOf('=');
        if (i < 0) continue;
        const nome = par.slice(0, i).trim();
        if (nome && !(nome in saida)) saida[nome] = par.slice(i + 1).trim();
    }
    return saida;
}

export function montarCookie(nome, valor, { maxAgeS, seguro }) {
    const partes = [`${nome}=${valor}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeS}`];
    if (seguro) partes.push('Secure');
    return partes.join('; ');
}

/** Rotas com :parametros. Devolve { handler, params, caminhoExiste } ou null. */
export function criarRoteador() {
    const rotas = [];
    return {
        adicionar(metodo, padrao, opcoes, handler) {
            const nomes = [];
            const re = new RegExp(
                '^' + padrao.replace(/:([a-z]+)/g, (_, n) => (nomes.push(n), '([^/]+)')) + '$',
            );
            rotas.push({ metodo, re, nomes, opcoes, handler });
        },
        achar(metodo, caminho) {
            let existe = false;
            for (const r of rotas) {
                const m = r.re.exec(caminho);
                if (!m) continue;
                existe = true;
                if (r.metodo !== metodo) continue;
                const params = {};
                try {
                    r.nomes.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
                } catch {
                    return { rota: null, params: {}, existe: false }; // % malformado: não existe
                }
                return { rota: r, params, existe };
            }
            return { rota: null, params: {}, existe };
        },
    };
}
