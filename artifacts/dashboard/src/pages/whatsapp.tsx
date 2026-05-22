import { useState, useEffect, useCallback } from "react";
import {
  Send,
  MessageCircle,
  CheckCircle,
  Clock,
  Zap,
  Loader2,
  Bell,
  Star,
  RefreshCw,
  MessageSquare,
  CalendarCheck,
  ChevronRight,
} from "lucide-react";
import {
  useListWhatsappSessions,
  getListWhatsappSessionsQueryKey,
  useSendWhatsappMessage,
} from "@workspace/api-client-react";
import { Layout, AuthGuard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const SUPPORT_WA =
  "https://wa.me/5592992208060?text=" +
  encodeURIComponent("Olá! Preciso de ajuda para conectar o WhatsApp no ReservaAI.");

function getAdminToken() {
  return localStorage.getItem("admin_token") ?? "";
}

function adminHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getAdminToken()}`,
    "Content-Type": "application/json",
  };
}

// ── Automation types ──────────────────────────────────────────────────────────

type AutomationKey =
  | "autoReply"
  | "bookingConfirmation"
  | "reminder24h"
  | "satisfactionSurvey";

const API_KEY_MAP: Record<AutomationKey, string> = {
  autoReply: "wa_auto_reply",
  bookingConfirmation: "wa_booking_confirmation",
  reminder24h: "wa_reminder_24h",
  satisfactionSurvey: "wa_satisfaction_survey",
};

interface AutomationState {
  autoReply: boolean;
  bookingConfirmation: boolean;
  reminder24h: boolean;
  satisfactionSurvey: boolean;
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  loading,
  onChange,
  disabled,
}: {
  checked: boolean;
  loading: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || loading}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
        checked
          ? "bg-violet-600"
          : "bg-gray-200"
      } ${disabled || loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      >
        {loading && (
          <Loader2 className="w-2.5 h-2.5 text-violet-500 animate-spin" />
        )}
      </span>
    </button>
  );
}

// ── Session helpers ───────────────────────────────────────────────────────────

function traduzirStatusSessao(status: string) {
  const map: Record<string, string> = {
    completed: "Concluída",
    abandoned: "Abandonada",
    active: "Ativa",
  };
  return map[status] ?? status;
}

function statusColor(status: string) {
  if (status === "completed") return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (status === "abandoned") return "text-rose-600 bg-rose-50 border-rose-200";
  return "text-blue-600 bg-blue-50 border-blue-200";
}

function stepLabel(step: string) {
  const labels: Record<string, string> = {
    welcome: "Boas-vindas",
    business_name: "Nome da Empresa",
    contact_name: "Nome do Contato",
    email: "E-mail",
    phone: "Telefone",
    industry: "Setor",
    notes: "Observações",
    complete: "Concluído",
  };
  return labels[step] ?? step;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WhatsappPage() {
  const { toast } = useToast();

  const { data: sessions, isLoading } = useListWhatsappSessions(undefined, {
    query: { queryKey: getListWhatsappSessionsQueryKey() },
  });

  const sendMutation = useSendWhatsappMessage();
  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ to: "", message: "" });

  // ── Automation state ──────────────────────────────────────────────────────

  const [automations, setAutomations] = useState<AutomationState>({
    autoReply: true,
    bookingConfirmation: true,
    reminder24h: true,
    satisfactionSurvey: false,
  });
  const [loadingAuto, setLoadingAuto] = useState(true);
  const [togglingKey, setTogglingKey] = useState<AutomationKey | null>(null);

  const fetchAutomations = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/whatsapp-automations", {
        headers: adminHeaders(),
      });
      if (res.ok) {
        const data = (await res.json()) as AutomationState;
        setAutomations(data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingAuto(false);
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  async function toggleAutomation(key: AutomationKey) {
    const next = !automations[key];
    setTogglingKey(key);

    // Optimistic update
    setAutomations((prev) => ({ ...prev, [key]: next }));

    try {
      const res = await fetch("/api/admin/whatsapp-automations", {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ key: API_KEY_MAP[key], value: next }),
      });
      if (res.ok) {
        toast({
          title: next ? "Automação ativada" : "Automação desativada",
          description: next
            ? "A automação foi ligada com sucesso."
            : "A automação foi desligada.",
        });
      } else {
        // Revert
        setAutomations((prev) => ({ ...prev, [key]: !next }));
        toast({ title: "Erro ao salvar", variant: "destructive" });
      }
    } catch {
      setAutomations((prev) => ({ ...prev, [key]: !next }));
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setTogglingKey(null);
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMutation.mutate(
      { data: { to: sendForm.to, message: sendForm.message } },
      {
        onSuccess: (result) => {
          setSendOpen(false);
          setSendForm({ to: "", message: "" });
          toast({
            title: result.status === "sent" ? "Mensagem enviada" : "Falha no envio",
            variant: result.status === "sent" ? "default" : "destructive",
          });
        },
        onError: () => {
          toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
        },
      },
    );
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const total = sessions?.length ?? 0;
  const active = sessions?.filter((s) => s.status === "active").length ?? 0;
  const completed = sessions?.filter((s) => s.status === "completed").length ?? 0;
  const isConnected = !isLoading && total > 0;

  const AUTOMATIONS: {
    key: AutomationKey;
    label: string;
    desc: string;
    icon: React.ElementType;
    iconColor: string;
    iconBg: string;
  }[] = [
    {
      key: "autoReply",
      label: "Resposta automática",
      desc: "Responde novos contatos automaticamente via WhatsApp",
      icon: MessageSquare,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
    },
    {
      key: "bookingConfirmation",
      label: "Confirmação de agendamento",
      desc: "Envia confirmação ao cliente logo após agendar",
      icon: CalendarCheck,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
    },
    {
      key: "reminder24h",
      label: "Lembrete 24h antes",
      desc: "Avisa o cliente um dia antes do serviço marcado",
      icon: Bell,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
    },
    {
      key: "satisfactionSurvey",
      label: "Pesquisa de satisfação",
      desc: "Pede avaliação após a conclusão do serviço",
      icon: Star,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-50",
    },
  ];

  return (
    <AuthGuard>
      <Layout>
        <div
          data-testid="page-whatsapp"
          className="p-4 sm:p-6 lg:p-7 max-w-2xl mx-auto space-y-4"
        >
          {/* ── Page header ───────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                WhatsApp
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Automações e conversas via WhatsApp
              </p>
            </div>
            {isConnected && (
              <Button
                data-testid="button-send-message"
                size="sm"
                onClick={() => setSendOpen(true)}
                className="shrink-0"
              >
                <Send size={13} className="mr-1.5" />
                Enviar
              </Button>
            )}
          </div>

          {/* ── Connection card ───────────────────────────────────────────── */}
          {!isLoading && !isConnected ? (
            // ── NOT CONNECTED: premium CTA card ──────────────────────────
            <div className="relative overflow-hidden bg-gradient-to-br from-violet-700 to-violet-900 rounded-2xl p-6 shadow-xl shadow-violet-200">
              {/* glow blob */}
              <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-emerald-400/10 blur-2xl" />

              <div className="relative flex flex-col sm:flex-row items-start gap-5">
                {/* Icon */}
                <div className="shrink-0 w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <MessageCircle className="w-7 h-7 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Aguardando conexão
                  </span>

                  <h2 className="text-white font-black text-xl leading-tight tracking-tight">
                    Conecte seu WhatsApp
                  </h2>
                  <p className="text-violet-200 text-sm mt-2 leading-relaxed max-w-sm">
                    Ative mensagens automáticas, confirmações e lembretes para seus clientes.
                  </p>

                  <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                    <a
                      href={SUPPORT_WA}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold transition-all shadow-lg shadow-emerald-900/30 active:scale-[0.98]"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Conectar WhatsApp
                      <ChevronRight className="w-4 h-4 opacity-70" />
                    </a>

                    <a
                      href={SUPPORT_WA}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 text-sm font-medium transition-all active:scale-[0.98]"
                    >
                      Precisa de ajuda? Falar com suporte
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : isConnected ? (
            // ── CONNECTED: status card ───────────────────────────────────
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-green-500" />
              <div className="p-5 flex items-center gap-4">
                <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-md shadow-emerald-100">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 font-bold text-[15px]">WhatsApp ativo</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Conectado
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mt-0.5">
                    Respostas automáticas e lembretes ativos
                  </p>
                </div>
                <button
                  onClick={() => setSendOpen(true)}
                  className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Enviar
                </button>
              </div>
            </div>
          ) : (
            // ── LOADING ──────────────────────────────────────────────────
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-48" />
                </div>
              </div>
            </div>
          )}

          {/* ── Stats ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Conversas", value: total, icon: MessageCircle, color: "text-violet-600", bg: "bg-violet-50" },
              { label: "Em andamento", value: active, icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Concluídas", value: completed, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center gap-2"
              >
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className="text-xl font-black text-gray-900 leading-none">
                  {isLoading
                    ? <span className="inline-block w-6 h-5 bg-gray-100 rounded animate-pulse" />
                    : value}
                </p>
                <p className="text-[11px] text-gray-400 font-medium leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Automations ───────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <h3 className="text-sm font-bold text-gray-800">Automações</h3>
              </div>
              {loadingAuto ? (
                <div className="w-4 h-4 rounded-full bg-gray-100 animate-pulse" />
              ) : (
                <button
                  onClick={fetchAutomations}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Recarregar"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Automation rows */}
            <div className="divide-y divide-gray-50">
              {AUTOMATIONS.map(({ key, label, desc, icon: Icon, iconColor, iconBg }) => (
                <div
                  key={key}
                  className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                  {loadingAuto ? (
                    <div className="w-11 h-6 rounded-full bg-gray-100 animate-pulse shrink-0" />
                  ) : (
                    <Toggle
                      checked={automations[key]}
                      loading={togglingKey === key}
                      onChange={() => toggleAutomation(key)}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Footer hint when not connected */}
            {!isLoading && !isConnected && (
              <div className="px-5 py-3 bg-violet-50 border-t border-violet-100 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <p className="text-xs text-violet-600 font-medium">
                  Conecte o WhatsApp para que as automações entrem em ação
                </p>
              </div>
            )}
          </div>

          {/* ── Sessions table ─────────────────────────────────────────────── */}
          {(isLoading || total > 0) && (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">Conversas recentes</h3>
                {total > 0 && (
                  <span className="text-xs text-gray-400 font-medium">{total} no total</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/60">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Telefone</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Etapa</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Início</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {isLoading
                      ? [...Array(3)].map((_, i) => (
                          <tr key={i}>
                            <td colSpan={4} className="px-5 py-3">
                              <Skeleton className="h-5 w-full" />
                            </td>
                          </tr>
                        ))
                      : sessions!.map((session) => (
                          <tr
                            key={session.id}
                            data-testid={`row-session-${session.id}`}
                            className="hover:bg-gray-50/60 transition-colors"
                          >
                            <td className="px-5 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                              {session.phone}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor(session.status)}`}>
                                {traduzirStatusSessao(session.status)}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                              {stepLabel(session.flowStep)}
                            </td>
                            <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                              {new Date(session.createdAt).toLocaleDateString("pt-BR")}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Send message dialog ───────────────────────────────────────────── */}
        <Dialog open={sendOpen} onOpenChange={setSendOpen}>
          <DialogContent data-testid="dialog-send-message">
            <DialogHeader>
              <DialogTitle>Enviar Mensagem WhatsApp</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSend} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="wa-to">Para (número de telefone)</Label>
                <Input
                  id="wa-to"
                  data-testid="input-wa-to"
                  value={sendForm.to}
                  onChange={(e) => setSendForm((f) => ({ ...f, to: e.target.value }))}
                  placeholder="+5511999990000"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wa-message">Mensagem</Label>
                <Textarea
                  id="wa-message"
                  data-testid="input-wa-message"
                  value={sendForm.message}
                  onChange={(e) => setSendForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Digite sua mensagem..."
                  rows={3}
                  required
                />
              </div>
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSendOpen(false)}
                  data-testid="button-cancel-send"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  data-testid="button-confirm-send"
                  disabled={sendMutation.isPending}
                >
                  {sendMutation.isPending ? "Enviando..." : "Enviar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </Layout>
    </AuthGuard>
  );
}
