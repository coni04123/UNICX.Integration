# =========================
# Stage 1: Builder
# =========================
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ bash

# Install Chromium for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    fontconfig \
    chromium-chromedriver

# Puppeteer env
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    CHROME_BIN=/usr/bin/chromium-browser

# Copy package.json & lock
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Copy env file for build if needed
COPY .env.production .env

# Build NestJS app
RUN npm run build

# Optional: seed DB in builder (can also do in final if needed)
# RUN npm run seed:clean

# =========================
# Stage 2: Production image
# =========================
FROM node:22-alpine

WORKDIR /app

# Install only runtime deps
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont fontconfig bash

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    CHROME_BIN=/usr/bin/chromium-browser

# Copy package.json & package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.env .env

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start the app
CMD ["npm", "run", "start:prod"]
