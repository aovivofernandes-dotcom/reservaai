FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY scripts/package.json ./scripts/

RUN pnpm install --no-frozen-lockfile

COPY . .

RUN pnpm --filter @workspace/api-server run build

ENV PORT=8080
EXPOSE 8080

CMD ["pnpm", "--filter", "@workspace/api-server", "run", "start"]
