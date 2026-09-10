FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY src ./src

EXPOSE 8000

CMD ["node", "src/server.js"]
