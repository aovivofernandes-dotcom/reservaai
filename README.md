# ReservaAI — Plataforma SaaS de Agendamento Multi-tenant

Sistema completo de agendamento com painel super-admin, fluxo de onboarding via WhatsApp, IA de atendimento automático, pesquisas de satisfação e gestão de assinaturas.

## Stack

- **Runtime**: Node.js 24, pnpm workspaces
- **API**: Express 5 + TypeScript
- **Banco**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + TanStack Query
- **IA**: OpenAI GPT-4o-mini
- **WhatsApp**: Evolution API (Baileys)
- **Pagamentos**: MercadoPago

## Estrutura

```
artifacts/
  api-server/     # Backend Express (porta 8080)
  dashboard/      # Frontend React/Vite (porta 23183)
lib/
  db/             # Schema Drizzle + migrations
  api-spec/       # OpenAPI spec (fonte da verdade)
  api-zod/        # Schemas Zod gerados
  api-client-react/ # React Query hooks gerados
scripts/          # Utilitários
```

## Pré-requisitos

- Node.js 24+
- pnpm 9+
- PostgreSQL 15+

## Instalação

```bash
# 1. Instalar dependências
pnpm install

# 2. Copiar variáveis de ambiente
cp .env.example .env
# Edite o .env com seus valores

# 3. Aplicar schema no banco
pnpm --filter @workspace/db run push

# 4. (Opcional) Regenerar hooks e schemas a partir do OpenAPI
pnpm --filter @workspace/api-spec run codegen
```

## Variáveis de Ambiente

| Variável | Descrição | Obrigatório |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | ✅ |
| `SESSION_SECRET` | Secret JWT (mín. 32 chars) | ✅ |
| `ADMIN_PASSWORD` | Senha do super-admin | ✅ |
| `OPENAI_API_KEY` | Chave API OpenAI (IA WhatsApp) | Recomendado |
| `EVOLUTION_API_URL` | URL da sua Evolution API | WhatsApp |
| `EVOLUTION_API_KEY` | API Key da Evolution API | WhatsApp |
| `MERCADOPAGO_ACCESS_TOKEN` | Token MercadoPago | Pagamentos |
| `MERCADOPAGO_WEBHOOK_SECRET` | Secret webhook MercadoPago | Pagamentos |
| `PORT` | Porta do servidor (padrão: 8080) | ✅ Railway |

## Rodar em Desenvolvimento

```bash
# API (porta 8080)
pnpm --filter @workspace/api-server run dev

# Frontend (porta 23183)
pnpm --filter @workspace/dashboard run dev
```

## Build para Produção

```bash
# Build completo
pnpm run build

# Iniciar API em produção
pnpm --filter @workspace/api-server run start
```

## Deploy no Railway

O projeto está configurado para deploy no Railway via `railway.toml`.

### Passos:

1. Crie um projeto no [Railway](https://railway.app)
2. Adicione um serviço PostgreSQL
3. Conecte este repositório GitHub
4. Configure as variáveis de ambiente (ver tabela acima)
5. O Railway detecta automaticamente o `railway.toml` e executa o build

### Configuração Railway:

- **Build**: `pnpm install && pnpm --filter @workspace/db run push && pnpm --filter @workspace/api-server run build`
- **Start**: `pnpm --filter @workspace/api-server run start`
- **Health check**: `GET /api/health`

## Checklist pós-deploy

- [ ] `DATABASE_URL` configurado
- [ ] `SESSION_SECRET` configurado (gere com `openssl rand -hex 32`)
- [ ] `ADMIN_PASSWORD` configurado
- [ ] Rodar `pnpm --filter @workspace/db run push` para criar as tabelas
- [ ] Configurar Evolution API URL/Key no painel admin → Configurações
- [ ] Apontar webhook da Evolution API para `https://SEU_DOMINIO/api/evolution/webhook`

## Funcionalidades

- **Super-admin dashboard**: analytics, CRUD de tenants, gestão de assinaturas
- **Onboarding de clientes**: formulário público por slug `/onboard/:slug`
- **WhatsApp automático**: fluxo conversacional de cadastro via Evolution API
- **IA de atendimento**: GPT-4o-mini responde dúvidas dos clientes automaticamente
- **Cancelamento/reagendamento via WA**: fluxo de estado salvo no banco
- **Pesquisas de satisfação**: envio automático pós-atendimento
- **Multi-tenant**: cada negócio tem sua própria instância WhatsApp isolada

## Licença

Privado — todos os direitos reservados.
