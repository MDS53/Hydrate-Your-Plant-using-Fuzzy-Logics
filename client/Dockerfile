# ===================================================
# Plant Care Companion - React Frontend Dockerfile
# Multi-stage build with Node & Alpine Nginx
# ===================================================

# Stage 1: Build static assets
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy client source code
COPY . .

# Build production bundle with Vite
RUN npm run build

# Stage 2: Serve with lightweight Nginx
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
