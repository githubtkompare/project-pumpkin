FROM mcr.microsoft.com/playwright:v1.48.2-focal

# Install bash and useful tools for interactive use
RUN apt-get update && apt-get install -y \
    bash \
    nano \
    vim \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install all dependencies (including devDependencies for Playwright)
COPY package*.json ./
RUN npm ci

# Install Playwright browsers (Firefox for our tests)
RUN npx playwright install --with-deps firefox

# Copy application and test files
COPY src ./src
COPY tests ./tests
COPY playwright.config.js ./

# Expose app port
EXPOSE 3000

# Default to bash shell for interactive use
CMD ["/bin/bash"]
