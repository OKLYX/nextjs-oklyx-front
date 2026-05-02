# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept API_URL as build argument
ARG NEXT_PUBLIC_SERVER_API_URL

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript/ESLint build)
RUN npm ci

# Copy source code
COPY . .

# Build Next.js application with API_URL
RUN NEXT_PUBLIC_SERVER_API_URL=$NEXT_PUBLIC_SERVER_API_URL npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper process handling
RUN apk add --no-cache dumb-init

# Copy node_modules and built app from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start Next.js production server
CMD ["npm", "start"]
