# Node 24: o SQLite embutido (node:sqlite) dispensa módulo nativo.
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY scripts ./scripts
# o banco fica em /dados (volume); o usuário "node" já existe na imagem
RUN mkdir -p /dados && chown node:node /dados
USER node
ENV HOST=0.0.0.0 PORTA=8787 CAMINHO_BANCO=/dados/aeon.sqlite
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/v1/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
