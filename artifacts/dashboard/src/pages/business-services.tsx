import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  LayoutGrid,
  Clock,
  DollarSign,
  Copy,
  Check,
  Link,
} from "lucide-react";
import { BusinessLayout, getAuthHeaders } from "@/components/business-layout";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: string;
  durationMinutes: number;
  isActive: boolean;
  createdAt: string;
}

const DURATIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hora" },
  { value: 90, label: "1h 30min" },
  { value: 120, label: "2 horas" },
  { value: 180, label: "3 horas" },
];

function formatPrice(price: string) {
  const n = parseFloat(price);
  if (isNaN(n) || n === 0) return "Grátis";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

function durationLabel(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** Formats a raw-digits-only string (cents) as "R$ X.XXX,XX". Empty → "". */
function displayCurrency(digits: string): string {
  const num = parseInt(digits || "0", 10);
  if (!digits || num === 0) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num / 100);
}

function getPublicLink(slug: string): string {
  const base = window.location.origin;
  return `${base}/api/share/${slug}`;
}

interface ServiceForm {
  name: string;
  description: string;
  /** Digits-only cents string, e.g. "580" = R$ 5,80. Empty = free. */
  priceCents: string;
  durationMinutes: number;
}

const emptyForm: ServiceForm = {
  name: "",
  description: "",
  priceCents: "",
  durationMinutes: 60,
};

export default function BusinessServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const tenantRaw = localStorage.getItem("business_tenant");
  const tenant: { slug?: string } = tenantRaw
    ? (JSON.parse(tenantRaw) as { slug?: string })
    : {};
  const slug = tenant.slug ?? "";
  const publicLink = slug ? getPublicLink(slug) : "";

  useEffect(() => {
    loadServices();
  }, []);

  function loadServices() {
    setLoading(true);
    fetch("/api/business/services", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) =>
        setServices(Array.isArray(data) ? (data as Service[]) : []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function copyLink() {
    if (!publicLink) return;
    navigator.clipboard
      .writeText(publicLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        const el = document.createElement("textarea");
        el.value = publicLink;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    const priceNum = parseFloat(s.price);
    setForm({
      name: s.name,
      description: s.description ?? "",
      // Convert decimal price → cents digits string
      priceCents:
        isNaN(priceNum) || priceNum === 0
          ? ""
          : String(Math.round(priceNum * 100)),
      durationMinutes: s.durationMinutes,
    });
    setError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setError("");
  }

  /** Price input: only keep digits, max 8 digits (R$ 999.999,99) */
  function handlePriceInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    setForm((f) => ({ ...f, priceCents: digits }));
  }

  async function saveService() {
    setError("");
    if (!form.name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    setSaving(true);
    const priceValue = form.priceCents
      ? parseInt(form.priceCents, 10) / 100
      : 0;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: priceValue,
      durationMinutes: form.durationMinutes,
    };
    try {
      const url = editing
        ? `/api/business/services/${editing.id}`
        : "/api/business/services";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setError(err.error ?? "Erro ao salvar serviço");
        return;
      }
      const saved = (await res.json()) as Service;
      if (editing) {
        setServices((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      } else {
        setServices((prev) => [...prev, saved]);
      }
      closeModal();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteService(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/business/services/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setServices((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  }

  const inputCls =
    "w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-colors bg-white";
  const labelCls = "text-gray-700 text-[12px] font-semibold block mb-1.5 tracking-wide";

  return (
    <BusinessLayout title="Serviços">
      <div
        className="px-4 py-6 w-full"
        style={{ maxWidth: "672px", margin: "0 auto", boxSizing: "border-box" }}
      >
        <div className="space-y-5 w-full">
          {/* ── Header ── */}
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900">Serviços</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {loading
                  ? "Carregando…"
                  : services.length === 0
                    ? "Cadastre seus primeiros serviços"
                    : `${services.length} serviço${services.length !== 1 ? "s" : ""} cadastrado${services.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3.5 py-2 rounded-xl transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>

          {/* ── Service list / empty state ── */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
          ) : services.length === 0 ? (
            <div
              className="bg-white border border-gray-200 rounded-2xl shadow-sm py-12 px-5 text-center w-full"
              style={{ boxSizing: "border-box" }}
            >
              <div className="w-12 h-12 bg-violet-50 border border-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <LayoutGrid className="w-5 h-5 text-violet-400" />
              </div>
              <p className="text-gray-700 text-sm font-semibold">
                Nenhum serviço cadastrado
              </p>
              <p className="text-gray-400 text-xs mt-1.5 leading-relaxed max-w-[260px] mx-auto">
                Cadastre seus primeiros serviços. Depois compartilhe seu link
                para seus clientes agendarem.
              </p>
              <button
                onClick={openAdd}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar primeiro serviço
              </button>
            </div>
          ) : (
            <div className="space-y-3 w-full">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 w-full"
                  style={{ boxSizing: "border-box" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-bold text-[15px] leading-tight truncate">
                        {service.name}
                      </p>
                      {service.description && (
                        <p className="text-gray-400 text-xs mt-1 leading-relaxed line-clamp-2">
                          {service.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                        <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
                          <DollarSign className="w-3 h-3 shrink-0" />
                          <span className="text-xs font-bold">
                            {formatPrice(service.price)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span className="text-xs font-semibold">
                            {durationLabel(service.durationMinutes)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(service)}
                        className="p-2 rounded-xl text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteService(service.id)}
                        disabled={deleting === service.id}
                        className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {deleting === service.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Compartilhe seu link — SEMPRE VISÍVEL ── */}
          <div
            className="bg-violet-50 border border-violet-200 rounded-2xl p-4 w-full"
            style={{ boxSizing: "border-box" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Link className="w-4 h-4 text-violet-600 shrink-0" />
              <p className="text-violet-900 text-sm font-bold">
                Compartilhe seu link
              </p>
            </div>
            <p className="text-violet-700 text-xs leading-relaxed mb-3">
              Compartilhe este link com seus clientes para eles escolherem um
              serviço e enviarem uma solicitação de agendamento.
            </p>

            {publicLink ? (
              <>
                <div
                  className="bg-white border border-violet-100 rounded-xl px-3 py-2 mb-3 w-full"
                  style={{ boxSizing: "border-box" }}
                >
                  <p
                    className="text-violet-800 text-xs font-mono truncate"
                    style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
                  >
                    {publicLink}
                  </p>
                </div>
                <button
                  onClick={copyLink}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    copied
                      ? "bg-emerald-500 text-white"
                      : "bg-violet-600 hover:bg-violet-700 text-white"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Link copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar link público
                    </>
                  )}
                </button>
              </>
            ) : (
              <p className="text-violet-500 text-xs">
                Seu link estará disponível após configurar o perfil.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Add / Edit modal — rendered via portal so position:fixed works on iOS Safari ── */}
      {showModal && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            touchAction: "none",
          }}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {/* Thin backdrop strip visible at top — tap to dismiss */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              animation: "fadeInBg 0.2s ease",
            }}
            onClick={closeModal}
          />

          {/*
            Sheet height = 100dvh minus a 52px gap at the top.
            dvh = "dynamic viewport height" on iOS — it SHRINKS automatically
            when the soft keyboard opens, so the footer buttons always stay
            visible above the keyboard without any JS listener needed.
          */}
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
              /* Safe-area for home indicator — applied to footer instead */
            }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#d1d5db" }} />
            </div>

            {/* Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 20px 12px",
              borderBottom: "1px solid #f3f4f6",
              flexShrink: 0,
              boxSizing: "border-box",
            }}>
              <h2 style={{ color: "#111827", fontWeight: 700, fontSize: 17, margin: 0 }}>
                {editing ? "Editar serviço" : "Novo serviço"}
              </h2>
              <button
                onClick={closeModal}
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

            {/* Scrollable body — flex-1 so it fills remaining space */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                overflowX: "hidden",
                WebkitOverflowScrolling: "touch",
                padding: "20px",
                boxSizing: "border-box",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {/* Nome */}
              <div>
                <label className={labelCls}>
                  Nome do serviço <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Nome do serviço"
                  className={inputCls}
                  autoComplete="off"
                />
              </div>

              {/* Preço + Duração — side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className={labelCls}>Preço</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={displayCurrency(form.priceCents)}
                    onChange={handlePriceInput}
                    placeholder="R$ 0,00"
                    className={inputCls}
                    autoComplete="off"
                  />
                  <p style={{ color: "#9ca3af", fontSize: 10, marginTop: 4 }}>Vazio = grátis</p>
                </div>
                <div>
                  <label className={labelCls}>Duração</label>
                  <select
                    value={form.durationMinutes}
                    onChange={(e) => setForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value) }))}
                    className={inputCls}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className={labelCls}>
                  Descrição <span style={{ color: "#9ca3af", fontWeight: 400 }}>(opcional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Descreva o serviço para seus clientes..."
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: 12, padding: "10px 16px" }}>
                  <p style={{ color: "#dc2626", fontSize: 13, margin: 0, fontWeight: 500 }}>{error}</p>
                </div>
              )}
            </div>

            {/* Footer — pinned at bottom, above iOS home indicator */}
            <div style={{
              flexShrink: 0,
              padding: "12px 20px",
              paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
              borderTop: "1px solid #f3f4f6",
              display: "flex",
              gap: 12,
              background: "#ffffff",
              boxSizing: "border-box",
            }}>
              <button
                onClick={closeModal}
                style={{
                  flex: 1, height: 50, borderRadius: 16,
                  border: "1.5px solid #e5e7eb", background: "#fff",
                  color: "#374151", fontSize: 15, fontWeight: 600, cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={saveService}
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
                ) : editing ? (
                  "Salvar alterações"
                ) : (
                  "Adicionar serviço"
                )}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </BusinessLayout>
  );
}
