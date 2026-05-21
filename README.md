# ReservaAI — Plataforma de Agendamento SaaS

Sistema multi-tenant completo: agendamentos, WhatsApp automático, IA de atendimento, pesquisas de satisfação e gestão de assinaturas.

## Rodar agora (Replit)

O MVP está hospedado no Replit. Basta clicar em **Deploy** no painel do Replit.

## Stack

- **API**: Node.js 24 + Express 5 + TypeScript
- **Banco**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **IA**: OpenAI GPT-4o-mini
- **WhatsApp**: Evolution API (Baileys)
- **Pagamentos**: MercadoPago

## Variáveis de ambiente obrigatórias

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL |
| `SESSION_SECRET` | Secret JWT (mín. 32 chars) |
| `ADMIN_PASSWORD` | Senha do super-admin |

## Variáveis opcionais (habilitam funcionalidades)

| Variável | Funcionalidade |
|---|---|
| `OPENAI_API_KEY` | IA de atendimento automático no WhatsApp |
| `EVOLUTION_API_URL` | URL da Evolution API para WhatsApp real |
| `EVOLUTION_API_KEY` | Chave da Evolution API |
| `MERCADOPAGO_ACCESS_TOKEN` | Cobranças via MercadoPago |
| `MERCADOPAGO_WEBHOOK_SECRET` | Validação de webhooks MercadoPago |

## Comandos

```bash
# Instalar dependências
pnpm install

# Aplicar schema no banco (primeira vez ou após mudanças)
pnpm --filter @workspace/db run push

# Rodar em desenvolvimento
pnpm --filter @workspace/api-server run dev   # API na porta 8080
pnpm --filter @workspace/dashboard run dev    # Dashboard na porta 3000

# Build de produção
pnpm --filter @workspace/api-server run build

# Iniciar em produção
pnpm --filter @workspace/api-server run start
```

## O que está funcionando hoje

- Login super-admin e painel de controle
- Cadastro de negócios (tenants) com slug/link único
- Serviços, preços e duração por negócio
- Agendamentos com calendário
- Link público de agendamento: `/onboard/:slug`
- WhatsApp automático via Evolution API (QR code por negócio)
- IA GPT-4o-mini respondendo dúvidas de clientes no WhatsApp
- Cancelamento e reagendamento via WhatsApp (fluxo conversacional)
- Pesquisas de satisfação automáticas pós-atendimento
- Analytics de receita e agendamentos
- Assinaturas MercadoPago

## Estrutura

```
artifacts/api-server/   → Backend Express (todas as rotas, jobs, webhooks)
artifacts/dashboard/    → Frontend React (painel admin + negócios + público)
lib/db/                 → Schema Drizzle + migrações
lib/api-spec/           → OpenAPI spec (fonte da verdade)
lib/api-zod/            → Schemas Zod gerados
lib/api-client-react/   → React Query hooks gerados
```

## Para Railway (futuro)

Quando migrar para Railway:
- `Dockerfile` → serviço api-server
- `Dockerfile.dashboard` → serviço dashboard
- Configurar cada serviço separadamente no painel Railway
- Sem `railway.toml` global (cada serviço tem sua própria config no UI)
