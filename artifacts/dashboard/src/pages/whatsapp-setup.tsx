import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Building2,
  Phone,
  Activity,
  Shield,
  Server,
  Play,
  X,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout, AuthGuard } from "@/components/layout";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConnectedTenant {
  id: string;
  name: string;
  phone: string | null;
  profileName: string | null;
  connectedAt: string | null;
}

interface ConfigStatus {
  url: string | null;
  keyConfigured: boolean;
  fromEnv: boolean;
  configured: boolean;
  apiOnline: boolean;
  instancesCount: number;
  connectedTenantsCount: number;
  connectedTenants: ConnectedTenant[];
}

type StepStatus = "ok" | "error" | "waiting" | "skipped" | "pending";

interface TestStep {
  id: string;
  label: string;
  status: StepStatus;
  message: string;
}

type TestPhase = "idle" | "starting" | "waiting_scan" | "polling" | "done";

// All 10 checklist labels shown upfront as "pending"
const CHECKLIST_LABELS = [
  "URL da Evolution API configurada",
  "Chave de API configurada",
  "Conexão com o servidor Evolution API",
  "Instância de teste criada",
  "QR Code gerado com sucesso",
  "WhatsApp Business conectado",
  "Número conectado identificado",
  "Mensagem de teste enviada",
  "Recebimento confirmado",
  "Automações prontas para usar",
];

const CHECKLIST_IDS = [
  "url", "key", "connection", "instance", "qr",
  "scan", "phone", "message", "receipt", "automations",
];

function pendingSteps(): TestStep[] {
  return CHECKLIST_LABELS.map((label, i) => ({
    id: CHECKLIST_IDS[i]!,
    label,
    status: "pending",
    message: "",
  }));
}

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
  return `há ${d}d`;
}

function getAdminToken() {
  return localStorage.getItem("admin_token") ?? "";
}

function adminHeaders() {
  return {
    Authorization: `Bearer ${getAdminToken()}`,
    "Content-Type": "application/json",
  };
}

