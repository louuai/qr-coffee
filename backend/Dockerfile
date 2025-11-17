FROM node:18-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
# Install all deps to build TypeScript, then prune dev deps
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev
EXPOSE 3000
CMD ["npm", "start"]
