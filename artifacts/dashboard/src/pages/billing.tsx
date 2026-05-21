import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Check,
  Loader2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Receipt,
  MessageCircle,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import {
  useGetBillingStatus,
  useGetPaymentHistory,
  useCreateMpSubscription,
  useCancelBillingSubscription,
} from "@workspace/api-client-react";
import { BusinessLayout } from "@/components/business-layout";

// ── Plans ───────────────────────────────────────────────────────────────────

type PlanId = "pro" | "premium";

const PLANS: {
  id: PlanId;
  name: string;
  tagline: string;
  monthly: number;
  popular?: boolean;
  features: string[];
}[] = [
  {
    id: "pro",
    name: "Pro",
    tagline: "Para negócios em crescimento",
    monthly: 97,
    popular: true,
    features: [
      "Clientes ilimitados",
      "WhatsApp automático",
      "Painel completo",
      "Automações de resposta",
      "Suporte prioritário",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Para equipes e múltiplos locais",
    monthly: 197,
    features: [
      "Tudo do Pro",
      "Múltiplos usuários",
      "Analytics avançado",
      "Automações ilimitadas",
      "Acesso à API",
      "Suporte VIP por WhatsApp",
    ],
  },
];

const PLAN_LABELS: Record<string, string> = {
  free: "Teste Grátis",
  starter: "Starter",
  pro: "Pro",
  premium: "Premium",
};

const STATUS_LABELS: Record<string, string> = {
  trialing: "Em teste",
  active: "Ativo",
  past_due: "Pagamento atrasado",
  cancelled: "Cancelado",
  expired: "Expirado",
  paused: "Pausado",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  approved: "Aprovado",
  pending: "Pendente",
  in_process: "Processando",
  rejected: "Recusado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  charged_back: "Contestado",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatBRL(val: string | number | null | undefined): string {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function PaymentIcon({ status }: { status: string }) {
  if (status === "approved") return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (status === "rejected" || status === "cancelled")
    return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  return <Clock className="h-4 w-4 text-amber-500 shrink-0" />;
}

function statusBadgeCls(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "trialing") return "bg-blue-50 text-blue-700 border-blue-100";
  if (status === "past_due") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-gray-50 text-gray-500 border-gray-100";
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [, navigate] = useLocation();
  const [selectedId, setSelectedId] = useState<PlanId | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [upgrading, setUpgrading] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("business_token")) navigate("/signup");
    const p = new URLSearchParams(window.location.search).get("plan");
    if (p === "pro" || p === "premium") setSelectedId(p);
  }, []);

  const { data: billingStatus, isLoading: statusLoading, refetch } = useGetBillingStatus();
  const { data: paymentHistory, isLoading: historyLoading } = useGetPaymentHistory();
  const createSubscription = useCreateMpSubscription();
  const cancelSubscription = useCancelBillingSubscription();

  const sub = billingStatus?.subscription;
  const isTrialing = billingStatus?.isTrialing ?? false;
  const isActive = billingStatus?.isActive ?? false;
  const isPastDue = billingStatus?.isPastDue ?? false;
  const trialDaysLeft = billingStatus?.trialDaysLeft ?? null;
  const currentPlan = sub?.plan ?? "free";
  const hasPaidPlan =
    currentPlan === "starter" || currentPlan === "pro" || currentPlan === "premium";
  // Show upgrade for free/starter; hide when already on pro/premium (unless cancelled/expired)
  const showUpgrade =
    (currentPlan !== "pro" && currentPlan !== "premium") ||
    sub?.status === "cancelled" ||
    sub?.status === "expired";

  const chosen = PLANS.find((p) => p.id === selectedId);
  const chosenPrice = chosen
    ? cycle === "yearly"
      ? Math.round((chosen.monthly * 10) / 12)
      : chosen.monthly
    : null;

  async function handleSubscribe() {
    if (!selectedId) return;
    setUpgrading(true);
    setSubscribeError(null);
    try {
      const result = await createSubscription.mutateAsync({
        data: { plan: selectedId, billingCycle: cycle },
      });
      const initPoint = result.initPoint;
      if (!initPoint) {
        setSubscribeError("Não foi possível iniciar o pagamento. Tente novamente.");
        setUpgrading(false);
        return;
      }
      if (initPoint.startsWith("/billing?") && initPoint.includes("pending_payment")) {
        setUpgrading(false);
        setPendingPayment(true);
        return;
      }
      window.location.href = initPoint;
    } catch {
      setSubscribeError(
        "Pagamento temporariamente indisponível. Fale com o suporte para ativar seu plano.",
      );
      setUpgrading(false);
    }
  }

  async function handleCancel() {
    try {
      await cancelSubscription.mutateAsync();
      setCancelConfirm(false);
      refetch();
    } catch {
      setCancelConfirm(false);
    }
  }

  return (
    <BusinessLayout title="Planos e Assinatura">
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          margin: "0 auto",
          padding: "16px 16px 48px",
          boxSizing: "border-box",
          overflowX: "hidden",
        }}
      >
        {/* ── Page header ── */}
        <div style={{ paddingTop: 20, paddingBottom: 4 }}>
          <h1 style={{ color: "#111827", fontWeight: 800, fontSize: 22, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            Planos e Assinatura
          </h1>
          <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>
            Gerencie seu plano e pagamentos
          </p>
        </div>

        {/* ── Banners ── */}
        {isTrialing && trialDaysLeft !== null && (
          <div
            style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "14px 16px",
              borderRadius: 16,
              marginBottom: 16,
              background: (trialDaysLeft ?? 0) <= 2 ? "#fef2f2" : "#f5f3ff",
              border: `1px solid ${(trialDaysLeft ?? 0) <= 2 ? "#fecaca" : "#ede9fe"}`,
              color: (trialDaysLeft ?? 0) <= 2 ? "#991b1b" : "#5b21b6",
              boxSizing: "border-box",
            }}
          >
            <Clock style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>
              {(trialDaysLeft ?? 0) <= 0
                ? "Seu período de teste encerrou. Assine para continuar."
                : `${trialDaysLeft} dia${trialDaysLeft !== 1 ? "s" : ""} restante${trialDaysLeft !== 1 ? "s" : ""} no teste grátis.`}
            </p>
          </div>
        )}

        {isPastDue && (
          <div
            style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "14px 16px", borderRadius: 16, marginBottom: 16,
              background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e",
              boxSizing: "border-box",
            }}
          >
            <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
              Pagamento em atraso. Atualize seu método de pagamento.
            </p>
          </div>
        )}

        {/* ── Current plan ── */}
        {!statusLoading && sub && (
          <div
            style={{
              background: "#ffffff", border: "1px solid #e5e7eb",
              borderRadius: 20, overflow: "hidden", marginBottom: 16,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                padding: "12px 20px", borderBottom: "1px solid #f3f4f6",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CreditCard style={{ width: 14, height: 14, color: "#9ca3af" }} />
                <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                  Plano atual
                </p>
              </div>
              {isTrialing && trialDaysLeft !== null && (
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, color: "#7c3aed",
                    background: "#f5f3ff", border: "1px solid #ede9fe",
                    padding: "3px 10px", borderRadius: 99,
                  }}
                >
                  {trialDaysLeft > 0
                    ? `${trialDaysLeft}d restantes`
                    : "Teste encerrado"}
                </span>
              )}
            </div>
            <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <p style={{ color: "#111827", fontWeight: 700, fontSize: 18, margin: 0 }}>
                  {PLAN_LABELS[currentPlan] ?? currentPlan}
                </p>
                {sub.amount && (
                  <p style={{ color: "#9ca3af", fontSize: 13, margin: "2px 0 0" }}>
                    {formatBRL(sub.amount)}/{sub.billingCycle === "monthly" ? "mês" : "ano"}
                  </p>
                )}
              </div>
              <span
                style={{
                  fontSize: 12, fontWeight: 600, padding: "4px 12px",
                  borderRadius: 99, border: "1px solid",
                }}
                className={statusBadgeCls(sub.status)}
              >
                {STATUS_LABELS[sub.status] ?? sub.status}
              </span>
            </div>

            {/* Cancel button */}
            {(isActive || isTrialing) && hasPaidPlan && sub.status !== "cancelled" && (
              <div style={{ padding: "0 20px 16px" }}>
                {!cancelConfirm ? (
                  <button
                    onClick={() => setCancelConfirm(true)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#f87171", fontSize: 13, fontWeight: 600, padding: 0,
                    }}
                  >
                    Cancelar assinatura
                  </button>
                ) : (
                  <div
                    style={{
                      background: "#fef2f2", border: "1px solid #fecaca",
                      borderRadius: 12, padding: "12px 14px",
                    }}
                  >
                    <p style={{ color: "#991b1b", fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>
                      Tem certeza? Você perderá acesso aos recursos premium.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setCancelConfirm(false)}
                        style={{
                          flex: 1, height: 36, borderRadius: 10,
                          border: "1px solid #e5e7eb", background: "#fff",
                          color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        Voltar
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={cancelSubscription.isPending}
                        style={{
                          flex: 1, height: 36, borderRadius: 10,
                          background: cancelSubscription.isPending ? "#fca5a5" : "#ef4444",
                          border: "none", color: "#fff", fontSize: 13, fontWeight: 700,
                          cursor: cancelSubscription.isPending ? "not-allowed" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}
                      >
                        {cancelSubscription.isPending ? (
                          <><Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />Cancelando…</>
                        ) : "Confirmar cancelamento"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Plan selector ── */}
        {showUpgrade && (
          <>
            {/* Header */}
            <div style={{ marginBottom: 16, marginTop: hasPaidPlan ? 8 : 0 }}>
              <h2 style={{ color: "#111827", fontWeight: 800, fontSize: 20, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                {hasPaidPlan ? "Fazer upgrade" : "Escolha seu plano"}
              </h2>
              <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>
                Cancele quando quiser, sem multa.
              </p>
            </div>

            {/* Billing cycle toggle */}
            <div
              style={{
                display: "inline-flex", background: "#f3f4f6",
                borderRadius: 12, padding: 4, marginBottom: 16,
              }}
            >
              {(["monthly", "yearly"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  style={{
                    padding: "7px 16px", borderRadius: 9,
                    border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
                    transition: "all 0.15s",
                    background: cycle === c ? "#ffffff" : "transparent",
                    color: cycle === c ? "#111827" : "#9ca3af",
                    boxShadow: cycle === c ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {c === "monthly" ? "Mensal" : (
                    <>
                      Anual
                      <span
                        style={{
                          fontSize: 10, fontWeight: 700, color: "#059669",
                          background: "#d1fae5", padding: "1px 6px",
                          borderRadius: 6,
                        }}
                      >
                        -17%
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>

            {/* Plan cards — always single column (Safari-safe) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginBottom: 20,
                width: "100%",
              }}
            >
              {PLANS.map((plan) => {
                const price = cycle === "yearly"
                  ? Math.round((plan.monthly * 10) / 12)
                  : plan.monthly;
                const isSelected = selectedId === plan.id;

                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedId(plan.id)}
                    style={{
                      textAlign: "left",
                      borderRadius: 20,
                      border: isSelected ? "2px solid #7c3aed" : "2px solid #e5e7eb",
                      padding: 20,
                      background: isSelected ? "#faf8ff" : "#ffffff",
                      boxShadow: isSelected ? "0 4px 20px rgba(124,58,237,0.12)" : "0 1px 4px rgba(0,0,0,0.04)",
                      cursor: "pointer",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                      WebkitTapHighlightColor: "transparent",
                      display: "block",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
                        {/* Radio */}
                        <div
                          style={{
                            width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                            border: isSelected ? "none" : "2px solid #d1d5db",
                            background: isSelected ? "#7c3aed" : "#fff",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "background 0.15s, border 0.15s",
                          }}
                        >
                          {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ color: "#111827", fontWeight: 800, fontSize: 18, lineHeight: 1.1 }}>
                              {plan.name}
                            </span>
                            {plan.popular && (
                              <span
                                style={{
                                  fontSize: 10, fontWeight: 700, color: "#ffffff",
                                  background: "#7c3aed", padding: "2px 8px", borderRadius: 99,
                                }}
                              >
                                Mais popular
                              </span>
                            )}
                          </div>
                          <p style={{ color: "#9ca3af", fontSize: 12, margin: "3px 0 0", lineHeight: 1.3 }}>
                            {plan.tagline}
                          </p>
                        </div>
                      </div>
                      {/* Price */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 1, justifyContent: "flex-end" }}>
                          <span style={{ color: "#9ca3af", fontSize: 13, fontWeight: 500 }}>R$</span>
                          <span style={{ color: "#111827", fontWeight: 800, fontSize: 28, lineHeight: 1 }}>{price}</span>
                        </div>
                        <p style={{ color: "#9ca3af", fontSize: 11, margin: "2px 0 0" }}>/mês</p>
                        {cycle === "yearly" && (
                          <p style={{ color: "#059669", fontSize: 10, fontWeight: 700, margin: "2px 0 0" }}>
                            R${plan.monthly * 10}/ano
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: "1px solid #f3f4f6", margin: "12px 0" }} />

                    {/* Features */}
                    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      {plan.features.map((f) => (
                        <li key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 18, height: 18, borderRadius: "50%",
                              background: "#ecfdf5", flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            <Check style={{ width: 10, height: 10, color: "#059669" }} />
                          </div>
                          <span style={{ color: "#374151", fontSize: 13, lineHeight: 1.3 }}>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {/* ── CTA area ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 8 }}>

              {/* Pending payment — MP unavailable fallback */}
              {pendingPayment && (
                <div
                  style={{
                    background: "#ecfdf5", border: "1px solid #a7f3d0",
                    borderRadius: 20, padding: 20, textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: 48, height: 48, borderRadius: "50%",
                      background: "#d1fae5", margin: "0 auto 12px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <CheckCircle2 style={{ width: 24, height: 24, color: "#059669" }} />
                  </div>
                  <p style={{ color: "#064e3b", fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>
                    Solicitação recebida!
                  </p>
                  <p style={{ color: "#065f46", fontSize: 14, margin: "0 0 16px", lineHeight: 1.5 }}>
                    Nossa equipe vai entrar em contato em breve para finalizar seu pagamento via PIX ou cartão.
                  </p>
                  <a
                    href="https://wa.me/5592992208060?text=Ol%C3%A1%2C%20quero%20finalizar%20minha%20assinatura%20do%20ReservaAI"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      width: "100%", height: 52, borderRadius: 16, boxSizing: "border-box",
                      background: "#059669", color: "#fff",
                      fontSize: 15, fontWeight: 700, textDecoration: "none",
                    }}
                  >
                    <MessageCircle style={{ width: 18, height: 18, flexShrink: 0 }} />
                    Falar com suporte pelo WhatsApp
                  </a>
                </div>
              )}

              {/* Error with retry */}
              {subscribeError && !pendingPayment && (
                <div
                  style={{
                    background: "#fffbeb", border: "1px solid #fde68a",
                    borderRadius: 16, padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                    <AlertTriangle style={{ width: 16, height: 16, color: "#d97706", flexShrink: 0, marginTop: 1 }} />
                    <p style={{ color: "#92400e", fontSize: 14, fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
                      {subscribeError}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSubscribeError(null);
                      void handleSubscribe();
                    }}
                    disabled={upgrading}
                    style={{
                      width: "100%", height: 40, borderRadius: 12,
                      background: "#fef3c7", border: "1px solid #fde68a",
                      color: "#92400e", fontSize: 13, fontWeight: 700,
                      cursor: "pointer", display: "flex", alignItems: "center",
                      justifyContent: "center", gap: 6, boxSizing: "border-box",
                    }}
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {/* Main CTA button */}
              {!pendingPayment && (
                <>
                  <button
                    onClick={() => void handleSubscribe()}
                    disabled={!selectedId || upgrading}
                    style={{
                      width: "100%", height: 56, borderRadius: 18,
                      border: "none", cursor: selectedId && !upgrading ? "pointer" : "not-allowed",
                      background: selectedId && !upgrading
                        ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                        : "#e5e7eb",
                      color: selectedId && !upgrading ? "#ffffff" : "#9ca3af",
                      fontSize: 16, fontWeight: 700,
                      boxShadow: selectedId && !upgrading ? "0 6px 20px rgba(124,58,237,0.35)" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "all 0.15s",
                      boxSizing: "border-box",
                    }}
                  >
                    {upgrading ? (
                      <>
                        <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} />
                        Abrindo pagamento…
                      </>
                    ) : selectedId && chosenPrice ? (
                      <>Assinar {chosen?.name} · R${chosenPrice}/mês</>
                    ) : (
                      "Selecione um plano acima"
                    )}
                  </button>
                  <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, margin: 0 }}>
                    Pagamento seguro via Mercado Pago · PIX ou cartão
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {/* ── Payment history ── */}
        <div
          style={{
            background: "#ffffff", border: "1px solid #e5e7eb",
            borderRadius: 20, overflow: "hidden", marginTop: 8,
          }}
        >
          <div
            style={{
              padding: "12px 20px", borderBottom: "1px solid #f3f4f6",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <Receipt style={{ width: 14, height: 14, color: "#d1d5db" }} />
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
              Histórico de pagamentos
            </p>
          </div>

          {historyLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "24px 20px" }}>
              <Loader2 style={{ width: 16, height: 16, color: "#9ca3af", animation: "spin 1s linear infinite" }} />
              <span style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</span>
            </div>
          ) : !paymentHistory || paymentHistory.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center" }}>
              <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>Nenhum pagamento registrado ainda.</p>
            </div>
          ) : (
            <div>
              {paymentHistory.map((evt, i) => (
                <div
                  key={evt.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 20px",
                    borderTop: i === 0 ? "none" : "1px solid #f3f4f6",
                  }}
                >
                  <PaymentIcon status={evt.status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "#111827", fontSize: 14, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {evt.description ??
                        `Assinatura · ${PLAN_LABELS[String(evt.subscriptionId ?? "")] ?? "Plano"}`}
                    </p>
                    <p style={{ color: "#9ca3af", fontSize: 12, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {formatDate(evt.createdAt)} · {PAYMENT_STATUS_LABELS[evt.status] ?? evt.status}
                      {evt.paymentMethod && ` · ${
                        evt.paymentMethod === "credit_card" ? "Cartão"
                        : evt.paymentMethod === "pix" ? "PIX"
                        : evt.paymentMethod
                      }`}
                    </p>
                  </div>
                  <p
                    style={{
                      fontSize: 14, fontWeight: 700, flexShrink: 0,
                      color: evt.status === "approved" ? "#059669" : "#9ca3af",
                    }}
                  >
                    {formatBRL(evt.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Safe-area spacer for iOS home indicator */}
        <div style={{ height: "env(safe-area-inset-bottom, 16px)", minHeight: 16 }} />
      </div>
    </BusinessLayout>
  );
}
