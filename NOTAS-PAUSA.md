# Notas de pausa: frente Diario (feat/sa-diario)

Pronto (nao verificado por auditoria completa):
- src/utils/diario.js: diaDaEntrada, rotuloMes, agruparPorMes (so apresentacao) e tests/astro/diario-agrupar.test.js (passa).
- HistoryScreen.js: cabecalho compacto (sub + meta com privacidade e contador), Exportar + Acoes (2 acoes no desktop; no celular so Acoes, com Exportar no menu), agrupamento por mes com cabecalho, dia grande em serifa e dia da semana, lixeira de 44px com aria-label "Apagar registro", nota em 2 linhas que cresce no foco, vazio com uma acao ("Tirar uma carta"), "Mostrar mais" terciario.
- styles/diario.css reescrito para isso.
- validar, test:astro (62 ok) e build rodados.

Falta:
- Ver capturas: vazio (0), 1 registro, 60 registros, 360/375/412, Aurora no celular (so vi crepusculo 390 e aurora 1280 com 12).
- Auditoria por script (.btn, primarias <= 1, altura 40, toque 44, innerWidth) com copia de /private/tmp/claude-501/aeon-sistema-test/audit.mjs e run.mjs (se /tmp for apagado, recriar: Chrome headless CDP, Emulation.setDeviceMetricsOverride mobile:true, deviceScaleFactor 3).
- Fluxos: apagar com Desfazer, apagar tudo com Desfazer, exportar/importar, editar nota, teclado (Tab/Enter/Esc, foco na lixeira).
- Conferir que o foco apos apagar vai para o proximo .diario-data e que meses vazios somem.

Rodar: npx vite --port 5302; harness em /private/tmp/claude-501/aeon-sa-diario-test (lib.mjs, shots.mjs <largura> <tema> <n> [full]).

Achados das capturas vistas: meta do cabecalho quebrava mal (corrigido com nowrap no contador); cartoes altos no celular (minis viraram linha de 3 com miniatura 40x60, corrigido); numero do dia agora alinhado a esquerda. Desktop 1280 Aurora ficou bom. Nomes de carta longos quebram em 3 linhas a 390 (aceitavel, pode reduzir).
