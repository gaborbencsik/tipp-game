FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app

RUN npm install -g npm@12.0.1

RUN echo '{"private":true,"devDependencies":{"@playwright/test":"1.60.0"}}' > package.json && \
    npm install

COPY playwright.config.ts ./
COPY e2e/ ./e2e/
