import { ASPECTOS, ORBES_PADRAO } from './constantes.js';
import { difAngular } from './zodiaco.js';

/**
 * Aspectos maiores entre pontos.
 * @param {Array<{id:string, lon:number, velocidade:number|null}>} pontos em ordem canonica (define a ordem do id)
 * @param {object} [orbes] orbes por aspecto (graus); omitidos usam ORBES_PADRAO
 * @returns {Array<{id:string, a:string, b:string, tipo:string, nome:string, anguloExato:number, separacao:number, orbe:number, fase:'aplicativo'|'separativo'|'exato'|null}>}
 *  id estavel: "<a>-<tipo>-<b>" com a antes de b na ordem canonica (ex.: "sol-quadratura-saturno").
 */
export function calcularAspectos(pontos, orbes = {}) {
  const lim = { ...ORBES_PADRAO, ...orbes };
  const out = [];
  for (let i = 0; i < pontos.length; i++) {
    for (let j = i + 1; j < pontos.length; j++) {
      const A = pontos[i];
      const B = pontos[j];
      const d = difAngular(B.lon, A.lon); // [-180, 180)
      const sep = Math.abs(d);
      for (const asp of ASPECTOS) {
        const orbe = Math.abs(sep - asp.angulo);
        if (orbe > lim[asp.id]) continue;
        let fase = null;
        if (A.velocidade != null && B.velocidade != null) {
          const dSep = (d < 0 ? -1 : 1) * (B.velocidade - A.velocidade); // variacao da separacao
          const dOrbe = (sep >= asp.angulo ? 1 : -1) * dSep; // variacao do desvio ao angulo exato
          fase = Math.abs(dOrbe) < 1e-9 || orbe < 1e-4 ? 'exato' : dOrbe < 0 ? 'aplicativo' : 'separativo';
        }
        out.push({
          id: `${A.id}-${asp.id}-${B.id}`,
          a: A.id,
          b: B.id,
          tipo: asp.id,
          nome: asp.nome,
          anguloExato: asp.angulo,
          separacao: sep,
          orbe,
          fase,
        });
        break; // os angulos dos 5 aspectos distam 30 graus ou mais; so um pode caber
      }
    }
  }
  return out;
}
