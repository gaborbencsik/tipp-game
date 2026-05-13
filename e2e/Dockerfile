FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app

RUN echo '{"private":true,"devDependencies":{"@playwright/test":"1.60.0"}}' > package.json && \
    npm install

COPY playwright.config.ts ./
COPY e2e/ ./e2e/
