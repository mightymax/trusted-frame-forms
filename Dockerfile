FROM node:lts-alpine AS base
WORKDIR /usr/src/app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source (exclude example assets via .dockerignore)
COPY server.js utils.js middlewares.js customers.js ./

EXPOSE 3000
ENV NODE_ENV=production

CMD ["npm", "start"]
