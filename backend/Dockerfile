FROM node:20-alpine
WORKDIR /app

# Render service can build either from repository root or backend as Docker context.
# This Dockerfile expects repository root context, which matches render.yaml below.
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/
RUN npm install --omit=dev

COPY backend ./backend
COPY shared ./shared

EXPOSE 3000
CMD ["npm", "--workspace", "backend", "run", "start"]
