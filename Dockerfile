ARG NODE_VERSION=22

# Build stage
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci --omit=dev

# Production stage
FROM node:${NODE_VERSION}-alpine
WORKDIR /usr/src/app

# Copy node_modules from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy application files
COPY . .

ENV NODE_ENV=production
ENV ENVIRONMENT=prod

EXPOSE 80
CMD ["node", "index.js", "80"]