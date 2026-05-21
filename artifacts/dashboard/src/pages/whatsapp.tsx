import { useState } from "react";
import { Send, MessageCircle, Lock, CheckCircle, Clock, Zap, ChevronRight } from "lucide-react";
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

function traduzirStatusSessao(status: string) {
  const map: Record<string, string> = {
    completed: "Concluída",
    abandoned: "Abandonada",
    active: "Ativa",
  };
  return map[status] ?? status;
}

function statusColor(status: string) {
  if (status === "completed") return "text-emerald-600 bg-emerald-50";
  if (status === "abandoned") return "text-rose-600 bg-rose-50";
  return "text-blue-600 bg-blue-50";
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

const SUPPORT_WA_LINK =
  "https://wa.me/5511999999999?text=" +
  encodeURIComponent("Olá, quero ativar o WhatsApp automático no meu ReservaAI.");

export default function WhatsappPage() {
  const { toast } = useToast();
  const { data: sessions, isLoading } = useListWhatsappSessions(undefined, {
    query: { queryKey: getListWhatsappSessionsQueryKey() },
  });

  const sendMutation = useSendWhatsappMessage();
  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ to: "", message: "" });

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

  const total = sessions?.length ?? 0;
  const active = sessions?.filter((s) => s.status === "active").length ?? 0;
  const completed = sessions?.filter((s) => s.status === "completed").length ?? 0;
  const isConnected = !isLoading && total > 0;

  return (
    <AuthGuard>
      <Layout>
        <div data-testid="page-whatsapp" className="p-4 sm:p-6 lg:p-7 max-w-3xl mx-auto space-y-5">

          {/* ── Page header ── */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
                WhatsApp
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Automação e atendimento via WhatsApp
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
                Enviar Mensagem
              </Button>
            )}
          </div>

          {/* ── Activation hero card ── */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Green top stripe */}
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-green-500" />

            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* WhatsApp icon */}
                <div className="shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-md shadow-emerald-100">
                  <MessageCircle className="w-8 h-8 text-white" strokeWidth={2} />
                </div>

                <div className="flex-1 text-center sm:text-left">
                  {/* Status badge */}
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-3 ${isConnected ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-amber-400"}`} />
                    {isConnected ? "Conectado" : "Aguardando ativação"}
                  </span>

                  <h2 className="text-gray-900 font-bold text-lg leading-snug">
                    {isConnected
                      ? "WhatsApp ativo"
                      : "WhatsApp ainda não conectado"}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1.5 leading-relaxed max-w-md">
                    {isConnected
                      ? "Seu WhatsApp está ativo. Respostas automáticas, confirmações e lembretes estão funcionando."
                      : "Conecte o WhatsApp da sua empresa para ativar respostas automáticas, confirmações e lembretes de agendamento."}
                  </p>

                  {!isConnected && (
                    <>
                      <a
                        href={SUPPORT_WA_LINK}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white text-sm font-bold transition-all shadow-md shadow-emerald-100 active:scale-[0.98]"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Solicitar ativação do WhatsApp
                        <ChevronRight className="w-4 h-4 opacity-80" />
                      </a>

                      <p className="mt-3 text-xs text-gray-400 flex items-center gap-1.5 justify-center sm:justify-start">
                        <CheckCircle className="w-3.5 h-3.5 text-gray-300" />
                        A integração será ativada pela equipe ReservaAI
                      </p>
                    </>
                  )}

                  {isConnected && (
                    <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
                      <button
                        onClick={() => setSendOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Enviar mensagem
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Stats cards ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Conversas",
                value: isLoading ? "—" : String(total),
                icon: MessageCircle,
                color: "text-violet-600",
                bg: "bg-violet-50",
              },
              {
                label: "Em andamento",
                value: isLoading ? "—" : String(active),
                icon: Clock,
                color: "text-blue-600",
                bg: "bg-blue-50",
              },
              {
                label: "Concluídas",
                value: isLoading ? "—" : String(completed),
                icon: CheckCircle,
                color: "text-emerald-600",
                bg: "bg-emerald-50",
              },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center gap-2"
              >
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className="text-xl font-bold text-gray-900 leading-none">
                  {isLoading ? <span className="inline-block w-5 h-5 bg-gray-100 rounded animate-pulse" /> : value}
                </p>
                <p className="text-[11px] text-gray-400 font-medium leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Automation card ── */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-500" />
              <h3 className="text-sm font-semibold text-gray-800">Automação</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {[
                { label: "Resposta automática", desc: "Responde novos contatos automaticamente" },
                { label: "Confirmação de agendamento", desc: "Envia confirmação ao cliente após agendar" },
                { label: "Lembrete 24h antes", desc: "Avisa o cliente um dia antes do serviço" },
              ].map(({ label, desc }) => (
                <div key={label} className="px-5 py-4 flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isConnected ? "bg-emerald-50" : "bg-gray-50"}`}>
                    {isConnected
                      ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                      : <Lock className="w-4 h-4 text-gray-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-tight ${isConnected ? "text-gray-800" : "text-gray-400"}`}>
                      {label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${isConnected ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-gray-400 bg-gray-50 border-gray-200"}`}>
                    {isConnected ? "Ativo" : "Aguardando"}
                  </span>
                </div>
              ))}
            </div>
            {!isConnected && (
              <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
                <span className="text-amber-500 text-xs">⚡</span>
                <p className="text-xs text-amber-700 font-medium">
                  Ative o WhatsApp para liberar todas as automações
                </p>
              </div>
            )}
          </div>

          {/* ── Sessions table (only when there are sessions) ── */}
          {(isLoading || total > 0) && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Conversas recentes</h3>
                {total > 0 && (
                  <span className="text-xs text-gray-400 font-medium">{total} no total</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Telefone</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Etapa</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Iniciado</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Atualizado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoading
                      ? [...Array(3)].map((_, i) => (
                          <tr key={i}>
                            <td colSpan={5} className="px-5 py-3">
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
                            <td className="px-5 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{session.phone}</td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(session.status)}`}>
                                {traduzirStatusSessao(session.status)}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                              {stepLabel(session.flowStep)}
                            </td>
                            <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                              {new Date(session.createdAt).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                              {new Date(session.updatedAt).toLocaleDateString("pt-BR")}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Send message dialog ── */}
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
