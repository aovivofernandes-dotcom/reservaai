import { useState } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, CheckCircle, XCircle, Plus } from "lucide-react";
import {
  useGetTenant,
  getGetTenantQueryKey,
  useGetTenantAnalytics,
  getGetTenantAnalyticsQueryKey,
  useListOnboardingSubmissions,
  getListOnboardingSubmissionsQueryKey,
  useListSubscriptions,
  getListSubscriptionsQueryKey,
  useUpdateTenant,
  useUpdateOnboardingSubmission,
  useCreateSubscription,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout, AuthGuard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const PLANS = ["free", "starter", "pro", "enterprise"] as const;
const STATUSES = ["active", "inactive", "suspended"] as const;

const STATUS_PT: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  suspended: "Suspenso",
  cancelled: "Cancelado",
  expired: "Expirado",
  trialing: "Em teste",
  past_due: "Em atraso",
  paused: "Pausado",
  pending: "Pendente",
  reviewed: "Revisado",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

const SUBMISSION_ACTION_PT: Record<string, string> = {
  approved: "aprovada",
  rejected: "rejeitada",
  reviewed: "revisada",
};

function traduzirStatus(status: string) {
  return STATUS_PT[status] ?? status;
}

function traduzirCiclo(cycle: string) {
  return cycle === "monthly" ? "Mensal" : cycle === "yearly" ? "Anual" : cycle;
}

function statusColor(status: string) {
  if (status === "active" || status === "approved") return "text-emerald-600";
  if (status === "suspended" || status === "rejected") return "text-destructive";
  return "text-muted-foreground";
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tenant, isLoading: tenantLoading } = useGetTenant(id, {
    query: { enabled: !!id, queryKey: getGetTenantQueryKey(id) },
  });
  const { data: analytics } = useGetTenantAnalytics(id, {
    query: { enabled: !!id, queryKey: getGetTenantAnalyticsQueryKey(id) },
  });
  const { data: submissions, isLoading: submissionsLoading } =
    useListOnboardingSubmissions(id, {
      query: { enabled: !!id, queryKey: getListOnboardingSubmissionsQueryKey(id) },
    });
  const { data: subscriptions, isLoading: subsLoading } = useListSubscriptions({
    query: { queryKey: getListSubscriptionsQueryKey() },
  });

  const tenantSubs = subscriptions?.filter((s) => s.tenantId === id) ?? [];

  const updateTenantMutation = useUpdateTenant();
  const updateSubmissionMutation = useUpdateOnboardingSubmission();
  const createSubMutation = useCreateSubscription();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    plan: "free" as (typeof PLANS)[number],
    status: "active" as (typeof STATUSES)[number],
    whatsappPhoneNumberId: "",
  });

  const [subOpen, setSubOpen] = useState(false);
  const [subForm, setSubForm] = useState({
    plan: "starter" as (typeof PLANS)[number],
    billingCycle: "monthly" as "monthly" | "yearly",
    amount: "",
    currency: "USD",
  });

  const openEdit = () => {
    if (!tenant) return;
    setEditForm({
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone ?? "",
      plan: tenant.plan as typeof editForm.plan,
      status: tenant.status as typeof editForm.status,
      whatsappPhoneNumberId: tenant.whatsappPhoneNumberId ?? "",
    });
    setEditOpen(true);
  };

  const handleUpdateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenantMutation.mutate(
      {
        tenantId: id,
        data: {
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone || undefined,
          plan: editForm.plan,
          status: editForm.status,
          whatsappPhoneNumberId: editForm.whatsappPhoneNumberId || undefined,
        },
      },
      {
        onSuccess: () => {
          setEditOpen(false);
          queryClient.invalidateQueries({ queryKey: getGetTenantQueryKey(id) });
          toast({ title: "Empresa atualizada com sucesso" });
        },
        onError: () => {
          toast({ title: "Erro ao atualizar empresa", variant: "destructive" });
        },
      },
    );
  };

  const handleUpdateSubmission = (
    submissionId: string,
    status: "approved" | "rejected" | "reviewed",
  ) => {
    updateSubmissionMutation.mutate(
      { submissionId, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListOnboardingSubmissionsQueryKey(id),
          });
          toast({ title: `Solicitação ${SUBMISSION_ACTION_PT[status] ?? status}` });
        },
        onError: () => {
          toast({ title: "Erro ao atualizar solicitação", variant: "destructive" });
        },
      },
    );
  };

  const handleCreateSub = (e: React.FormEvent) => {
    e.preventDefault();
    createSubMutation.mutate(
      {
        tenantId: id,
        data: {
          plan: subForm.plan,
          billingCycle: subForm.billingCycle,
          amount: subForm.amount || undefined,
          currency: subForm.currency,
        },
      },
      {
        onSuccess: () => {
          setSubOpen(false);
          queryClient.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() });
          toast({ title: "Assinatura criada com sucesso" });
        },
        onError: () => {
          toast({ title: "Erro ao criar assinatura", variant: "destructive" });
        },
      },
    );
  };

  if (tenantLoading) {
    return (
      <AuthGuard>
        <Layout>
          <div className="p-4 sm:p-6 lg:p-7">
            <Skeleton className="h-7 w-48 mb-6" />
            <Skeleton className="h-40 w-full" />
          </div>
        </Layout>
      </AuthGuard>
    );
  }

  if (!tenant) {
    return (
      <AuthGuard>
        <Layout>
          <div className="p-4 sm:p-6 text-sm text-muted-foreground">Empresa não encontrada.</div>
        </Layout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <Layout>
        <div data-testid="page-tenant-detail" className="p-4 sm:p-6 lg:p-7 max-w-5xl mx-auto">
          {/* Voltar + Cabeçalho */}
          <div className="mb-5">
            <Link
              href="/tenants"
              data-testid="link-back-tenants"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
            >
              <ArrowLeft size={13} /> Voltar para Empresas
            </Link>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1
                  data-testid="text-tenant-name"
                  className="text-lg sm:text-xl font-semibold text-foreground tracking-tight truncate"
                >
                  {tenant.name}
                </h1>
                <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground truncate">
                  {tenant.slug}.app &bull; {tenant.email}
                </p>
              </div>
              <Button
                data-testid="button-edit-tenant"
                size="sm"
                variant="outline"
                onClick={openEdit}
                className="shrink-0"
              >
                Editar
              </Button>
            </div>
          </div>

          {/* Abas — scrollable no mobile */}
          <Tabs defaultValue="overview">
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 mb-5">
              <TabsList data-testid="tabs-tenant-detail" className="flex w-max sm:w-auto">
                <TabsTrigger value="overview" data-testid="tab-overview" className="whitespace-nowrap">Visão Geral</TabsTrigger>
                <TabsTrigger value="onboarding" data-testid="tab-onboarding" className="whitespace-nowrap">Onboarding</TabsTrigger>
                <TabsTrigger value="subscriptions" data-testid="tab-subscriptions" className="whitespace-nowrap">Assinaturas</TabsTrigger>
                <TabsTrigger value="analytics" data-testid="tab-analytics" className="whitespace-nowrap">Análise</TabsTrigger>
              </TabsList>
            </div>

            {/* Visão Geral */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <InfoRow label="Plano">
                  <Badge variant="outline" className="capitalize text-xs">{tenant.plan}</Badge>
                </InfoRow>
                <InfoRow label="Status">
                  <span className={`text-sm font-medium ${statusColor(tenant.status)}`}>
                    {traduzirStatus(tenant.status)}
                  </span>
                </InfoRow>
                <InfoRow label="Telefone">{tenant.phone ?? "—"}</InfoRow>
                <InfoRow label="Subdomínio">{tenant.subdomain}</InfoRow>
                <InfoRow label="ID WhatsApp">{tenant.whatsappPhoneNumberId ?? "—"}</InfoRow>
                <InfoRow label="Criado em">
                  {new Date(tenant.createdAt).toLocaleDateString("pt-BR")}
                </InfoRow>
              </div>

              <div className="mt-4 p-4 bg-accent/30 rounded-xl border border-accent-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Link de Onboarding do Cliente</p>
                <a
                  data-testid="link-onboard-public"
                  href={`/onboard/${tenant.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary hover:underline font-mono break-all"
                >
                  /onboard/{tenant.slug}
                </a>
              </div>
            </TabsContent>

            {/* Onboarding */}
            <TabsContent value="onboarding">
              <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                <div className="px-4 sm:px-5 py-3 border-b border-card-border text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20">
                  Solicitações
                </div>
                {submissionsLoading ? (
                  <div className="p-4 sm:p-5 space-y-3">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : !submissions?.length ? (
                  <div className="p-8 sm:p-10 text-center text-sm text-muted-foreground">
                    Nenhuma solicitação ainda
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {submissions.map((sub) => (
                      <div
                        key={sub.id}
                        data-testid={`row-submission-${sub.id}`}
                        className="px-4 sm:px-5 py-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{sub.businessName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 break-words">
                              {sub.contactName} &bull; {sub.email} &bull; {sub.phone}
                            </p>
                            {sub.industry && (
                              <p className="text-xs text-muted-foreground">{sub.industry}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <span className={`text-xs font-medium ${statusColor(sub.status)}`}>
                              {traduzirStatus(sub.status)}
                            </span>
                            {sub.status === "pending" && (
                              <>
                                <Button
                                  data-testid={`button-approve-${sub.id}`}
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                  onClick={() => handleUpdateSubmission(sub.id, "approved")}
                                >
                                  <CheckCircle size={12} className="mr-1" />
                                  Aprovar
                                </Button>
                                <Button
                                  data-testid={`button-reject-${sub.id}`}
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs text-destructive border-destructive/20 hover:bg-destructive/5"
                                  onClick={() => handleUpdateSubmission(sub.id, "rejected")}
                                >
                                  <XCircle size={12} className="mr-1" />
                                  Rejeitar
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Assinaturas */}
            <TabsContent value="subscriptions">
              <div className="mb-4 flex justify-end">
                <Button
                  data-testid="button-create-subscription"
                  size="sm"
                  onClick={() => setSubOpen(true)}
                >
                  <Plus size={13} className="mr-1.5" /> Adicionar Assinatura
                </Button>
              </div>
              <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                {subsLoading ? (
                  <div className="p-4 sm:p-5"><Skeleton className="h-20 w-full" /></div>
                ) : !tenantSubs.length ? (
                  <div className="p-8 sm:p-10 text-center text-sm text-muted-foreground">Nenhuma assinatura</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[400px]">
                      <thead>
                        <tr className="border-b border-card-border bg-muted/30">
                          <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plano</th>
                          <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                          <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ciclo</th>
                          <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                          <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Início</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {tenantSubs.map((sub) => (
                          <tr key={sub.id} data-testid={`row-sub-${sub.id}`} className="hover:bg-muted/20">
                            <td className="px-4 sm:px-5 py-3 capitalize font-medium whitespace-nowrap">{sub.plan}</td>
                            <td className="px-4 sm:px-5 py-3">
                              <span className={`text-xs font-medium whitespace-nowrap ${statusColor(sub.status)}`}>
                                {traduzirStatus(sub.status)}
                              </span>
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">{traduzirCiclo(sub.billingCycle)}</td>
                            <td className="px-4 sm:px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                              {sub.amount ? `${sub.currency} ${sub.amount}` : "—"}
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                              {new Date(sub.startedAt).toLocaleDateString("pt-BR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Análise */}
            <TabsContent value="analytics">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <AnalyticsCard label="Cadastros" value={analytics?.onboardingCount} />
                <AnalyticsCard label="Pendentes" value={analytics?.pendingSubmissions} />
                <AnalyticsCard label="Aprovados" value={analytics?.approvedSubmissions} />
                <AnalyticsCard label="Sessões WA" value={analytics?.whatsappSessionCount} />
                <AnalyticsCard label="Mensagens WA" value={analytics?.whatsappMessageCount} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Diálogo de edição */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent data-testid="dialog-edit-tenant">
            <DialogHeader>
              <DialogTitle>Editar Empresa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateTenant} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  data-testid="input-edit-tenant-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">E-mail</Label>
                <Input
                  id="edit-email"
                  data-testid="input-edit-tenant-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Plano</Label>
                  <Select
                    value={editForm.plan}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, plan: v as typeof f.plan }))}
                  >
                    <SelectTrigger data-testid="select-edit-plan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLANS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as typeof f.status }))}
                  >
                    <SelectTrigger data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {traduzirStatus(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} data-testid="button-cancel-edit">Cancelar</Button>
                <Button type="submit" data-testid="button-submit-edit" disabled={updateTenantMutation.isPending}>
                  {updateTenantMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Diálogo de criação de assinatura */}
        <Dialog open={subOpen} onOpenChange={setSubOpen}>
          <DialogContent data-testid="dialog-create-subscription">
            <DialogHeader>
              <DialogTitle>Adicionar Assinatura</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSub} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label>Plano</Label>
                <Select
                  value={subForm.plan}
                  onValueChange={(v) => setSubForm((f) => ({ ...f, plan: v as typeof f.plan }))}
                >
                  <SelectTrigger data-testid="select-sub-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ciclo de Cobrança</Label>
                  <Select
                    value={subForm.billingCycle}
                    onValueChange={(v) => setSubForm((f) => ({ ...f, billingCycle: v as typeof f.billingCycle }))}
                  >
                    <SelectTrigger data-testid="select-sub-cycle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sub-amount">Valor</Label>
                  <Input
                    id="sub-amount"
                    data-testid="input-sub-amount"
                    type="number"
                    step="0.01"
                    value={subForm.amount}
                    onChange={(e) => setSubForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setSubOpen(false)} data-testid="button-cancel-sub">Cancelar</Button>
                <Button type="submit" data-testid="button-submit-sub" disabled={createSubMutation.isPending}>
                  {createSubMutation.isPending ? "Criando..." : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </Layout>
    </AuthGuard>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function AnalyticsCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="mt-1.5 text-xl sm:text-2xl font-semibold tabular-nums">
        {value !== undefined ? value : <Skeleton className="h-7 w-12 mt-1" />}
      </p>
    </div>
  );
}
