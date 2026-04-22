FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy full source and generate Prisma
COPY . .
RUN npx prisma generate

# Build Next.js application
RUN npm run build

ENV NODE_ENV=production

# Expose port and start
EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm start"]
