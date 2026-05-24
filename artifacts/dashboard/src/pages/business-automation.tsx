import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MessageCircle,
  Clock,
  CalendarCheck,
  Star,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MessageSquare,
  Activity,
  Loader2,
  Send,
  LogOut,
  QrCode,
  X,
  ScanLine,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BusinessLayout } from "@/components/business-layout";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface RecentSession {
  id: string;
  phone: string;
  status: "active" | "completed" | "abandoned";
  flowStep: string;
  updatedAt: string;
}

interface WhatsAppStatus {
  connectionType: string;
  evoConfigured: boolean;
  tenantPhoneNumberId: string | null;
  tenantWhatsappPhone: string | null;
  tenantWhatsappConnectedAt: string | null;
  whatsappProfileName: string | null;
  whatsappProfilePhoto: string | null;
  automationsEnabled: boolean;
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  lastActivityAt: string | null;
  recentSessions: RecentSession[];
  tenantPhone: string | null;
}

type QrState = "idle" | "loading" | "qr" | "connected" | "error";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d !== 1 ? "s" : ""}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 8) {
    return `+${digits.slice(0, digits.length - 6)}••••${digits.slice(-2)}`;
  }
  return phone;
}

const FLOW_STEP_LABELS: Record<string, string> = {
  welcome: "Iniciando",
  business_name: "Nome do negócio",
  contact_name: "Nome do contato",
  email: "E-mail",
  phone: "Telefone",
  industry: "Segmento",
  notes: "Observações",
  complete: "Concluído",
};

const AUTOMATIONS = [
  {
    icon: MessageCircle,
    color: "bg-emerald-50 text-emerald-600",
    title: "Resposta automática",
    description: "Quando um cliente envia mensagem, o bot responde e coleta as informações de contato.",
    key: "response",
  },
  {
    icon: CalendarCheck,
    color: "bg-blue-50 text-blue-600",
    title: "Confirmação de agendamento",
    description: "Envia confirmação automática quando um agendamento é criado.",
    key: "booking",
  },
  {
    icon: Clock,
    color: "bg-violet-50 text-violet-600",
    title: "Lembrete 24h antes",
    description: "Lembra o cliente automaticamente um dia antes do compromisso.",
    key: "reminder",
  },
  {
    icon: Star,
    color: "bg-amber-50 text-amber-600",
    title: "Pesquisa de satisfação",
    description: "Após o atendimento, pede avaliação automática do cliente.",
    key: "survey",
  },
];

// ── WhatsApp SVG icon ──────────────────────────────────────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ── QR Modal ───────────────────────────────────────────────────────────────────

