import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Users, Loader2, Plus, X, Phone, Mail, User, Calendar, Clock, CheckCircle2, XCircle, Star, Bot } from "lucide-react";
import { BusinessLayout, getAuthHeaders } from "@/components/business-layout";

interface Client {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string | null;
  status: "pending" | "reviewed" | "approved" | "rejected";
  createdAt: string;
}

interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  scheduledAt: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  whatsappStatus: "pending" | "sent" | "error" | "not_connected";
  reminderSentAt: string | null;
  notes: string | null;
  createdAt: string;
  service: { name: string; price: string; durationMinutes: number } | null;
}

const CLIENT_STATUS = {
  pending:  { label: "Pendente",   cls: "bg-amber-50 text-amber-700 border border-amber-100" },
  reviewed: { label: "Em análise", cls: "bg-blue-50 text-blue-700 border border-blue-100" },
  approved: { label: "Aprovado",   cls: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
  rejected: { label: "Recusado",   cls: "bg-red-50 text-red-600 border border-red-100" },
};

const APPT_STATUS = {
  pending:   { label: "Pendente",    cls: "bg-amber-50 text-amber-700 border border-amber-100" },
  confirmed: { label: "Confirmado",  cls: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
  cancelled: { label: "Cancelado",   cls: "bg-red-50 text-red-600 border border-red-100" },
  completed: { label: "Concluído",   cls: "bg-gray-50 text-gray-500 border border-gray-100" },
};

const WA_STATUS = {
  pending:       { label: "⏳ aguardando",     cls: "text-gray-400" },
  sent:          { label: "✅ WA enviado",     cls: "text-emerald-600" },
  error:         { label: "❌ WA erro",        cls: "text-red-500" },
  not_connected: { label: "⚠️ sem WhatsApp",  cls: "text-amber-500" },
};

interface Survey {
  id: string;
  appointmentId: string;
  clientName: string;
  clientPhone: string;
  status: "pending_send" | "sent" | "responded" | "error";
  sentAt: string | null;
  rating: number | null;
  comment: string | null;
  respondedAt: string | null;
  createdAt: string;
}

interface AiLog {
  id: string;
  clientPhone: string;
  clientName: string;
  userMessage: string;
  aiReply: string | null;
  status: "answered_by_ai" | "waiting_human" | "error";
  createdAt: string;
}

const AI_STATUS = {
  answered_by_ai: { label: "Respondido pela IA", cls: "bg-violet-50 text-violet-700 border border-violet-100" },
  waiting_human:  { label: "Aguardando humano",  cls: "bg-amber-50 text-amber-700 border border-amber-100" },
  error:          { label: "Erro",               cls: "bg-red-50 text-red-600 border border-red-100" },
};

const SURVEY_STATUS = {
  pending_send: { label: "Aguardando envio", cls: "bg-gray-50 text-gray-500 border border-gray-100" },
  sent:         { label: "Aguardando resposta", cls: "bg-blue-50 text-blue-600 border border-blue-100" },
  responded:    { label: "Respondido", cls: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
  error:        { label: "Erro no envio", cls: "bg-red-50 text-red-600 border border-red-100" },
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}`}
        />
      ))}
    </div>
  );
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function durationLabel(mins: number) {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

export default function BusinessClientsPage() {
  const [tab, setTab] = useState<"clients" | "appointments" | "surveys" | "ai">("appointments");
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [aiLogs, setAiLogs] = useState<AiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ contactName: "", businessName: "", phone: "", email: "" });
  const [formError, setFormError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/business/submissions", { headers: getAuthHeaders() }).then((r) => r.json()),
      fetch("/api/business/appointments", { headers: getAuthHeaders() }).then((r) => r.json()),
      fetch("/api/business/surveys", { headers: getAuthHeaders() }).then((r) => r.json()),
      fetch("/api/business/ai-logs", { headers: getAuthHeaders() }).then((r) => r.json()),
    ])
      .then(([c, a, s, ai]) => {
        setClients(Array.isArray(c) ? (c as Client[]) : []);
        setAppointments(Array.isArray(a) ? (a as Appointment[]) : []);
        setSurveys(Array.isArray(s) ? (s as Survey[]) : []);
        setAiLogs(Array.isArray(ai) ? (ai as AiLog[]) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    localStorage.setItem("onboarding_step3_done", "true");
  }, []);

  async function updateAppointmentStatus(id: string, status: Appointment["status"]) {
    setUpdatingStatus(id);
    try {
      const res = await fetch(`/api/business/appointments/${id}/status`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status } : a)),
        );
      }
    } catch {
      // ignore
    } finally {
      setUpdatingStatus(null);
    }
  }

  async function addClient() {
    setFormError("");
    if (!form.contactName.trim()) { setFormError("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/business/clients", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        setFormError(err.error ?? "Erro ao adicionar cliente"); return;
      }
      const newClient = await res.json() as Client;
      setClients((prev) => [newClient, ...prev]);
      setShowAdd(false);
      setForm({ contactName: "", businessName: "", phone: "", email: "" });
    } catch { setFormError("Erro de conexão. Tente novamente."); }
    finally { setSaving(false); }
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-400 transition-colors";
  const totalClients = clients.length + appointments.length;
  const respondedSurveys = surveys.filter((s) => s.status === "responded" && s.rating !== null);

  return (
    <BusinessLayout title="Clientes">
      <div className="px-4 py-6 max-w-2xl mx-auto w-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Clientes</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {totalClients} {totalClients === 1 ? "cliente" : "clientes"} no total
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3.5 py-2 rounded-xl transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab("clients")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "clients" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            <Users className="w-4 h-4" />
            Cadastros
            {clients.length > 0 && (
              <span className="text-xs font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                {clients.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("appointments")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "appointments" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Agenda
            {appointments.length > 0 && (
              <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                {appointments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("surveys")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "surveys" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            <Star className="w-4 h-4" />
            Avaliações
            {respondedSurveys.length > 0 && (
              <span className="text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                {respondedSurveys.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("ai")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "ai" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            <Bot className="w-4 h-4" />
            IA
            {aiLogs.length > 0 && (
              <span className="text-xs font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                {aiLogs.length}
              </span>
            )}
          </button>
        </div>

        {/* Add modal — portal so position:fixed is always relative to viewport on Safari */}
        {showAdd && createPortal(
          <div
            style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 200,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              touchAction: "none",
            }}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {/* Backdrop */}
            <div
              style={{
                position: "absolute", inset: 0,
                background: "rgba(0,0,0,0.45)",
                animation: "fadeInBg 0.22s ease",
              }}
              onClick={() => { setShowAdd(false); setFormError(""); }}
            />
            {/* Sheet — calc(100dvh - 52px) matches services modal; shrinks when keyboard opens */}
            <div
              style={{
                position: "relative",
                height: "calc(100dvh - 52px)",
                borderRadius: "20px 20px 0 0",
                background: "#ffffff",
                boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                animation: "slideUpSheet 0.28s cubic-bezier(0.32,0.72,0,1)",
              }}
            >
              {/* Drag handle */}
              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", flexShrink: 0 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "#d1d5db" }} />
              </div>
              {/* Header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "6px 20px 12px", borderBottom: "1px solid #f3f4f6",
                flexShrink: 0, boxSizing: "border-box",
              }}>
                <h2 style={{ color: "#111827", fontWeight: 700, fontSize: 17, margin: 0 }}>Adicionar cliente</h2>
                <button
                  onClick={() => { setShowAdd(false); setFormError(""); }}
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "#f3f4f6", border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#6b7280", cursor: "pointer", flexShrink: 0,
                  }}
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
              {/* Scrollable body */}
              <div
                style={{
                  flex: 1, overflowY: "auto", overflowX: "hidden",
                  padding: "20px", boxSizing: "border-box",
                  minHeight: 0, WebkitOverflowScrolling: "touch",
                  display: "flex", flexDirection: "column", gap: 16,
                }}
              >
                {[
                  { field: "contactName", label: "Nome completo *", placeholder: "Nome do cliente", icon: User, inputMode: undefined as InputHTMLElement["inputMode"] },
                  { field: "phone", label: "WhatsApp", placeholder: "(11) 99999-9999", icon: Phone, inputMode: "tel" as const },
                  { field: "email", label: "E-mail", placeholder: "email@exemplo.com", icon: Mail, inputMode: "email" as const },
                ].map(({ field, label, placeholder, icon: Icon, inputMode }) => (
                  <div key={field}>
                    <label style={{ display: "block", color: "#374151", fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: "0.03em" }}>{label}</label>
                    <div style={{ position: "relative" }}>
                      <Icon style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#9ca3af" }} />
                      <input
                        value={form[field as keyof typeof form]}
                        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                        placeholder={placeholder}
                        inputMode={inputMode}
                        style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 16px 12px 40px", fontSize: 15, color: "#111827", background: "#fff", boxSizing: "border-box", outline: "none" }}
                      />
                    </div>
                  </div>
                ))}
                {formError && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: 12, padding: "10px 16px" }}>
                    <p style={{ color: "#dc2626", fontSize: 13, margin: 0, fontWeight: 500 }}>{formError}</p>
                  </div>
                )}
              </div>
              {/* Footer — always visible above home indicator */}
              <div style={{
                flexShrink: 0,
                padding: "12px 20px",
                paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
                borderTop: "1px solid #f3f4f6",
                display: "flex", gap: 12,
                background: "#ffffff", boxSizing: "border-box",
              }}>
                <button
                  onClick={() => { setShowAdd(false); setFormError(""); }}
                  style={{
                    flex: 1, height: 50, borderRadius: 16,
                    border: "1.5px solid #e5e7eb", background: "#fff",
                    color: "#374151", fontSize: 15, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={addClient}
                  disabled={saving}
                  style={{
                    flex: 1, height: 50, borderRadius: 16,
                    background: saving ? "#7c3aed99" : "#7c3aed",
                    border: "none", color: "#fff", fontSize: 15, fontWeight: 700,
                    cursor: saving ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
                    transition: "background 0.15s",
                  }}
                >
                  {saving ? (
                    <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />Salvando…</>
                  ) : (
                    "Salvar cliente"
                  )}
                </button>
              </div>
            </div>
          </div>
        , document.body)}

        {/* Content */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
          ) : tab === "clients" ? (
            clients.length === 0 ? (
              <div className="py-14 px-5 text-center">
                <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Users className="w-5 h-5 text-gray-300" />
                </div>
                <p className="text-gray-700 text-sm font-semibold">Nenhum cadastro ainda</p>
                <p className="text-gray-400 text-xs mt-1.5 leading-relaxed max-w-xs mx-auto">
                  Clientes que preencherem seu formulário de cadastro aparecerão aqui.
                </p>
                <button onClick={() => setShowAdd(true)}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-xl transition-colors">
                  <Plus className="w-4 h-4" />Adicionar primeiro cliente
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {clients.map((c) => {
                  const badge = CLIENT_STATUS[c.status] ?? CLIENT_STATUS.pending;
                  return (
                    <div key={c.id} className="px-5 py-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                        <span className="text-violet-700 text-sm font-bold">{c.contactName.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 text-sm font-semibold truncate">{c.contactName}</p>
                        <p className="text-gray-400 text-xs truncate">{c.phone || c.email || "—"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                        <span className="text-gray-300 text-[10px]">{timeAgo(c.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : tab === "appointments" ? (
            appointments.length === 0 ? (
              <div className="py-14 px-5 text-center">
                <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-5 h-5 text-gray-300" />
                </div>
                <p className="text-gray-700 text-sm font-semibold">Nenhum agendamento ainda</p>
                <p className="text-gray-400 text-xs mt-1.5 leading-relaxed max-w-xs mx-auto">
                  Quando clientes agendarem pelo link público, os agendamentos aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {appointments.map((a) => {
                  const badge = APPT_STATUS[a.status] ?? APPT_STATUS.pending;
                  return (
                    <div key={a.id} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-gray-900 text-sm font-semibold truncate">{a.clientName}</p>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>{badge.label}</span>
                          </div>
                          {a.service && (
                            <p className="text-violet-600 text-xs font-semibold mt-0.5 truncate">
                              {a.service.name} · {durationLabel(a.service.durationMinutes)}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-gray-400 text-xs">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDateTime(a.scheduledAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-gray-400 text-xs truncate">{a.clientPhone}</p>
                            {(() => {
                              const wa = WA_STATUS[a.whatsappStatus] ?? WA_STATUS.pending;
                              return (
                                <span className={`text-[10px] font-semibold shrink-0 ${wa.cls}`}>
                                  {wa.label}
                                </span>
                              );
                            })()}
                            {a.reminderSentAt && (
                              <span className="text-[10px] font-semibold text-violet-500 shrink-0">
                                🔔 lembrete enviado
                              </span>
                            )}
                            {a.notes?.includes("[Cancelado via WhatsApp") && (
                              <span className="text-[10px] font-semibold text-red-400 shrink-0">
                                📲 cancelado via WA
                              </span>
                            )}
                            {a.notes?.includes("[Reagendado via WhatsApp") && (
                              <span className="text-[10px] font-semibold text-blue-500 shrink-0">
                                🔄 reagendado via WA
                              </span>
                            )}
                          </div>
                          {(a.status === "pending" || a.status === "confirmed") && (
                            <div className="flex items-center gap-2 mt-2.5">
                              {a.status === "pending" && (
                                <button
                                  onClick={() => updateAppointmentStatus(a.id, "confirmed")}
                                  disabled={updatingStatus === a.id}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                >
                                  {updatingStatus === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                  Confirmar
                                </button>
                              )}
                              <button
                                onClick={() => updateAppointmentStatus(a.id, "cancelled")}
                                disabled={updatingStatus === a.id}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-50"
                              >
                                {updatingStatus === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* ── Surveys tab ── */
            surveys.length === 0 ? (
              <div className="py-14 px-5 text-center">
                <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Star className="w-5 h-5 text-gray-300" />
                </div>
                <p className="text-gray-700 text-sm font-semibold">Nenhuma avaliação ainda</p>
                <p className="text-gray-400 text-xs mt-1.5 leading-relaxed max-w-xs mx-auto">
                  As pesquisas de satisfação são enviadas automaticamente 1h após cada atendimento.
                </p>
              </div>
            ) : (
              <div>
                {/* Summary row */}
                {respondedSurveys.length > 0 && (() => {
                  const avg = respondedSurveys.reduce((s, r) => s + (r.rating ?? 0), 0) / respondedSurveys.length;
                  const satisfied = respondedSurveys.filter((r) => (r.rating ?? 0) >= 4).length;
                  return (
                    <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 flex items-center gap-4">
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-extrabold text-amber-600">{avg.toFixed(1)}</span>
                        <StarRating rating={Math.round(avg)} />
                      </div>
                      <div className="h-8 w-px bg-amber-200" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{respondedSurveys.length} avaliações</p>
                        <p className="text-xs text-amber-700 font-medium">
                          {Math.round((satisfied / respondedSurveys.length) * 100)}% satisfeitos
                        </p>
                      </div>
                    </div>
                  );
                })()}
                <div className="divide-y divide-gray-100">
                  {surveys.map((s) => {
                    const badge = SURVEY_STATUS[s.status] ?? SURVEY_STATUS.pending_send;
                    return (
                      <div key={s.id} className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                            <Star className={`w-4 h-4 ${s.rating !== null ? "text-amber-400 fill-amber-400" : "text-amber-300"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-gray-900 text-sm font-semibold truncate">{s.clientName}</p>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>
                            {s.rating !== null && (
                              <div className="flex items-center gap-2 mt-1">
                                <StarRating rating={s.rating} />
                                <span className="text-xs font-bold text-amber-600">{s.rating}/5</span>
                              </div>
                            )}
                            {s.comment && (
                              <p className="text-gray-500 text-xs mt-0.5 italic">"{s.comment}"</p>
                            )}
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <p className="text-gray-400 text-xs">{s.clientPhone}</p>
                              <span className="text-gray-200 text-xs">·</span>
                              <p className="text-gray-400 text-xs">
                                {timeAgo(s.respondedAt ?? s.sentAt ?? s.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}

        {/* ── AI tab ─────────────────────────────────────────────────────── */}
        {tab === "ai" && (
          loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
            </div>
          ) : aiLogs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
                  <Bot className="w-7 h-7 text-violet-400" />
                </div>
                <p className="text-gray-900 font-semibold text-sm">Nenhuma conversa ainda</p>
                <p className="text-gray-400 text-xs mt-1">
                  Quando clientes mandarem mensagens no WhatsApp, a IA responderá automaticamente e os logs aparecerão aqui.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {(() => {
                const answered = aiLogs.filter((l) => l.status === "answered_by_ai").length;
                const waiting = aiLogs.filter((l) => l.status === "waiting_human").length;
                const errors = aiLogs.filter((l) => l.status === "error").length;
                return (
                  <div className="px-5 py-3 bg-violet-50 border-b border-violet-100 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-violet-600" />
                      <span className="text-sm font-bold text-violet-700">{answered} respondidos pela IA</span>
                    </div>
                    {waiting > 0 && (
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                        {waiting} aguardando humano
                      </span>
                    )}
                    {errors > 0 && (
                      <span className="text-xs font-semibold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                        {errors} com erro
                      </span>
                    )}
                  </div>
                );
              })()}
              <div className="divide-y divide-gray-100">
                {aiLogs.map((log) => {
                  const badge = AI_STATUS[log.status] ?? AI_STATUS.answered_by_ai;
                  return (
                    <div key={log.id} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-violet-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-gray-900 text-sm font-semibold truncate">
                              {log.clientName || log.clientPhone}
                            </p>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                          <div className="bg-gray-50 rounded-xl rounded-tl-none px-3 py-2 mb-1.5 max-w-xs">
                            <p className="text-gray-700 text-xs">{log.userMessage}</p>
                          </div>
                          {log.aiReply && (
                            <div className="bg-violet-50 rounded-xl rounded-tr-none px-3 py-2 mb-1.5 max-w-xs ml-auto">
                              <p className="text-violet-800 text-xs">{log.aiReply}</p>
                            </div>
                          )}
                          {log.status === "waiting_human" && !log.aiReply && (
                            <p className="text-amber-600 text-xs italic mt-1">
                              IA não conseguiu responder — cliente aguarda atendimento humano.
                            </p>
                          )}
                          {log.status === "error" && (
                            <p className="text-red-500 text-xs italic mt-1">
                              Erro ao processar mensagem pela IA.
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-gray-400 text-xs">{log.clientPhone}</p>
                            <span className="text-gray-200 text-xs">·</span>
                            <p className="text-gray-400 text-xs">{timeAgo(log.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
        </div>
      </div>
    </BusinessLayout>
  );
}

// Needed for TypeScript - suppressing implicit any on input element
interface InputHTMLElement { inputMode?: "tel" | "email" | "numeric" | "decimal" | "search" | "none" | "text" | "url" | undefined; }
