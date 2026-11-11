# Arte dos e-mails

Fontes em SVG das duas imagens usadas nos e-mails do servidor (os PNGs publicados ficam em `public/email/`, no site, e são carregados de `https://aeonfool.com/email/`):

- `topo.svg` vira `public/email/aeon-topo.png` (480 x 150, gerado em 2x = 960 x 300). A marca do app (AEON com o sol no O), estrelas, brilho, ornamento e a legenda.
- `carta.svg` vira `public/email/aeon-carta.png` (160 x 240, gerado em 2x = 320 x 480). Um verso de carta com o sol-olho do Aeon, no estilo do app.

As cores são as do tema Crepúsculo (`#14101c`, `#f1e9e0`, `#e8b7a0`, `#b8abb8`).

Para refazer o PNG a partir do SVG (fundo transparente, 2x), com o Chrome:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --default-background-color=00000000 --force-device-scale-factor=2 --window-size=480,150 \
  --screenshot=topo.png file:///caminho/para/pagina-com-o-svg.html
```

(`pagina-com-o-svg.html` é uma página mínima com o SVG dentro de `<body style="margin:0">`; para a carta, `--window-size=160,240`.)
