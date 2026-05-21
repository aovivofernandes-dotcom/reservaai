import { useState, useEffect } from "react";
import { MessageCircle, Loader2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { BusinessLayout, getAuthHeaders } from "@/components/business-layout";

interface Conversation {
  id: string;
  phone: string;
  flowStep: string;
  status: "active" | "completed" | "abandoned";
  sessionData: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

const STEP_LABELS: Record<string, string> = {
  welcome: "Início",
  business_name: "Nome do negócio",
  contact_name: "Nome do contato",
  email: "E-mail",
  phone: "Telefone",
  industry: "Segmento",
  notes: "Observações",
  complete: "Concluído",
};

function statusIcon(status: string) {
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (status === "abandoned") return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
  return <Clock className="w-4 h-4 text-amber-500 shrink-0" />;
}

function statusLabel(status: string) {
  if (status === "completed") return { text: "Concluída", cls: "bg-emerald-50 text-emerald-700 border border-emerald-100" };
  if (status === "abandoned") return { text: "Abandonada", cls: "bg-red-50 text-red-600 border border-red-100" };
  return { text: "Em andamento", cls: "bg-amber-50 text-amber-700 border border-amber-100" };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 2) return "agora há pouco";
  if (mins < 60) return `há ${mins} min`;
  if (hours < 24) return `há ${hours}h`;
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

function maskPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length >= 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length >= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return phone;
}

export default function BusinessConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business/conversations", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        setConversations(Array.isArray(data) ? (data as Conversation[]) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Mark step 2 as visited
    localStorage.setItem("onboarding_step2_done", "true");
  }, []);

  return (
    <BusinessLayout title="Conversas">
      <div className="px-4 py-6 max-w-2xl mx-auto w-full space-y-5">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Conversas</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Mensagens recebidas pelo seu WhatsApp
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-14 px-5 text-center">
              <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="w-5 h-5 text-gray-300" />
              </div>
              <p className="text-gray-700 text-sm font-semibold">Nenhuma conversa ainda</p>
              <p className="text-gray-400 text-xs mt-1.5 leading-relaxed max-w-xs mx-auto">
                Quando alguém enviar uma mensagem para o seu WhatsApp, as conversas aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map((conv) => {
                const badge = statusLabel(conv.status);
                const name =
                  (conv.sessionData?.contactName as string | undefined) ??
                  (conv.sessionData?.businessName as string | undefined) ??
                  maskPhone(conv.phone);

                return (
                  <div key={conv.id} className="px-5 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <span className="text-emerald-700 text-sm font-bold">
                        {name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 text-sm font-semibold truncate">{name}</p>
                      <p className="text-gray-400 text-xs truncate">
                        {maskPhone(conv.phone)} · Etapa: {STEP_LABELS[conv.flowStep] ?? conv.flowStep}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.text}
                      </span>
                      <span className="text-gray-300 text-[10px]">{timeAgo(conv.updatedAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info card */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
          <MessageCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-emerald-800 text-sm font-semibold">Como funciona?</p>
            <p className="text-emerald-700 text-xs mt-1 leading-relaxed">
              Quando um cliente manda mensagem para o seu WhatsApp, o sistema inicia uma conversa automática
              e coleta as informações. Ao final, o cliente aparece na lista de Clientes.
            </p>
          </div>
        </div>
      </div>
    </BusinessLayout>
  );
}
