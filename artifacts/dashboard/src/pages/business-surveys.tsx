import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, Star, Clock, CheckCircle2, Send, ChevronLeft, MessageSquare } from "lucide-react";
import { BusinessLayout, getAuthHeaders } from "@/components/business-layout";

interface Survey {
  id: string;
  appointmentId: string;
  clientName: string;
  clientPhone: string;
  status: "pending_send" | "sent" | "responded";
  sentAt: string | null;
  rating: number | null;
  comment: string | null;
  respondedAt: string | null;
  createdAt: string;
}

interface SurveyStats {
  averageRating: number | null;
  totalResponded: number;
  totalSent: number;
  totalPending: number;
  satisfiedCount: number;
  satisfiedPercent: number;
}

function StarDisplay({ rating }: { rating: number }) {
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

const STATUS_CONFIG = {
  pending_send: {
    label: "Aguardando envio",
    dot: "#f59e0b",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-100",
    icon: Clock,
  },
  sent: {
    label: "Enviado",
    dot: "#3b82f6",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-100",
    icon: Send,
  },
  responded: {
    label: "Respondido",
    dot: "#10b981",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-100",
    icon: CheckCircle2,
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function BusinessSurveysPage() {
  const [, navigate] = useLocation();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "pending_send" | "sent" | "responded">("all");

  useEffect(() => {
    const token = localStorage.getItem("business_token");
    if (!token) { navigate("/business/login"); return; }

    Promise.all([
      fetch("/api/business/surveys", { headers: getAuthHeaders() }).then((r) => r.json()),
      fetch("/api/business/surveys/stats", { headers: getAuthHeaders() }).then((r) => r.json()).catch(() => null),
    ])
      .then(([list, st]) => {
        if ((list as { error?: string }).error) { navigate("/business/login"); return; }
        setSurveys(list as Survey[]);
        if (st && !(st as { error?: string }).error) setStats(st as SurveyStats);
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

  const filtered = activeTab === "all" ? surveys : surveys.filter((s) => s.status === activeTab);

  const tabs: { key: typeof activeTab; label: string; count: number }[] = [
    { key: "all",          label: "Todas",    count: surveys.length },
    { key: "pending_send", label: "Pendentes", count: surveys.filter((s) => s.status === "pending_send").length },
    { key: "sent",         label: "Enviadas",  count: surveys.filter((s) => s.status === "sent").length },
    { key: "responded",    label: "Respondidas", count: surveys.filter((s) => s.status === "responded").length },
  ];

  return (
    <BusinessLayout title="Avaliações">
      <div className="px-4 py-6 max-w-2xl mx-auto w-full space-y-5">

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/business/dashboard")}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Avaliações</h1>
            <p className="text-gray-400 text-sm">Pesquisas de satisfação dos clientes</p>
          </div>
        </div>

        {stats && (stats.totalResponded > 0 || stats.totalSent > 0 || stats.totalPending > 0) && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-extrabold text-amber-500">
                {stats.averageRating?.toFixed(1) ?? "—"}
              </p>
              <div className="flex justify-center mt-1 mb-1">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${i <= Math.round(stats.averageRating ?? 0) ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-gray-400 text-[11px]">Nota média</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-extrabold text-emerald-500">{stats.totalResponded}</p>
              <p className="text-gray-400 text-[11px] mt-1">Respondidas</p>
              {stats.totalResponded > 0 && (
                <p className="text-emerald-600 text-[10px] font-semibold mt-0.5">{stats.satisfiedPercent}% satisfeitos</p>
              )}
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-extrabold text-blue-500">{stats.totalSent}</p>
              <p className="text-gray-400 text-[11px] mt-1">Enviadas</p>
              {stats.totalPending > 0 && (
                <p className="text-amber-500 text-[10px] font-semibold mt-0.5">{stats.totalPending} pendentes</p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                activeTab === tab.key
                  ? "bg-violet-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-14 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-gray-300" />
            </div>
            <div>
              <p className="text-gray-700 text-sm font-semibold">Nenhuma pesquisa ainda</p>
              <p className="text-gray-400 text-xs mt-1 leading-relaxed max-w-[220px]">
                As pesquisas de satisfação são enviadas automaticamente após os atendimentos.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
            {filtered.map((survey) => {
              const cfg = STATUS_CONFIG[survey.status];
              const StatusIcon = cfg.icon;
              return (
                <div key={survey.id} className="px-4 py-3.5 flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "linear-gradient(135deg,#ede9fe 0%,#ddd6fe 100%)", border: "1.5px solid #e9d5ff" }}
                  >
                    <span style={{ color: "#6d28d9", fontSize: 13, fontWeight: 800, lineHeight: 1 }}>
                      {survey.clientName.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-gray-900 text-sm font-semibold truncate">{survey.clientName}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border} border flex items-center gap-1`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>

                    {survey.status === "responded" && survey.rating !== null && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <StarDisplay rating={survey.rating} />
                        {survey.respondedAt && (
                          <span className="text-gray-400 text-[11px]">{formatDate(survey.respondedAt)}</span>
                        )}
                      </div>
                    )}

                    {survey.comment && (
                      <p className="text-gray-400 text-[11px] mt-1 italic line-clamp-2">"{survey.comment}"</p>
                    )}

                    {survey.status !== "responded" && (
                      <p className="text-gray-400 text-[11px] mt-1">
                        {survey.sentAt ? `Enviado em ${formatDate(survey.sentAt)}` : `Criado em ${formatDate(survey.createdAt)}`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BusinessLayout>
  );
}
