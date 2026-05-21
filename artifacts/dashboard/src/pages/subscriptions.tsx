import { Link } from "wouter";
import { ExternalLink } from "lucide-react";
import {
  useListSubscriptions,
  getListSubscriptionsQueryKey,
} from "@workspace/api-client-react";
import { Layout, AuthGuard } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function traduzirStatus(status: string) {
  const map: Record<string, string> = {
    active: "Ativo",
    cancelled: "Cancelado",
    expired: "Expirado",
    trialing: "Em teste",
    past_due: "Em atraso",
    paused: "Pausado",
  };
  return map[status] ?? status;
}

function statusColor(status: string) {
  if (status === "active") return "text-emerald-600";
  if (status === "cancelled" || status === "expired") return "text-destructive";
  if (status === "trialing") return "text-blue-600";
  if (status === "past_due") return "text-orange-500";
  return "text-muted-foreground";
}

function traduzirCiclo(cycle: string) {
  return cycle === "monthly" ? "Mensal" : cycle === "yearly" ? "Anual" : cycle;
}

function planVariant(plan: string) {
  if (plan === "enterprise") return "default";
  if (plan === "pro") return "secondary";
  return "outline";
}

export default function SubscriptionsPage() {
  const { data: subscriptions, isLoading } = useListSubscriptions({
    query: { queryKey: getListSubscriptionsQueryKey() },
  });

  return (
    <AuthGuard>
      <Layout>
        <div data-testid="page-subscriptions" className="p-4 sm:p-6 lg:p-7 max-w-6xl mx-auto">
          <div className="mb-5">
            <h1 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
              Assinaturas
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {subscriptions ? `${subscriptions.length} no total` : "Carregando..."}
            </p>
          </div>

          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-card-border bg-muted/30">
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plano</th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ciclo</th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Início</th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vencimento</th>
                    <th className="px-4 sm:px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading
                    ? [...Array(4)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={7} className="px-4 sm:px-5 py-3">
                            <Skeleton className="h-5 w-full" />
                          </td>
                        </tr>
                      ))
                    : !subscriptions?.length
                    ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                          Nenhuma assinatura cadastrada
                        </td>
                      </tr>
                    )
                    : subscriptions.map((sub) => (
                        <tr
                          key={sub.id}
                          data-testid={`row-sub-${sub.id}`}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 sm:px-5 py-3">
                            <Badge variant={planVariant(sub.plan) as "default" | "secondary" | "outline"} className="capitalize text-xs">
                              {sub.plan}
                            </Badge>
                          </td>
                          <td className="px-4 sm:px-5 py-3">
                            <span className={`text-xs font-medium whitespace-nowrap ${statusColor(sub.status)}`}>
                              {traduzirStatus(sub.status)}
                            </span>
                          </td>
                          <td className="px-4 sm:px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {traduzirCiclo(sub.billingCycle)}
                          </td>
                          <td className="px-4 sm:px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {sub.amount ? `${sub.currency} ${sub.amount}` : "—"}
                          </td>
                          <td className="px-4 sm:px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {new Date(sub.startedAt).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-4 sm:px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td className="px-4 sm:px-5 py-3">
                            <Link href={`/tenants/${sub.tenantId}`}>
                              <button
                                data-testid={`link-sub-tenant-${sub.id}`}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
                              >
                                <ExternalLink size={11} /> Empresa
                              </button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Layout>
    </AuthGuard>
  );
}
