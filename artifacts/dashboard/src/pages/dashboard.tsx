import { Link } from "wouter";
import {
  Building2,
  Users,
  CreditCard,
  ClipboardList,
  MessageCircle,
  TrendingUp,
  ArrowRight,
  UserPlus,
  Clock,
  CheckCircle2,
  BarChart3,
  DollarSign,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  useGetAdminAnalytics,
  getGetAdminAnalyticsQueryKey,
  useGetSignupAnalytics,
  getGetSignupAnalyticsQueryKey,
  useGetRevenueAnalytics,
  getGetRevenueAnalyticsQueryKey,
} from "@workspace/api-client-react";
import { Layout, AuthGuard } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  testId,
  highlight,
}: {
  label: string;
  value: number | string | undefined;
  sub?: string;
  icon: React.ElementType;
  testId: string;
  highlight?: boolean;
}) {
  return (
    <div
      data-testid={testId}
      className={`border rounded-xl p-4 sm:p-5 ${highlight ? "bg-violet-50 border-violet-100" : "bg-card border-card-border"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight">
            {label}
          </p>
          <p className={`mt-1.5 text-xl sm:text-2xl font-semibold tabular-nums ${highlight ? "text-violet-600" : "text-foreground"}`}>
            {value !== undefined ? (typeof value === "number" ? value.toLocaleString("pt-BR") : value) : <Skeleton className="h-7 w-16 mt-1" />}
          </p>
          {sub && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{sub}</p>
          )}
        </div>
        <div className={`p-2 sm:p-2.5 rounded-lg shrink-0 ${highlight ? "bg-violet-100" : "bg-accent"}`}>
          <Icon size={15} className={highlight ? "text-violet-600" : "text-accent-foreground"} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

function planBadgeVariant(plan: string) {
  if (plan === "enterprise") return "default";
  if (plan === "pro") return "secondary";
  return "outline";
}

function traduzirStatusEmpresa(status: string) {
  const map: Record<string, string> = {
    active: "Ativo",
    inactive: "Inativo",
    suspended: "Suspenso",
  };
  return map[status] ?? status;
}

function statusColor(status: string) {
  if (status === "active") return "text-emerald-600";
  if (status === "suspended") return "text-destructive";
  return "text-muted-foreground";
}

function onboardingStepBadge(step: string | null) {
  if (!step) return null;
  const map: Record<string, { label: string; className: string }> = {
    profile: { label: "Perfil", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    whatsapp: { label: "WhatsApp", className: "bg-blue-50 text-blue-700 border-blue-200" },
    launch: { label: "Lançamento", className: "bg-purple-50 text-purple-700 border-purple-200" },
    complete: { label: "Concluído", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  const entry = map[step];
  if (!entry) return null;
  return <Badge className={`text-xs ${entry.className}`}>{entry.label}</Badge>;
}

function daysLeft(isoDate: string | null) {
  if (!isoDate) return null;
  const diff = new Date(isoDate).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return <span className="text-red-600 text-xs">Expirado</span>;
  return <span className={`text-xs ${days <= 3 ? "text-orange-600" : "text-emerald-600"}`}>{days}d</span>;
}

function formatBRL(val: number | undefined) {
  if (val === undefined) return undefined;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

export default function DashboardPage() {
  const { data: analytics, isLoading } = useGetAdminAnalytics({
    query: { queryKey: getGetAdminAnalyticsQueryKey() },
  });
  const { data: signupData, isLoading: signupLoading } = useGetSignupAnalytics({
    query: { queryKey: getGetSignupAnalyticsQueryKey() },
  });
  const { data: revenueData, isLoading: revenueLoading } = useGetRevenueAnalytics({
    query: { queryKey: getGetRevenueAnalyticsQueryKey() },
  });

  const conversionPct = signupData
    ? `${(signupData.conversionRate * 100).toFixed(1)}%`
    : undefined;

  return (
    <AuthGuard>
      <Layout>
        <div data-testid="page-dashboard" className="p-4 sm:p-6 lg:p-7 max-w-6xl mx-auto space-y-7">
          {/* Cabeçalho */}
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
              Painel
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Visão geral da plataforma
            </p>
          </div>

          {/* Estatísticas da plataforma */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Plataforma
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <StatCard
                label="Total de Empresas"
                value={analytics?.totalTenants}
                sub={`${analytics?.activeTenants ?? "—"} ativas`}
                icon={Building2}
                testId="stat-total-tenants"
              />
              <StatCard
                label="Assinaturas"
                value={analytics?.totalSubscriptions}
                sub={`${analytics?.activeSubscriptions ?? "—"} ativas`}
                icon={CreditCard}
                testId="stat-total-subscriptions"
              />
              <StatCard
                label="Cadastros"
                value={analytics?.totalOnboardingSubmissions}
                sub={`${analytics?.pendingOnboardingSubmissions ?? "—"} pendentes`}
                icon={ClipboardList}
                testId="stat-total-onboarding"
              />
              <StatCard
                label="Sessões WhatsApp"
                value={analytics?.totalWhatsappSessions}
                icon={MessageCircle}
                testId="stat-whatsapp-sessions"
              />
              <StatCard
                label="Empresas Ativas"
                value={analytics?.activeTenants}
                icon={Users}
                testId="stat-active-tenants"
              />
              <StatCard
                label="Pendentes"
                value={analytics?.pendingOnboardingSubmissions}
                icon={TrendingUp}
                testId="stat-pending-reviews"
              />
            </div>
          </section>

          {/* Cadastros e Conversão */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Cadastros e Conversão
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
              <StatCard
                label="Total de Cadastros"
                value={signupData?.totalSignups}
                icon={UserPlus}
                testId="stat-total-signups"
                highlight
              />
              <StatCard
                label="Em Teste"
                value={signupData?.trialCount}
                icon={Clock}
                testId="stat-trial-count"
              />
              <StatCard
                label="Convertidos"
                value={signupData?.activeCount}
                icon={CheckCircle2}
                testId="stat-active-count"
              />
              <StatCard
                label="Conversão"
                value={conversionPct}
                icon={BarChart3}
                testId="stat-conversion-rate"
                highlight={!!signupData && signupData.conversionRate > 0}
              />
            </div>

            {/* Tabela de cadastros recentes */}
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-card-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Cadastros Recentes</h3>
                <Link href="/tenants" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Ver todos <ArrowRight size={11} />
                </Link>
              </div>

              {signupLoading ? (
                <div className="p-4 sm:p-5 space-y-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : !signupData?.recentSignups?.length ? (
                <div className="p-8 sm:p-10 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum cadastro ainda</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Compartilhe <code className="text-primary">/signup</code> para começar
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[520px]">
                    <div className="px-4 sm:px-5 py-2 grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <div className="col-span-3">Empresa</div>
                      <div className="col-span-2">Plano</div>
                      <div className="col-span-2">Teste</div>
                      <div className="col-span-2">WhatsApp</div>
                      <div className="col-span-3">Pagamento</div>
                    </div>
                    {signupData.recentSignups.map((signup) => (
                      <div
                        key={signup.id}
                        className="px-4 sm:px-5 py-3 grid grid-cols-12 gap-2 items-center hover:bg-muted/30 transition-colors border-t border-border"
                      >
                        <div className="col-span-3 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{signup.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{signup.email}</p>
                        </div>
                        <div className="col-span-2">
                          <Badge variant={planBadgeVariant(signup.plan) as "default" | "secondary" | "outline"} className="text-xs">
                            {signup.plan}
                          </Badge>
                        </div>
                        <div className="col-span-2">{daysLeft(signup.trialEndsAt ?? null)}</div>
                        <div className="col-span-2">
                          {signup.whatsappConnected ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 inline-block" />
                              Pendente
                            </span>
                          )}
                        </div>
                        <div className="col-span-3">
                          {signup.subscriptionStatus ? (
                            <span className={`text-xs font-medium ${
                              signup.subscriptionStatus === "active" ? "text-emerald-600" :
                              signup.subscriptionStatus === "trialing" ? "text-blue-500" :
                              signup.subscriptionStatus === "past_due" ? "text-amber-500" :
                              signup.subscriptionStatus === "cancelled" ? "text-destructive" :
                              "text-muted-foreground"
                            }`}>
                              {signup.subscriptionStatus === "active" ? "Ativo" :
                               signup.subscriptionStatus === "trialing" ? "Em teste" :
                               signup.subscriptionStatus === "past_due" ? "Em atraso" :
                               signup.subscriptionStatus === "cancelled" ? "Cancelado" :
                               signup.subscriptionStatus === "expired" ? "Expirado" :
                               signup.subscriptionStatus}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Receita */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Receita
            </h2>
            {revenueLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
                  <StatCard
                    label="MRR"
                    value={formatBRL(revenueData?.mrr)}
                    sub="Receita mensal"
                    icon={DollarSign}
                    testId="stat-mrr"
                    highlight
                  />
                  <StatCard
                    label="ARR"
                    value={formatBRL(revenueData?.arr)}
                    sub="Receita anual"
                    icon={TrendingUp}
                    testId="stat-arr"
                  />
                  <StatCard
                    label="Assinaturas"
                    value={revenueData?.activeSubscriptions}
                    sub={`${revenueData?.trialingSubscriptions ?? 0} em teste`}
                    icon={CheckCircle2}
                    testId="stat-active-subs"
                  />
                  <StatCard
                    label="Pagamentos Falhos"
                    value={revenueData?.failedPaymentsCount}
                    sub={`${revenueData?.pastDueSubscriptions ?? 0} em atraso`}
                    icon={AlertTriangle}
                    testId="stat-failed-payments"
                  />
                </div>

                {revenueData && revenueData.recentPayments.length > 0 && (
                  <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                    <div className="px-4 sm:px-5 py-3.5 border-b border-card-border">
                      <h3 className="text-sm font-semibold text-foreground">Pagamentos Recentes</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="min-w-[400px]">
                        <div className="px-4 sm:px-5 py-2 grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          <div className="col-span-2">Status</div>
                          <div className="col-span-3">Método</div>
                          <div className="col-span-3">Valor</div>
                          <div className="col-span-4">Data</div>
                        </div>
                        {revenueData.recentPayments.slice(0, 8).map((p) => (
                          <div key={p.id} className="px-4 sm:px-5 py-3 grid grid-cols-12 gap-2 items-center border-t border-border">
                            <div className="col-span-2">
                              {p.status === "approved" ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : p.status === "rejected" ? (
                                <XCircle className="h-4 w-4 text-red-500" />
                              ) : (
                                <Loader2 className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                            <div className="col-span-3">
                              <span className="text-xs text-muted-foreground capitalize">
                                {p.paymentMethod === "credit_card" ? "Cartão" : p.paymentMethod === "pix" ? "PIX" : p.paymentMethod ?? "—"}
                              </span>
                            </div>
                            <div className="col-span-3">
                              <span className={`text-sm font-medium ${p.status === "approved" ? "text-emerald-600" : "text-muted-foreground"}`}>
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(p.amount))}
                              </span>
                            </div>
                            <div className="col-span-4">
                              <span className="text-xs text-muted-foreground">
                                {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Empresas recentes */}
          <section>
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-card-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Empresas Recentes</h2>
                <Link
                  href="/tenants"
                  data-testid="link-view-all-tenants"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Ver todos <ArrowRight size={11} />
                </Link>
              </div>

              {isLoading ? (
                <div className="p-4 sm:p-5 space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : !analytics?.recentTenants?.length ? (
                <div className="p-8 sm:p-10 text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma empresa ainda</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {analytics.recentTenants.map((tenant) => (
                    <div
                      key={tenant.id}
                      data-testid={`row-tenant-${tenant.id}`}
                      className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{tenant.email}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <Badge variant={planBadgeVariant(tenant.plan) as "default" | "secondary" | "outline"} className="text-xs hidden sm:inline-flex">
                          {tenant.plan}
                        </Badge>
                        <span className={`text-xs font-medium hidden sm:inline ${statusColor(tenant.status)}`}>
                          {traduzirStatusEmpresa(tenant.status)}
                        </span>
                        <Link
                          href={`/tenants/${tenant.id}`}
                          data-testid={`link-tenant-${tenant.id}`}
                          className="text-xs text-primary hover:underline whitespace-nowrap"
                        >
                          Ver
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </Layout>
    </AuthGuard>
  );
}
