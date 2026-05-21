FROM node:22-slim

# Enable corepack so pnpm is available without extra install
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY scripts/package.json ./scripts/

# Install all dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Build the API server (includes TypeScript compilation via esbuild)
RUN pnpm --filter @workspace/api-server run build

EXPOSE 8080

# Run DB migrations then start server
CMD pnpm --filter @workspace/db run push && pnpm --filter @workspace/api-server run start
