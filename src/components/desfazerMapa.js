import { apagar, instantaneo, restaurar } from '../utils/perfil.js';
import { avisar } from './Sobreposicao.js';

const T = { apagado: 'Mapa apagado', desfazer: 'Desfazer', voltou: 'Mapa de volta no perfil', erro: 'Não foi possível apagar o mapa agora.' };

/**
 * Apaga um mapa na hora e oferece o Desfazer por 8 segundos (sem pergunta antes: a ação é reversível).
 * Devolve true se apagou. O Desfazer devolve o perfil inteiro ao estado de antes.
 */
export function apagarMapaComDesfazer(id) {
    const copia = instantaneo();
    if (!apagar(id)) {
        avisar(T.erro, { erro: true });
        return false;
    }
    avisar(T.apagado, {
        desfazer: {
            rotulo: T.desfazer,
            aoClicar: () => {
                restaurar(copia);
                avisar(T.voltou);
            },
        },
    });
    return true;
}
