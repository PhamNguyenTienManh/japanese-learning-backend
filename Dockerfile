# syntax=docker/dockerfile:1.7

# Use a Node version compatible with NestJS 11 and keep Alpine for a small base.
ARG NODE_VERSION=22-alpine

# Shared base for dependency and build stages.
FROM node:${NODE_VERSION} AS base
WORKDIR /app

# Puppeteer is installed as an npm package, but Chromium is provided by Alpine
# in the runtime image to avoid downloading a large browser during npm install.
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install all dependencies, including devDependencies, for TypeScript build.
# Copying only package files first maximizes Docker layer cache reuse.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Compile the NestJS application.
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Install production dependencies only for the final image.
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# Runtime image: small Node Alpine image plus system Chromium for Puppeteer.
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

# Production defaults. Railway injects PORT at runtime; 9090 remains local docs.
ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Chromium dependencies are required by the PDF module that uses Puppeteer.
# dumb-init forwards signals correctly so Nest shutdown hooks can run cleanly.
RUN apk add --no-cache \
    ca-certificates \
    chromium \
    dumb-init \
    freetype \
    harfbuzz \
    nss \
    ttf-freefont

# Copy only what the app needs at runtime: production node_modules, compiled JS,
# package metadata, static assets, and Handlebars templates read from disk.
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node assets ./assets
COPY --chown=node:node src/modules/pdf/templates ./src/modules/pdf/templates

# Run as the non-root node user provided by the official Node image.
USER node

# Railway provides the actual PORT env var. EXPOSE is documentation for local use.
EXPOSE 9090

# Healthcheck verifies the NestJS health endpoint on the injected PORT.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "const http=require('http');const port=Number(process.env.PORT)||9090;const req=http.get({host:'127.0.0.1',port,path:'/api/health',timeout:3000},res=>{process.exit(res.statusCode===200?0:1)});req.on('error',()=>process.exit(1));req.on('timeout',()=>{req.destroy();process.exit(1)});"]

# Start the compiled NestJS app. dumb-init keeps signal handling production-safe.
CMD ["dumb-init", "node", "dist/main.js"]
