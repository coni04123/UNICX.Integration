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
    CHROME_BIN=/usr/bin/chromium

# Copy package.json & lock
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Copy env file for build if needed
COPY .env.production .env

# Build NestJS app
RUN npm run build

# =========================
# Stage 2: Production image
# =========================
FROM node:22-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont fontconfig bash wget

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    CHROME_BIN=/usr/bin/chromium \
    PATH=/usr/local/bin:$PATH

# Copy package.json & lock
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.env .env

# Ensure files are readable by non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs && \
    chown -R nestjs:nodejs /app

USER nestjs

# Expose port
EXPOSE 5000

# Start the app
CMD ["sh", "-c", "npm run start:prod"]