function QrModal({
  qrState,
  qrCode,
  onClose,
}: {
  qrState: QrState;
  qrCode: string | null;
  onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={qrState !== "loading" ? onClose : undefined}
      />

      <div className="relative z-10 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm mx-0 sm:mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
              <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-none">Conectar WhatsApp</p>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-none">Escaneie o QR Code com seu celular</p>
            </div>
          </div>
          {qrState !== "loading" && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-6 flex flex-col items-center gap-5">

          {/* Loading */}
          {qrState === "loading" && (
            <>
              <div className="w-52 h-52 bg-gray-50 rounded-2xl flex flex-col items-center justify-center gap-3 border border-gray-100">
                <Loader2 className="w-8 h-8 text-[#25D366] animate-spin" />
                <p className="text-gray-400 text-xs font-medium">Gerando QR Code…</p>
              </div>
              <p className="text-gray-400 text-xs">Aguarde um momento</p>
            </>
          )}

          {/* QR ready */}
          {qrState === "qr" && qrCode && (
            <>
              <div className="relative">
                {/* WhatsApp corners */}
                <div className="w-56 h-56 rounded-2xl overflow-hidden border-[3px] border-[#25D366] shadow-lg shadow-[#25D366]/10">
                  <img src={qrCode} alt="QR Code WhatsApp" className="w-full h-full object-cover" />
                </div>
                {/* Scan line */}
                <div
                  className="absolute left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-transparent via-[#25D366] to-transparent"
                  style={{ animation: "scanLine 2s ease-in-out infinite", top: "50%" }}
                />
              </div>

              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5">
                  <ScanLine className="w-3.5 h-3.5 text-[#25D366]" />
                  <p className="text-gray-800 text-sm font-bold">Abra o WhatsApp no celular</p>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed max-w-[240px]">
                  Vá em <strong>⋮ → Aparelhos conectados → Conectar aparelho</strong> e aponte a câmera.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Aguardando leitura…
              </div>
            </>
          )}

          {/* Connected */}
          {qrState === "connected" && (
            <>
              <div className="w-20 h-20 rounded-full bg-[#25D366]/10 border-4 border-[#25D366]/20 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-[#25D366]" strokeWidth={1.5} />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-gray-900 font-bold text-base">Conectado com sucesso!</p>
                <p className="text-gray-400 text-sm">Suas automações já estão ativas.</p>
              </div>
            </>
          )}

          {/* Error */}
          {qrState === "error" && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-gray-900 font-semibold text-sm">Não foi possível gerar o QR Code</p>
                <p className="text-gray-400 text-xs">Tente novamente ou fale com o suporte.</p>
              </div>
              <button
                onClick={onClose}
                className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm"
              >
                Fechar
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scanLine {
          0% { top: 10%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
      `}</style>
    </div>,
    document.body,
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  accent: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm">
      <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center", color)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div>
        <p className={cn("font-extrabold text-2xl leading-none tracking-tight", accent)}>{value}</p>
        <p className="text-gray-400 text-[11px] mt-1 leading-none">{label}</p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function BusinessAutomationPage() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [disconnecting, setDisconnecting] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);

  // QR modal
  const [qrModal, setQrModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrState, setQrState] = useState<QrState>("idle");
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = localStorage.getItem("business_token") ?? "";

  function authHeaders() {
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  const fetchStatus = useCallback(
    async (silent = false) => {
      if (!silent) setStatusLoading(true);
      else setRefreshing(true);
      setStatusError(null);
      try {
        const res = await fetch("/api/business/whatsapp/status", { headers: authHeaders() });
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          setStatusError(d.error ?? `Erro ${res.status}`);
          return;
        }
        setStatus((await res.json()) as WhatsAppStatus);
      } catch {
        setStatusError("Não foi possível carregar o status. Verifique sua conexão.");
      } finally {
        setStatusLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  );

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(true), 30_000);
    return () => {
      clearInterval(interval);
      if (qrPollRef.current) clearInterval(qrPollRef.current);
    };
  }, [fetchStatus]);

  // ── QR Connect ─────────────────────────────────────────────────────────────

  function stopQrPolling() {
    if (qrPollRef.current) { clearInterval(qrPollRef.current); qrPollRef.current = null; }
  }

  function startQrPolling() {
    stopQrPolling();
    qrPollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/business/whatsapp/evo/qr", { headers: authHeaders() });
        if (!res.ok) return;
        const data = (await res.json()) as { state: string; qr: string | null };

        if (data.state === "open") {
          stopQrPolling();
          setQrState("connected");
          toast.success("WhatsApp conectado! Automações ativas.");
          setTimeout(() => { setQrModal(false); setQrState("idle"); fetchStatus(true); }, 2500);
          return;
        }
        if (data.qr) { setQrCode(data.qr); setQrState("qr"); }
      } catch { /* ignore */ }
    }, 3000);
  }

  async function handleConnect() {
    setQrModal(true);
    setQrState("loading");
    setQrCode(null);
    try {
      const res = await fetch("/api/business/whatsapp/evo/connect", {
        method: "POST",
        headers: authHeaders(),
      });
      const data = (await res.json()) as { notConfigured?: boolean; qr?: string | null; error?: string };

      if (data.notConfigured) {
        setQrModal(false);
        return;
      }
      if (data.error || !data.qr) { setQrState("error"); return; }

      setQrCode(data.qr);
      setQrState("qr");
      startQrPolling();
    } catch {
      setQrState("error");
    }
  }

  function closeQrModal() {
    stopQrPolling();
    setQrModal(false);
    setQrState("idle");
    setQrCode(null);
  }

  // ── Disconnect ─────────────────────────────────────────────────────────────

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/business/whatsapp/disconnect", { method: "POST", headers: authHeaders() });
      if (res.ok) {
        toast.success("WhatsApp desconectado.");
        await fetchStatus(true);
        setShowTest(false);
      } else {
        toast.error("Erro ao desconectar.");
      }
    } catch {
      toast.error("Erro ao desconectar.");
    } finally {
      setDisconnecting(false);
    }
  }

  // ── Test message ───────────────────────────────────────────────────────────

  async function handleTestMessage() {
    const digits = testPhone.replace(/\D/g, "");
    if (digits.length < 10) { toast.error("Digite um número válido com DDD."); return; }
    setTestSending(true);
    try {
      const res = await fetch("/api/business/whatsapp/test-message", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ to: `55${digits}` }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        toast.success("Mensagem de teste enviada! Verifique seu WhatsApp.");
        setTestPhone(""); setShowTest(false);
      } else {
        toast.error(data.error ?? "Erro ao enviar mensagem.");
      }
    } catch {
      toast.error("Erro ao enviar mensagem de teste.");
    } finally {
      setTestSending(false);
    }
  }

  const isConnected = Boolean(status?.tenantPhoneNumberId);
  const hasActivity = (status?.totalSessions ?? 0) > 0;
  const [proModal, setProModal] = useState(false);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <BusinessLayout title="WhatsApp">
      <div className="px-4 py-6 max-w-2xl mx-auto w-full space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Automação WhatsApp</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Conecte seu número e ative respostas automáticas, confirmações e lembretes.
            </p>
          </div>
          <button
            onClick={() => fetchStatus(true)}
            disabled={refreshing || statusLoading}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </button>
        </div>

        {/* ── Connection card ── */}
        {statusLoading ? (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 flex items-center gap-3 animate-pulse">
            <div className="w-12 h-12 rounded-2xl bg-gray-200 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-gray-200 rounded w-40" />
              <div className="h-3 bg-gray-200 rounded w-56" />
            </div>
          </div>
        ) : statusError ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{statusError}</p>
          </div>
        ) : isConnected ? (
          /* ── CONNECTED ── */
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl overflow-hidden">
            <div className="p-5 flex items-start gap-4">
              {/* Profile photo or icon */}
              <div className="shrink-0">
                {status?.whatsappProfilePhoto ? (
                  <img
                    src={status.whatsappProfilePhoto}
                    alt="Foto do perfil"
                    className="w-12 h-12 rounded-2xl object-cover ring-2 ring-[#25D366]/30"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                      (e.currentTarget.nextSibling as HTMLElement)?.style.setProperty("display", "flex");
                    }}
                  />
                ) : null}
                <div
                  className={cn(
                    "w-12 h-12 bg-[#25D366]/15 rounded-2xl items-center justify-center",
                    status?.whatsappProfilePhoto ? "hidden" : "flex",
                  )}
                >
                  <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-green-800 font-bold text-base">
                    {status?.whatsappProfileName ?? "WhatsApp conectado"}
                  </p>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                    <span className="text-[#16a34a] text-xs font-semibold">ao vivo</span>
                  </span>
                </div>
                {status?.tenantWhatsappPhone && (
                  <p className="text-green-700 text-sm font-semibold mt-0.5">
                    +{status.tenantWhatsappPhone}
                  </p>
                )}
                <p className="text-green-600 text-xs mt-0.5">
                  Conectado{" "}
                  {status?.tenantWhatsappConnectedAt
                    ? `· ${formatRelative(status.tenantWhatsappConnectedAt)}`
                    : ""}
                </p>
              </div>
            </div>

            <div className="border-t border-[#bbf7d0] px-5 py-3 flex items-center gap-3">
              <button
                onClick={() => setShowTest((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-900 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Testar envio
              </button>
              <span className="text-green-300">·</span>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 text-xs font-semibold text-green-600 hover:text-red-600 transition-colors"
              >
                {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                Desconectar
              </button>
            </div>

            {showTest && (
              <div className="border-t border-[#bbf7d0] px-5 py-4 bg-white">
                <p className="text-gray-700 text-sm font-semibold mb-1">Enviar mensagem de teste</p>
                <p className="text-gray-400 text-xs mb-3">
                  Digite seu número para confirmar que o bot está funcionando.
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 gap-2">
                    <span className="text-gray-400 text-sm shrink-0">🇧🇷 +55</span>
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="92 99999-9999"
                      className="flex-1 bg-transparent py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-300"
                    />
                  </div>
                  <button
                    onClick={handleTestMessage}
                    disabled={testSending || !testPhone}
                    className={cn(
                      "px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5",
                      testPhone && !testSending
                        ? "bg-[#25D366] hover:bg-[#22c55e] text-white"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed",
                    )}
                  >
                    {testSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Enviar
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : status?.evoConfigured === false ? (
          /* ── DIRECT LINK (API not set up – wa.me mode) ── */
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-[#25D366]/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-[#25D366]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-green-800 font-bold text-sm">WhatsApp conectado</p>
                <p className="text-green-700/70 text-xs mt-1 leading-relaxed">
                  Seu sistema usa link direto para enviar confirmações e comprovantes pelo WhatsApp.
                </p>
              </div>
              <span className="flex items-center gap-1 shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                <span className="text-[#16a34a] text-xs font-semibold">ativo</span>
              </span>
            </div>
            <div className="border-t border-[#bbf7d0] px-5 py-3 flex items-center gap-3 flex-wrap">
              {status?.tenantPhone && (
                <>
                  <a
                    href={`https://wa.me/55${status.tenantPhone.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Estou testando o WhatsApp do ReservaAI.")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-900 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Testar WhatsApp
                  </a>
                  <span className="text-green-300">·</span>
                </>
              )}
              <a
                href="https://wa.me/5592992208060?text=Ol%C3%A1%20preciso%20de%20ajuda%20com%20o%20WhatsApp%20do%20ReservaAI"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#25D366] hover:text-green-900 transition-colors"
              >
                <WhatsAppIcon className="w-3 h-3" />
                Fale com o suporte
              </a>
            </div>
          </div>
        ) : (
          /* ── NOT CONNECTED (API ready, just not linked yet) ── */
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-[#25D366]/10 flex items-center justify-center shrink-0">
                <WifiOff className="w-5 h-5 text-[#25D366]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-bold text-sm">WhatsApp não conectado</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  Conecte seu número para ativar as automações.
                </p>
              </div>
              <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={handleConnect}
                className="flex items-center justify-center gap-2 w-full h-10 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" }}
              >
                <QrCode className="w-4 h-4" />
                Conectar via QR Code
              </button>
              <div className="flex items-center justify-center gap-1.5 mt-2 text-gray-400 text-[11px]">
                <CheckCircle2 className="w-3 h-3 text-[#25D366] shrink-0" />
                Escaneie com o WhatsApp Business no celular
              </div>
            </div>
          </div>
        )}

        {/* ── Stats ── */}
        {!statusLoading && !statusError && (
          <div className="grid grid-cols-3 gap-2.5">
            <StatCard
              label="Conversas"
              value={status?.totalSessions ?? 0}
              icon={MessageSquare}
              color="bg-blue-50 text-blue-500"
              accent="text-blue-600"
            />
            <StatCard
              label="Em andamento"
              value={status?.activeSessions ?? 0}
              icon={Activity}
              color="bg-violet-50 text-violet-500"
              accent="text-violet-600"
            />
            <StatCard
              label="Concluídas"
              value={status?.completedSessions ?? 0}
              icon={CheckCircle2}
              color="bg-emerald-50 text-emerald-500"
              accent="text-emerald-600"
            />
          </div>
        )}

        {/* ── Recent sessions ── */}
        {!statusLoading && !statusError && hasActivity && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-gray-300" />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Conversas recentes</p>
            </div>
            <div className="divide-y divide-gray-50">
              {status!.recentSessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      s.status === "completed" ? "bg-emerald-100" : s.status === "active" ? "bg-blue-100" : "bg-gray-100",
                    )}
                  >
                    <Phone className={cn("w-3.5 h-3.5", s.status === "completed" ? "text-emerald-600" : s.status === "active" ? "text-blue-600" : "text-gray-400")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm font-semibold truncate">{maskPhone(s.phone)}</p>
                    <p className="text-gray-400 text-xs">
                      {FLOW_STEP_LABELS[s.flowStep] ?? s.flowStep} · {formatRelative(s.updatedAt)}
                    </p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 border",
                    s.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : s.status === "active" ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-gray-50 text-gray-500 border-gray-100",
                  )}>
                    {s.status === "completed" ? "concluído" : s.status === "active" ? "ativo" : "abandonado"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No activity when connected */}
        {!statusLoading && !statusError && !hasActivity && isConnected && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
            <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-500 text-sm font-semibold">Aguardando primeiras mensagens</p>
            <p className="text-gray-400 text-xs mt-1">
              Quando um cliente enviar mensagem, ela aparecerá aqui.
            </p>
          </div>
        )}

        {/* ── Automations list ── */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mb-2.5">Automações</p>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
            {AUTOMATIONS.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setProModal(true)}
                  className={cn(
                    "w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100",
                    i === 0 && "rounded-t-2xl",
                    i === AUTOMATIONS.length - 1 && "rounded-b-2xl",
                  )}
                >
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", item.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm font-semibold leading-none">{item.title}</p>
                    <p className="text-gray-400 text-[11px] mt-1 leading-snug line-clamp-1">{item.description}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 bg-violet-50 text-violet-600 border border-violet-100 whitespace-nowrap">
                    Plano Pro
                  </span>
                </button>
              );
            })}
          </div>
          {!isConnected && (
            <p className="text-[11px] text-gray-400 px-1 mt-2 text-center">
              Automações avançadas disponíveis com a API oficial do WhatsApp Business.{" "}
              <a
                href="https://wa.me/5592992208060?text=Ol%C3%A1%2C%20quero%20saber%20mais%20sobre%20as%20automa%C3%A7%C3%B5es%20do%20plano%20Pro"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#25D366] hover:underline"
              >
                Falar com suporte
              </a>
            </p>
          )}
        </div>

      </div>

      {/* QR Modal */}
      {qrModal && <QrModal qrState={qrState} qrCode={qrCode} onClose={closeQrModal} />}

      {/* Pro Feature Modal */}
      {proModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div
            className="absolute inset-0 bg-black/50"
            style={{ backdropFilter: "blur(4px)" }}
            onClick={() => setProModal(false)}
          />
          <div className="relative z-10 bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm overflow-hidden shadow-2xl">
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center">
                <Zap className="w-7 h-7 text-violet-500" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-[15px]">Recurso do Plano Pro</p>
                <p className="text-gray-500 text-sm mt-2 leading-relaxed max-w-[280px] mx-auto">
                  Este recurso será ativado com a API oficial do WhatsApp Business.
                </p>
              </div>
              <a
                href="https://wa.me/5592992208060?text=Ol%C3%A1%2C%20quero%20saber%20mais%20sobre%20as%20automa%C3%A7%C3%B5es%20do%20plano%20Pro"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2.5 w-full rounded-2xl font-bold text-white text-sm transition-opacity hover:opacity-90 active:opacity-80"
                style={{ height: 48, background: "linear-gradient(135deg,#25D366 0%,#128C7E 100%)" }}
              >
                <WhatsAppIcon className="w-5 h-5" />
                Falar com suporte
              </a>
              <button
                onClick={() => setProModal(false)}
                className="text-gray-400 text-sm hover:text-gray-600 transition-colors pb-1"
              >
                Fechar
              </button>
            </div>
            <div style={{ height: "max(0px, env(safe-area-inset-bottom, 0px))" }} />
          </div>
        </div>,
        document.body,
      )}
    </BusinessLayout>
  );
}
