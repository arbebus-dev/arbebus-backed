FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/
RUN npm install
COPY backend ./backend
COPY shared ./shared
EXPOSE 3000
CMD ["npm", "--workspace", "backend", "run", "start"]
