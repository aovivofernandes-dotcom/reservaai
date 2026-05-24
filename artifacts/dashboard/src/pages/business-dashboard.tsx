import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import {
  Loader2,
  Calendar,
  LayoutGrid,
  ChevronRight,
  Clock,
  Copy,
  Check,
  Share2,
  CalendarPlus,
  Star,
  X,
} from "lucide-react";
import { BusinessLayout, getAuthHeaders } from "@/components/business-layout";

function WhatsAppSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function ShareModal({ link, onClose }: { link: string; onClose: () => void }) {
  const [linkCopied, setLinkCopied] = useState(false);
  const waText = encodeURIComponent(`Agende seu horário online: ${link}`);

  function handleCopy() {
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div
        className="absolute inset-0 bg-black/50"
        style={{ backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div className="relative z-10 bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <p className="font-bold text-gray-900 text-base">Compartilhar link</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-3">
          <div className="flex justify-center pb-1">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(link)}`}
              alt="QR Code"
              className="w-40 h-40 rounded-2xl border border-gray-100"
              loading="lazy"
            />
          </div>

          <div className="bg-gray-50 rounded-xl px-3 py-2 text-[11px] text-gray-400 truncate font-mono select-all">
            {link}
          </div>

          <a
            href={`https://wa.me/?text=${waText}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2.5 w-full rounded-2xl font-bold text-white text-sm transition-opacity hover:opacity-90 active:opacity-80"
            style={{ height: 48, background: "linear-gradient(135deg,#25D366 0%,#128C7E 100%)" }}
          >
            <WhatsAppSvg className="w-5 h-5" />
            Compartilhar no WhatsApp
          </a>

          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 w-full h-11 rounded-2xl font-semibold text-sm border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors text-gray-700"
          >
            {linkCopied
              ? <><Check className="w-4 h-4 text-emerald-600" /> Copiado!</>
              : <><Copy className="w-4 h-4 text-gray-500" /> Copiar link</>}
          </button>
        </div>
        <div style={{ height: "max(0px, env(safe-area-inset-bottom, 0px))" }} />
      </div>
    </div>,
    document.body,
  );
}

interface RecentAppointment {
  id: string;
  clientName: string;
  clientPhone: string;
  scheduledAt: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  createdAt: string;
  serviceName: string | null;
}

interface DashboardData {
  tenant: {
    id: string;
    name: string;
    slug: string;
    phone: string | null;
    trialEndsAt: string | null;
    plan: string;
  };
  appointmentsCount: number;
  servicesCount: number;
  recentAppointments: RecentAppointment[];
  trialEndsAt: string | null;
}

interface SurveyStats {
  averageRating: number | null;
  totalResponded: number;
  totalSent: number;
  totalPending: number;
  satisfiedCount: number;
  satisfiedPercent: number;
  recentReviews: { clientName: string; rating: number; comment: string | null; respondedAt: string }[];
}

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sz = size === "md" ? "w-4 h-4" : "w-3 h-3";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${sz} ${i <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}`} />
      ))}
    </div>
  );
}

const APPT_STATUS = {
  pending:   { label: "Pendente",   dot: "#f59e0b" },
  confirmed: { label: "Confirmado", dot: "#10b981" },
  cancelled: { label: "Cancelado",  dot: "#ef4444" },
  completed: { label: "Concluído",  dot: "#9ca3af" },
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear();

  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Hoje às ${time}`;
  if (isTomorrow) return `Amanhã às ${time}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + ` às ${time}`;
}

function trialDaysLeft(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function todayLabel(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export default function BusinessDashboardPage() {
  const [, navigate] = useLocation();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [surveyStats, setSurveyStats] = useState<SurveyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const userRaw = localStorage.getItem("business_user");
  const user: { name: string } | null = userRaw ? (JSON.parse(userRaw) as { name: string }) : null;

  useEffect(() => {
    const token = localStorage.getItem("business_token");
    if (!token) { navigate("/signup"); return; }

    Promise.all([
      fetch("/api/business/dashboard", { headers: getAuthHeaders() }).then((r) => r.json()),
      fetch("/api/business/surveys/stats", { headers: getAuthHeaders() }).then((r) => r.json()).catch(() => null),
    ])
      .then(([dash, stats]) => {
        if ((dash as { error?: string }).error) { navigate("/business/login"); return; }
        const d = dash as DashboardData;
        setDashboard(d);
        localStorage.setItem("business_tenant", JSON.stringify(d.tenant));
        if (stats && !(stats as { error?: string }).error) {
          setSurveyStats(stats as SurveyStats);
        }
      })
      .catch(() => navigate("/business/login"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-violet-600 animate-spin" />
      </div>
    );
  }

  if (!dashboard) return null;

  const { tenant } = dashboard;
  const firstName = user?.name?.split(" ")[0] ?? tenant.name.split(" ")[0];
  const days = trialDaysLeft(tenant.trialEndsAt);
  const bookingLink = `${window.location.origin}/${tenant.slug}`;
  const isTrialing = !!tenant.trialEndsAt && days >= 0;
  const isPaidPlan = tenant.plan === "pro" || tenant.plan === "premium";

  function copyLink() {
    navigator.clipboard.writeText(bookingLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function openShareModal() {
    setShowShareModal(true);
  }

  const pendingCount = dashboard.recentAppointments.filter((a) => a.status === "pending").length;

  return (
    <>
    <BusinessLayout title="Painel">
      <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto w-full space-y-4">

        {/* ── Welcome row ── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
              Olá, {firstName}!
            </h1>
            <p className="text-gray-400 text-xs mt-0.5 capitalize">{todayLabel()}</p>
          </div>

          {/* Trial / plan badge */}
          {!isPaidPlan && isTrialing && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "flex-end",
              gap: 3, flexShrink: 0,
            }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 12, fontWeight: 700,
                padding: "7px 14px", borderRadius: 12,
                whiteSpace: "nowrap",
                background: days <= 2 ? "#fef2f2" : days <= 4 ? "#fffbeb" : "#f5f3ff",
                border: `1.5px solid ${days <= 2 ? "#fca5a5" : days <= 4 ? "#fcd34d" : "#c4b5fd"}`,
                color: days <= 2 ? "#b91c1c" : days <= 4 ? "#78350f" : "#4c1d95",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                  background: days <= 2 ? "#ef4444" : days <= 4 ? "#f59e0b" : "#7c3aed",
                  boxShadow: `0 0 0 2px ${days <= 2 ? "#fee2e2" : days <= 4 ? "#fef3c7" : "#ede9fe"}`,
                }} />
                {days === 0
                  ? "Teste encerrado"
                  : `Teste grátis • ${days} dia${days !== 1 ? "s" : ""} restante${days !== 1 ? "s" : ""}`}
              </span>
              <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500, paddingRight: 2 }}>
                Assine quando quiser
              </span>
            </div>
          )}
          {isPaidPlan && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 700,
              padding: "7px 14px", borderRadius: 12,
              whiteSpace: "nowrap", flexShrink: 0,
              background: "#ecfdf5", border: "1.5px solid #6ee7b7", color: "#065f46",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 0 2px #d1fae5", flexShrink: 0 }} />
              Conta ativa
            </span>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center mb-2.5">
              <Calendar className="w-4 h-4 text-violet-600" />
            </div>
            <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
              {dashboard.appointmentsCount}
            </div>
            <div className="text-gray-500 text-xs mt-0.5">
              {dashboard.appointmentsCount === 1 ? "agendamento" : "agendamentos"}
            </div>
            {pendingCount > 0 && (
              <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
              </div>
            )}
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center mb-2.5">
              <LayoutGrid className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
              {dashboard.servicesCount}
            </div>
            <div className="text-gray-500 text-xs mt-0.5">
              {dashboard.servicesCount === 1 ? "serviço ativo" : "serviços ativos"}
            </div>
            {dashboard.servicesCount === 0 && (
              <button
                onClick={() => navigate("/business/services")}
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full hover:bg-violet-100 transition-colors"
              >
                Criar <ChevronRight className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/business/clients")}
            className="flex items-center gap-2.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white rounded-2xl px-4 py-3 transition-colors text-left"
          >
            <CalendarPlus className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold leading-tight">Novo agendamento</span>
          </button>
          <button
            onClick={openShareModal}
            className="flex items-center gap-2.5 bg-white border border-gray-200 hover:border-violet-200 hover:bg-violet-50 active:bg-violet-100 text-gray-700 rounded-2xl px-4 py-3 transition-colors text-left shadow-sm"
          >
            <Share2 className="w-4 h-4 shrink-0 text-violet-600" />
            <span className="text-sm font-semibold leading-tight truncate">Compartilhar link</span>
          </button>
        </div>

        {/* ── Ratings widget ── */}
        {surveyStats && (surveyStats.totalResponded > 0 || surveyStats.totalSent > 0 || surveyStats.totalPending > 0) && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                </div>
                <h3 className="text-gray-900 font-semibold text-[15px]">Avaliações</h3>
              </div>
              <button
                onClick={() => navigate("/business/surveys")}
                className="text-xs text-violet-600 font-semibold hover:text-violet-800 transition-colors shrink-0 flex items-center gap-0.5"
              >
                Ver todas <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {surveyStats.totalResponded > 0 ? (
              <div className="px-5 py-4 space-y-4">
                {/* Average + stats row */}
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-extrabold text-amber-600 leading-none">
                      {surveyStats.averageRating?.toFixed(1)}
                    </span>
                    <StarDisplay rating={Math.round(surveyStats.averageRating ?? 0)} size="md" />
                  </div>
                  <div className="h-10 w-px bg-gray-100" />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold text-gray-800">{surveyStats.totalResponded} respostas</p>
                    <p className="text-xs text-emerald-600 font-semibold">
                      {surveyStats.satisfiedPercent}% satisfeitos
                    </p>
                  </div>
                  {surveyStats.totalSent > 0 && (
                    <>
                      <div className="h-10 w-px bg-gray-100 ml-auto" />
                      <div className="flex flex-col items-end gap-0.5">
                        <p className="text-sm font-bold text-blue-600">{surveyStats.totalSent}</p>
                        <p className="text-[10px] text-gray-400">aguardando</p>
                      </div>
                    </>
                  )}
                </div>
                {/* Recent reviews */}
                {surveyStats.recentReviews.length > 0 && (
                  <div className="space-y-2.5 pt-1 border-t border-gray-50">
                    {surveyStats.recentReviews.map((r, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div
                          style={{
                            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                            background: "linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: "1.5px solid #fcd34d",
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 800, color: "#b45309", lineHeight: 1 }}>
                            {r.clientName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-gray-800 truncate">
                              {r.clientName.split(" ")[0]}
                            </span>
                            <StarDisplay rating={r.rating} />
                          </div>
                          {r.comment && (
                            <p className="text-gray-400 text-[11px] truncate mt-0.5 italic">"{r.comment}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-5 py-4 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-700">
                    {surveyStats.totalPending > 0
                      ? `${surveyStats.totalPending} pesquisa${surveyStats.totalPending > 1 ? "s" : ""} aguardando envio`
                      : `${surveyStats.totalSent} pesquisa${surveyStats.totalSent > 1 ? "s" : ""} enviada${surveyStats.totalSent > 1 ? "s" : ""}`}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Aguardando resposta dos clientes
                  </p>
                </div>
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
              </div>
            )}
          </div>
        )}

        {/* ── Recent appointments ── */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <h3 className="text-gray-900 font-semibold text-[15px]">Agendamentos recentes</h3>
            <button
              onClick={() => navigate("/business/clients")}
              className="text-xs text-violet-600 font-semibold hover:text-violet-800 transition-colors shrink-0 flex items-center gap-0.5"
            >
              Ver todos <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {dashboard.recentAppointments.length === 0 ? (
            <div className="px-5 py-10 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-gray-300" />
              </div>
              <div>
                <p className="text-gray-700 text-sm font-semibold">Nenhum agendamento ainda</p>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed max-w-[200px]">
                  Compartilhe seu link para começar a receber clientes.
                </p>
              </div>
              <button
                onClick={openShareModal}
                className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-100 px-4 py-2 rounded-xl hover:bg-violet-100 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" /> Compartilhar link
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {dashboard.recentAppointments.map((appt) => {
                const badge = APPT_STATUS[appt.status] ?? APPT_STATUS.pending;
                return (
                  <div
                    key={appt.id}
                    className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate("/business/clients")}
                  >
                    <div
                      style={{
                        width: 40, height: 40, borderRadius: "50%",
                        background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
                        flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 1px 4px rgba(109,40,217,0.13)",
                        border: "1.5px solid #e9d5ff",
                      }}
                    >
                      <span style={{ color: "#6d28d9", fontSize: 15, fontWeight: 800, lineHeight: 1 }}>
                        {appt.clientName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 text-sm font-semibold truncate">{appt.clientName}</p>
                      <p className="text-gray-400 text-xs truncate flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 shrink-0" />
                        {formatDateTime(appt.scheduledAt)}
                        {appt.serviceName && (
                          <span className="text-gray-300 mx-0.5">·</span>
                        )}
                        {appt.serviceName && (
                          <span className="truncate">{appt.serviceName}</span>
                        )}
                      </p>
                    </div>
                    <div
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: badge.dot, flexShrink: 0,
                          display: "inline-block",
                        }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" }}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>


      </div>
    </BusinessLayout>
    {showShareModal && (
      <ShareModal link={bookingLink} onClose={() => setShowShareModal(false)} />
    )}
    </>
  );
}
