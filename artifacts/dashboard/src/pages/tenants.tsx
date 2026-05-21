import { useState } from "react";
import { Link } from "wouter";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import {
  useListTenants,
  getListTenantsQueryKey,
  useCreateTenant,
  useDeleteTenant,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout, AuthGuard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const PLANS = ["free", "starter", "pro", "enterprise"] as const;

function planColor(plan: string) {
  if (plan === "enterprise") return "default";
  if (plan === "pro") return "secondary";
  return "outline";
}

function traduzirStatus(status: string) {
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

export default function TenantsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: tenants, isLoading } = useListTenants({
    query: { queryKey: getListTenantsQueryKey() },
  });

  const createMutation = useCreateTenant();
  const deleteMutation = useDeleteTenant();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    plan: "free" as (typeof PLANS)[number],
    whatsappPhoneNumberId: "",
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      {
        data: {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          plan: form.plan,
          whatsappPhoneNumberId: form.whatsappPhoneNumberId || undefined,
        },
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setForm({ name: "", email: "", phone: "", plan: "free", whatsappPhoneNumberId: "" });
          queryClient.invalidateQueries({ queryKey: getListTenantsQueryKey() });
          toast({ title: "Empresa criada com sucesso" });
        },
        onError: () => {
          toast({ title: "Erro ao criar empresa", variant: "destructive" });
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(
      { tenantId: id },
      {
        onSuccess: () => {
          setDeleteId(null);
          queryClient.invalidateQueries({ queryKey: getListTenantsQueryKey() });
          toast({ title: "Empresa excluída com sucesso" });
        },
        onError: () => {
          toast({ title: "Erro ao excluir empresa", variant: "destructive" });
        },
      },
    );
  };

  return (
    <AuthGuard>
      <Layout>
        <div data-testid="page-tenants" className="p-4 sm:p-6 lg:p-7 max-w-6xl mx-auto">
          {/* Cabeçalho */}
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
                Empresas
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {tenants ? `${tenants.length} no total` : "Carregando..."}
              </p>
            </div>
            <Button
              data-testid="button-create-tenant"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="shrink-0"
            >
              <Plus size={14} className="mr-1.5" />
              <span className="hidden xs:inline">Nova </span>Empresa
            </Button>
          </div>

          {/* Tabela com scroll horizontal no mobile */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-card-border bg-muted/30">
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      E-mail
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Plano
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Slug
                    </th>
                    <th className="px-4 sm:px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading
                    ? [...Array(4)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={6} className="px-4 sm:px-5 py-3">
                            <Skeleton className="h-5 w-full" />
                          </td>
                        </tr>
                      ))
                    : tenants?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                          Nenhuma empresa cadastrada ainda.
                        </td>
                      </tr>
                    ) : (
                      tenants?.map((tenant) => (
                        <tr
                          key={tenant.id}
                          data-testid={`row-tenant-${tenant.id}`}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 sm:px-5 py-3 font-medium text-foreground whitespace-nowrap">
                            {tenant.name}
                          </td>
                          <td className="px-4 sm:px-5 py-3 text-muted-foreground text-xs">
                            {tenant.email}
                          </td>
                          <td className="px-4 sm:px-5 py-3">
                            <Badge variant={planColor(tenant.plan) as "default" | "secondary" | "outline"} className="text-xs capitalize">
                              {tenant.plan}
                            </Badge>
                          </td>
                          <td className="px-4 sm:px-5 py-3">
                            <span className={`text-xs font-medium ${statusColor(tenant.status)}`}>
                              {traduzirStatus(tenant.status)}
                            </span>
                          </td>
                          <td className="px-4 sm:px-5 py-3 text-muted-foreground font-mono text-xs whitespace-nowrap">
                            {tenant.slug}
                          </td>
                          <td className="px-4 sm:px-5 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <Link href={`/tenants/${tenant.id}`}>
                                <Button
                                  data-testid={`button-view-tenant-${tenant.id}`}
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <ExternalLink size={13} />
                                </Button>
                              </Link>
                              <Button
                                data-testid={`button-delete-tenant-${tenant.id}`}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(tenant.id)}
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Diálogo de criação */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent data-testid="dialog-create-tenant">
            <DialogHeader>
              <DialogTitle>Criar Empresa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="tenant-name">Nome da Empresa *</Label>
                <Input
                  id="tenant-name"
                  data-testid="input-tenant-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-email">E-mail *</Label>
                <Input
                  id="tenant-email"
                  data-testid="input-tenant-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-phone">Telefone</Label>
                <Input
                  id="tenant-phone"
                  data-testid="input-tenant-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-plan">Plano</Label>
                <Select
                  value={form.plan}
                  onValueChange={(v) => setForm((f) => ({ ...f, plan: v as typeof form.plan }))}
                >
                  <SelectTrigger id="tenant-plan" data-testid="select-tenant-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-wa">ID do Número WhatsApp</Label>
                <Input
                  id="tenant-wa"
                  data-testid="input-tenant-whatsapp"
                  value={form.whatsappPhoneNumberId}
                  onChange={(e) => setForm((f) => ({ ...f, whatsappPhoneNumberId: e.target.value }))}
                  placeholder="ID do número Meta"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  data-testid="button-cancel-create"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  data-testid="button-submit-create-tenant"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Criando..." : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Confirmar exclusão */}
        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent data-testid="dialog-delete-tenant">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Empresa</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A empresa e todos os dados associados serão excluídos permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                data-testid="button-confirm-delete"
                onClick={() => deleteId && handleDelete(deleteId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Layout>
    </AuthGuard>
  );
}
