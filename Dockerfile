# Imagem de produção do site Phoenix Elétrica (Cloud Run)
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
# Garante que nenhum .env, banco local ou credencial vá para a imagem
RUN rm -rf .env .env.* gcp-key*.json phoenix_eletrica.db uploads backend standalone-frontend \
 && npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npx", "tsx", "server.ts"]
