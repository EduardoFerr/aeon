// Mede o contraste WCAG dos tokens REAIS lidos de styles/tema-*.css. Uso: node tools/contraste-tokens.mjs
import fs from 'node:fs';
const ler = (f, sel) => {
  const css = fs.readFileSync(f, 'utf8');
  const i = css.indexOf(sel); const bloco = css.slice(i, css.indexOf('}', i));
  const t = {}; for (const m of bloco.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) t[m[1]] = m[2].trim(); return t;
};
const TEMAS = { crepusculo: ler('styles/tema-crepusculo.css', ':where(:root)'), aurora: ler('styles/tema-aurora.css', '[data-theme="aurora"] {') };
const p = (c) => { if (c.startsWith('#')) { const h = c.length === 4 ? [...c.slice(1)].map((x) => x + x).join('') : c.slice(1); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1); } const m = c.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m[3] ?? 1]; };
const over = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat(1);
const L = (c) => { const k = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]; };
const R = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
let falhas = 0;
for (const [n, t] of Object.entries(TEMAS)) {
  const C = (k) => p(t[k]); const flat = (fg, bg) => R(over(C(fg), C(bg)), C(bg));
  const ink = (a, b) => R(C(a), C(b));
  const rows = [
    ['texto/bg', flat('text', 'bg'), 4.5], ['texto-suave/surface', flat('text-soft', 'surface'), 4.5], ['texto-suave/surface-2', flat('text-soft', 'surface-2'), 4.5],
    ['mudo/bg', flat('text-mute', 'bg'), 4.5], ['mudo/surface', flat('text-mute', 'surface'), 4.5], ['mudo/surface-2', flat('text-mute', 'surface-2'), 4.5],
    ['terciaria (acento)/bg', flat('accent', 'bg'), 4.5], ['terciaria (acento)/surface', flat('accent', 'surface'), 4.5], ['terciaria (acento)/surface-2', flat('accent', 'surface-2'), 4.5],
    ['primaria: ink/acento', ink('accent-ink', 'accent'), 4.5], ['primaria hover: ink/hover', ink('accent-ink', 'accent-hover'), 4.5],
    ['destrutiva (err)/bg', flat('err', 'bg'), 4.5], ['destrutiva (err)/surface', flat('err', 'surface'), 4.5], ['destrutiva (err)/surface-2', flat('err', 'surface-2'), 4.5],
    ['destrutiva solida: err-ink/err', ink('err-ink', 'err'), 4.5],
    ['aviso (warn)/surface', flat('warn', 'surface'), 4.5], ['ok/surface', flat('ok', 'surface'), 4.5],
    ['contorno secundaria (control)/bg [3:1]', flat('control', 'bg'), 3], ['contorno secundaria (control)/surface [3:1]', flat('control', 'surface'), 3],
    ['contorno sutil (line-strong)/bg [so divisor, informativo]', flat('line-strong', 'bg'), 0],
    ['foco/bg [3:1]', flat('focus', 'bg'), 3], ['foco/surface [3:1]', flat('focus', 'surface'), 3], ['foco/surface-2 [3:1]', flat('focus', 'surface-2'), 3],
    ['acento (sublinhado de aba)/bg [3:1]', flat('accent', 'bg'), 3],
  ];
  console.log('== ' + n);
  for (const [k, v, m] of rows) { const ok = v >= m; if (!ok) falhas++; console.log((ok ? 'ok     ' : 'FALHA  ') + v.toFixed(2).padStart(6) + ' (min ' + m + ') ' + k); }
}
console.log('falhas:', falhas); process.exit(falhas ? 1 : 0);
