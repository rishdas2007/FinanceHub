# FinanceHub Pro - Docker Configuration
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port 80 for Cloud Run compatibility
EXPOSE 80

# Set environment to production
ENV NODE_ENV=production

# Start the application using production script
CMD ["node", "start-production.js"]