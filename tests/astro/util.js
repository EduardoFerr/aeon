import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const raiz = path.resolve(aqui, '..', '..');
export const lerJson = (rel) => JSON.parse(readFileSync(path.join(raiz, rel), 'utf8'));
export const horizons = lerJson('tests/astro/referencias/horizons.json');
export const swiss = lerJson('tests/astro/referencias/swiss.json');
export const cartas = lerJson('public/data/cards.json');

/** Diferenca angular absoluta em graus, [0, 180]. */
export const dif = (a, b) => Math.abs(((a - b + 540) % 360 + 360) % 360 - 180);
