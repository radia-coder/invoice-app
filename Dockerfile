FROM node:20-slim

# Install Chrome and required dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
  google-chrome-stable \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libwayland-client0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils \
  wget \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Skip Puppeteer's Chromium download (we use system Chrome above)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install dependencies
RUN npm ci

# Copy the rest of the project
COPY . .

# Generate Prisma client and build Next.js only (no electron)
RUN npx prisma generate && npx next build && node scripts/copy-standalone-assets.js

# Tell Puppeteer to use the installed Chrome and disable sandbox
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PUPPETEER_NO_SANDBOX=true
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", ".next/standalone/server.js"]
