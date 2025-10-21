# Simple Dockerfile for UNICX Backend
FROM node:22-alpine

# Set working directory
WORKDIR /app

ARG MONGODB_URI
ARG JWT_SECRET
ARG EMAIL_USER
ARG EMAIL_PASS
ARG ENCRYPTION_KEY
ARG AZURE_STORAGE_CONNECTION_STRING

# Accept build arguments
ENV MONGODB_URI=$MONGODB_URI
ENV JWT_SECRET=$JWT_SECRET
ENV EMAIL_USER=$EMAIL_USER
ENV EMAIL_PASS=$EMAIL_PASS
ENV ENCRYPTION_KEY=$ENCRYPTION_KEY
ENV AZURE_STORAGE_CONNECTION_STRING=$AZURE_STORAGE_CONNECTION_STRING

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Install Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Copy env file
COPY .env.production .env

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Seed the database
RUN npm run seed:clean

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Change ownership
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start the application
CMD ["npm", "run", "start:prod"]