// ── StepIcon ───────────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "ok")
    return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
  if (status === "error")
    return <XCircle className="w-5 h-5 text-red-500 shrink-0" />;
  if (status === "waiting")
    return <Loader2 className="w-5 h-5 text-blue-500 shrink-0 animate-spin" />;
  if (status === "skipped")
    return <SkipForward className="w-5 h-5 text-gray-400 shrink-0" />;
  return (
    <span className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0 inline-block" />
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function WhatsAppSetupPage() {
  // Config state
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  // Test wizard state
  const [testPhase, setTestPhase] = useState<TestPhase>("idle");
  const [testSteps, setTestSteps] = useState<TestStep[]>(pendingSteps());
  const [testQr, setTestQr] = useState<string | null>(null);
  const [testAllOk, setTestAllOk] = useState<boolean | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Config fetch ─────────────────────────────────────────────────────────────

  const fetchConfig = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/admin/whatsapp-config", { headers: adminHeaders() });
      if (res.ok) {
        const data = (await res.json()) as ConfigStatus;
        setStatus(data);
        if (!silent) {
          setUrl(data.url ?? "");
          setKey("");
        }
      }
    } catch {
      if (!silent) toast.error("Erro ao carregar configurações.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    const interval = setInterval(() => fetchConfig(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchConfig]);

  async function handleSave() {
    if (!url.trim()) {
      toast.error("URL da Evolution API é obrigatória.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = { url: url.trim() };
      if (key.trim()) body.key = key.trim();

      const res = await fetch("/api/admin/whatsapp-config", {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success("Configuração salva! Aguarde o diagnóstico atualizar.");
        setKey("");
        await fetchConfig(true);
      } else {
        toast.error("Erro ao salvar configuração.");
      }
    } catch {
      toast.error("Erro ao salvar configuração.");
    } finally {
      setSaving(false);
    }
  }

  // ── Test wizard ──────────────────────────────────────────────────────────────

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (qrTimeoutRef.current) {
      clearTimeout(qrTimeoutRef.current);
      qrTimeoutRef.current = null;
    }
  }

  function mergeSteps(incoming: TestStep[], base: TestStep[]): TestStep[] {
    const byId = Object.fromEntries(incoming.map((s) => [s.id, s]));
    return base.map((s) => byId[s.id] ?? s);
  }

  async function startTest() {
    stopPolling();
    setTestPhase("starting");
    setTestQr(null);
    setTestAllOk(null);
    setTestSteps(pendingSteps());

    try {
      const res = await fetch("/api/admin/whatsapp-test/start", {
        method: "POST",
        headers: adminHeaders(),
      });
      const data = (await res.json()) as {
        steps: TestStep[];
        qr: string | null;
        done: boolean;
      };

      setTestSteps((prev) => mergeSteps(data.steps, prev));

      if (data.qr) {
        setTestQr(data.qr);
        setTestPhase("waiting_scan");
        startPolling();

        // QR timeout at 3 minutes
        qrTimeoutRef.current = setTimeout(() => {
          setTestSteps((prev) =>
            prev.map((s) =>
              s.id === "scan"
                ? { ...s, status: "error", message: "QR Code expirou (3 min). Tente novamente." }
                : s,
            ),
          );
          stopPolling();
          setTestPhase("done");
          setTestAllOk(false);
        }, 3 * 60 * 1000);
      } else {
        const hasError = data.steps.some((s) => s.status === "error");
        setTestPhase("done");
        setTestAllOk(!hasError);
      }
    } catch {
      toast.error("Erro ao iniciar o teste. Tente novamente.");
      setTestPhase("idle");
    }
  }

  function startPolling() {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/whatsapp-test/poll", { headers: adminHeaders() });
        const data = (await res.json()) as {
          connected: boolean;
          qr: string | null;
          steps: TestStep[];
          done: boolean;
          allOk?: boolean;
        };

        if (data.qr) setTestQr(data.qr);

        if (data.done) {
          stopPolling();
          setTestSteps((prev) => mergeSteps(data.steps, prev));
          setTestQr(null);
          setTestPhase("done");
          setTestAllOk(data.allOk ?? false);
        }
      } catch {
        // silent — keep polling
      }
    }, 4_000);
  }

  async function cancelTest() {
    stopPolling();
    setTestPhase("idle");
    setTestSteps(pendingSteps());
    setTestQr(null);
    setTestAllOk(null);

    await fetch("/api/admin/whatsapp-test/cancel", {
      method: "POST",
      headers: adminHeaders(),
    }).catch(() => null);
  }

  useEffect(() => () => stopPolling(), []);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const isConfigured = status?.configured ?? false;
  const isOnline = status?.apiOnline ?? false;
  const isTestRunning = testPhase === "starting" || testPhase === "waiting_scan" || testPhase === "polling";

  return (
    <AuthGuard>
      <Layout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-foreground">Evolution API</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Configure e monitore a conexão WhatsApp dos clientes.
              </p>
            </div>
            <button
              onClick={() => fetchConfig(true)}
              disabled={refreshing || loading}
              className="p-2 rounded-lg border hover:bg-accent transition-colors text-muted-foreground"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </button>
          </div>

          {/* ── Diagnostic badges ── */}
          {!loading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Configurada",
                  ok: isConfigured,
                  icon: Shield,
                  yes: "URL + Chave",
                  no: "Não configurada",
                },
                {
                  label: "API Online",
                  ok: isOnline,
                  icon: Server,
                  yes: "Respondendo",
                  no: "Offline / Inacessível",
                },
                {
                  label: "Instâncias",
                  ok: (status?.instancesCount ?? 0) > 0,
                  icon: Activity,
                  yes: `${status?.instancesCount ?? 0} ativa(s)`,
                  no: "Nenhuma",
                },
                {
                  label: "Empresas",
                  ok: (status?.connectedTenantsCount ?? 0) > 0,
                  icon: Building2,
                  yes: `${status?.connectedTenantsCount} conectada(s)`,
                  no: "Nenhuma conectada",
                },
              ].map(({ label, ok, icon: Icon, yes, no }) => (
                <div
                  key={label}
                  className={cn(
                    "rounded-xl border p-3.5 space-y-2",
                    ok ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {label}
                    </span>
                    {ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn("w-4 h-4 shrink-0", ok ? "text-emerald-600" : "text-gray-400")} />
                    <p className={cn("text-sm font-semibold", ok ? "text-emerald-700" : "text-gray-500")}>
                      {ok ? yes : no}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border p-3.5 bg-gray-50 animate-pulse h-20" />
              ))}
            </div>
          )}

          {/* ── API Status summary ── */}
          {!loading && (
            <div
              className={cn(
                "rounded-xl border p-4 flex items-center gap-3",
                isOnline
                  ? "bg-emerald-50 border-emerald-200"
                  : isConfigured
                    ? "bg-amber-50 border-amber-200"
                    : "bg-gray-50 border-gray-200",
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  isOnline ? "bg-emerald-100" : isConfigured ? "bg-amber-100" : "bg-gray-100",
                )}
              >
                {isOnline ? (
                  <Wifi className="w-5 h-5 text-emerald-600" />
                ) : isConfigured ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                ) : (
                  <WifiOff className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">
                  {isOnline
                    ? "Evolution API online e respondendo"
                    : isConfigured
                      ? "API configurada mas não está respondendo"
                      : "Evolution API não configurada"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {isOnline
                    ? (status?.url ?? "")
                    : isConfigured
                      ? "Verifique se o servidor está no ar e a URL está correta."
                      : "Preencha a URL e a chave de API abaixo para ativar o WhatsApp."}
                </p>
              </div>
              {isOnline && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-emerald-600">ao vivo</span>
                </div>
              )}
            </div>
          )}

          {/* ── Config form ── */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="font-semibold text-sm text-foreground">Configuração da API</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Os valores são salvos no banco de dados e têm prioridade sobre variáveis de ambiente.
              </p>
            </div>
            <div className="px-5 py-5 space-y-4">
              {status?.fromEnv && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    URL carregada da variável de ambiente{" "}
                    <code className="font-mono">EVOLUTION_API_URL</code>.
                    Salvar abaixo irá sobrescrever com o valor do banco.
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">URL da Evolution API</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://api.seuservidor.com"
                  className="w-full h-10 px-3 rounded-lg border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground">
                  URL base da sua instância Evolution API (sem barra no final).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  API Key
                  {status?.keyConfigured && !key && (
                    <span className="ml-2 text-emerald-600 font-normal">✓ já configurada</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={
                      status?.keyConfigured
                        ? "Deixe em branco para manter a chave atual"
                        : "Insira a chave de API"
                    }
                    className="w-full h-10 px-3 pr-10 rounded-lg border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Chave global da instância Evolution API (campo{" "}
                  <code className="font-mono">apikey</code> no header).
                </p>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !url.trim()}
                className={cn(
                  "flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-semibold transition-all",
                  url.trim() && !saving
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar configuração
              </button>
            </div>
          </div>

          {/* ── Integration Test Wizard ──────────────────────────────────────── */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-sm text-foreground">Teste da integração</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Valida cada etapa do fluxo WhatsApp em tempo real.
                </p>
              </div>

              {testPhase === "idle" || testPhase === "done" ? (
                <button
                  onClick={startTest}
                  className="flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  Executar teste da integração
                </button>
              ) : (
                <button
                  onClick={cancelTest}
                  className="flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-semibold border hover:bg-accent transition-all shrink-0 text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancelar
                </button>
              )}
            </div>

            <div className="px-5 py-4 space-y-1">
              {testSteps.map((step, i) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-start gap-3 py-3 border-b last:border-b-0",
                    step.status === "pending" && "opacity-40",
                  )}
                >
                  {/* Step number or icon */}
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <span className="text-[11px] text-muted-foreground w-4 text-right font-mono">
                      {i + 1}
                    </span>
                    <StepIcon status={step.status} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        step.status === "ok" && "text-foreground",
                        step.status === "error" && "text-red-700",
                        step.status === "waiting" && "text-blue-700",
                        step.status === "skipped" && "text-muted-foreground",
                        step.status === "pending" && "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </p>
                    {step.message && (
                      <p
                        className={cn(
                          "text-xs mt-0.5 leading-relaxed",
                          step.status === "error" ? "text-red-600" : "text-muted-foreground",
                        )}
                      >
                        {step.message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* QR display while waiting for scan */}
            {testQr && testPhase === "waiting_scan" && (
              <div className="px-5 pb-5">
                <div className="rounded-xl border-2 border-dashed border-[#25D366]/40 bg-[#f0fdf4] p-5 flex flex-col items-center gap-4">
                  <p className="text-sm font-semibold text-[#128C7E]">
                    Abra o WhatsApp → Aparelhos conectados → Conectar aparelho
                  </p>
                  <div className="relative">
                    <img
                      src={testQr}
                      alt="QR Code WhatsApp"
                      className="w-52 h-52 rounded-xl border-4 border-white shadow-md"
                    />
                    {/* Scan line animation */}
                    <div
                      className="absolute left-1 right-1 h-0.5 bg-[#25D366] opacity-80 rounded-full"
                      style={{
                        animation: "scanLine 2s linear infinite",
                        top: "10%",
                      }}
                    />
                    <style>{`
                      @keyframes scanLine {
                        0%   { top: 10%; opacity: 1; }
                        45%  { opacity: 1; }
                        50%  { top: 88%; opacity: 0.6; }
                        55%  { opacity: 1; }
                        100% { top: 10%; opacity: 1; }
                      }
                    `}</style>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#128C7E]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Aguardando conexão… QR atualiza automaticamente</span>
                  </div>
                </div>
              </div>
            )}

            {/* Result summary */}
            {testPhase === "done" && testAllOk !== null && (
              <div
                className={cn(
                  "mx-5 mb-5 rounded-xl border p-4 flex items-start gap-3",
                  testAllOk
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-red-50 border-red-200",
                )}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    testAllOk ? "bg-emerald-100" : "bg-red-100",
                  )}
                >
                  {testAllOk ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div>
                  <p className={cn("font-semibold text-sm", testAllOk ? "text-emerald-800" : "text-red-800")}>
                    {testAllOk
                      ? "Integração 100% funcional!"
                      : "Alguns passos falharam"}
                  </p>
                  <p className={cn("text-xs mt-0.5", testAllOk ? "text-emerald-700" : "text-red-700")}>
                    {testAllOk
                      ? "A Evolution API está configurada, conectada e enviando mensagens. Seus clientes já podem conectar os números deles."
                      : "Verifique as etapas com ❌ acima e corrija antes de liberar aos clientes."}
                  </p>
                </div>
              </div>
            )}

            {/* Idle hint */}
            {testPhase === "idle" && (
              <div className="px-5 pb-4 text-xs text-muted-foreground">
                Clique em "Executar teste" para validar cada etapa automaticamente — da configuração até o envio de mensagem real.
              </div>
            )}
          </div>

          {/* ── Connected tenants ── */}
          {!loading && (status?.connectedTenants.length ?? 0) > 0 && (
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm text-foreground">Empresas conectadas</h2>
                <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {status!.connectedTenants.length}
                </span>
              </div>
              <div className="divide-y">
                {status!.connectedTenants.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-emerald-700">
                        {t.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {t.profileName ?? t.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.phone ? `+${t.phone}` : "—"} · {formatRelative(t.connectedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs text-emerald-600 font-semibold">conectado</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Instructions ── */}
          <div className="bg-muted/50 border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Como configurar</h3>
            <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside leading-relaxed">
              <li>
                Instale a <strong>Evolution API v2</strong> em um servidor (VPS, Railway, Render, etc.).
              </li>
              <li>
                Copie a URL base (ex:{" "}
                <code className="font-mono">https://api.seuservidor.com</code>) e a{" "}
                <strong>API Key global</strong>.
              </li>
              <li>
                Cole os valores acima e clique em <strong>Salvar configuração</strong>.
              </li>
              <li>
                Verifique que o badge <strong>"API Online"</strong> ficou verde.
              </li>
              <li>
                Use o botão <strong>"Executar teste da integração"</strong> para validar o fluxo completo.
              </li>
              <li>
                Após aprovado, cada empresa pode entrar no app e clicar em{" "}
                <strong>"Conectar número"</strong> para escanear o QR Code.
              </li>
            </ol>
          </div>

        </div>
      </Layout>
    </AuthGuard>
  );
}
