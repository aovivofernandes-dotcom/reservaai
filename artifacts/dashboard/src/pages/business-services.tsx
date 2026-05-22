import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import QRCode from "react-qr-code";
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
  Share2,
  MessageCircle,
  QrCode,
  Download,
  Link2,
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
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function durationLabel(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function displayCurrency(digits: string): string {
  const num = parseInt(digits || "0", 10);
  if (!digits || num === 0) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num / 100);
}

function getPublicLink(slug: string): string {
  return `${window.location.origin}/api/share/${slug}`;
}

interface ServiceForm {
  name: string;
  description: string;
  priceCents: string;
  durationMinutes: number;
}

const emptyForm: ServiceForm = { name: "", description: "", priceCents: "", durationMinutes: 60 };

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? 0 : "12px"})`,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.2s, transform 0.2s",
        pointerEvents: "none",
        zIndex: 9999,
        background: "#111827",
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        padding: "9px 18px",
        borderRadius: 99,
        display: "flex",
        alignItems: "center",
        gap: 7,
        boxShadow: "0 4px 20px rgba(0,0,0,0.28)",
        whiteSpace: "nowrap",
      }}
    >
      <Check style={{ width: 14, height: 14, color: "#34d399" }} />
      {message}
    </div>
  );
}

export default function BusinessServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ visible: false, message: "" });
  const qrRef = useRef<HTMLDivElement>(null);

  const tenantRaw = localStorage.getItem("business_tenant");
  const tenant: { slug?: string } = tenantRaw ? (JSON.parse(tenantRaw) as { slug?: string }) : {};
  const slug = tenant.slug ?? "";
  const publicLink = slug ? getPublicLink(slug) : "";

  useEffect(() => { loadServices(); }, []);

  function showToast(message: string) {
    setToast({ visible: true, message });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2200);
  }

  function loadServices() {
    setLoading(true);
    fetch("/api/business/services", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => setServices(Array.isArray(data) ? (data as Service[]) : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function copyLink() {
    if (!publicLink) return;
    const doCopy = () => {
      showToast("Link copiado!");
    };
    navigator.clipboard?.writeText(publicLink).then(doCopy).catch(() => {
      const el = document.createElement("textarea");
      el.value = publicLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      doCopy();
    });
  }

  function downloadQR() {
    const svgEl = qrRef.current?.querySelector("svg");
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement("canvas");
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `qrcode-agendamento-${slug || "link"}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
      showToast("QR Code salvo!");
    };
    img.src = url;
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
      priceCents: isNaN(priceNum) || priceNum === 0 ? "" : String(Math.round(priceNum * 100)),
      durationMinutes: s.durationMinutes,
    });
    setError("");
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditing(null); setError(""); }
  function closeShare() { setShowShare(false); setTimeout(() => setShowQR(false), 300); }

  function handlePriceInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    setForm((f) => ({ ...f, priceCents: digits }));
  }

  async function saveService() {
    setError("");
    if (!form.name.trim()) { setError("Nome é obrigatório"); return; }
    setSaving(true);
    const priceValue = form.priceCents ? parseInt(form.priceCents, 10) / 100 : 0;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: priceValue,
      durationMinutes: form.durationMinutes,
    };
    try {
      const url = editing ? `/api/business/services/${editing.id}` : "/api/business/services";
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
      await fetch(`/api/business/services/${id}`, { method: "DELETE", headers: getAuthHeaders() });
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

  const whatsappText = encodeURIComponent(`Agende seu horário online:\n${publicLink}`);

  return (
    <BusinessLayout title="Serviços">
      <div className="px-4 py-6 w-full" style={{ maxWidth: 672, margin: "0 auto", boxSizing: "border-box" }}>
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
            <div className="flex items-center gap-2 shrink-0">
              {/* ── FAB — Share ── */}
              <button
                onClick={() => setShowShare(true)}
                aria-label="Compartilhar link de agendamento"
                className="w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all active:scale-95 hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                  boxShadow: "0 4px 14px rgba(109,40,217,0.45)",
                }}
              >
                <Share2 className="w-4 h-4 text-white" />
              </button>
              {/* ── Add button ── */}
              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3.5 py-2 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>
          </div>

          {/* ── Service list / empty state ── */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
          ) : services.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm py-12 px-5 text-center w-full" style={{ boxSizing: "border-box" }}>
              <div className="w-12 h-12 bg-violet-50 border border-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <LayoutGrid className="w-5 h-5 text-violet-400" />
              </div>
              <p className="text-gray-700 text-sm font-semibold">Nenhum serviço cadastrado</p>
              <p className="text-gray-400 text-xs mt-1.5 leading-relaxed max-w-[260px] mx-auto">
                Cadastre seus primeiros serviços. Depois compartilhe seu link para seus clientes agendarem.
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
                      <p className="text-gray-900 font-bold text-[15px] leading-tight truncate">{service.name}</p>
                      {service.description && (
                        <p className="text-gray-400 text-xs mt-1 leading-relaxed line-clamp-2">{service.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                        <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
                          <DollarSign className="w-3 h-3 shrink-0" />
                          <span className="text-xs font-bold">{formatPrice(service.price)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span className="text-xs font-semibold">{durationLabel(service.durationMinutes)}</span>
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
                        {deleting === service.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Toast ── */}
      <Toast message={toast.message} visible={toast.visible} />

      {/* ═══════════════════════════════════════════════════════════════════
          SHARE MODAL — bottom sheet via portal
      ═══════════════════════════════════════════════════════════════════ */}
      {showShare && createPortal(
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            touchAction: "none",
          }}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {/* Backdrop */}
          <div
            style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.50)",
              animation: "fadeInBg 0.2s ease",
            }}
            onClick={closeShare}
          />

          {/* Sheet */}
          <div
            style={{
              position: "relative",
              borderRadius: "24px 24px 0 0",
              background: "#ffffff",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
              animation: "slideUpSheet 0.28s cubic-bezier(0.32,0.72,0,1)",
              overflow: "hidden",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e5e7eb" }} />
            </div>

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 20px 16px", boxSizing: "border-box",
            }}>
              <div>
                <h2 style={{ color: "#111827", fontWeight: 800, fontSize: 17, margin: 0, letterSpacing: -0.3 }}>
                  Compartilhar agendamento
                </h2>
                <p style={{ color: "#9ca3af", fontSize: 12, margin: "3px 0 0", fontWeight: 500 }}>
                  Envie o link para seus clientes
                </p>
              </div>
              <button
                onClick={closeShare}
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

            {/* Link preview pill */}
            {publicLink && (
              <div style={{ padding: "0 20px 16px", boxSizing: "border-box" }}>
                <div style={{
                  background: "#f5f3ff", border: "1px solid #ede9fe",
                  borderRadius: 12, padding: "9px 14px",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <Link2 style={{ width: 13, height: 13, color: "#7c3aed", flexShrink: 0 }} />
                  <span style={{
                    color: "#6d28d9", fontSize: 12, fontFamily: "monospace",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    flex: 1,
                  }}>
                    {publicLink}
                  </span>
                </div>
              </div>
            )}

            {/* Options */}
            <div style={{ padding: "0 12px", boxSizing: "border-box" }}>

              {/* WhatsApp */}
              <a
                href={`https://wa.me/?text=${whatsappText}`}
                target="_blank"
                rel="noreferrer"
                onClick={closeShare}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 12px", borderRadius: 16, textDecoration: "none",
                  transition: "background 0.15s", cursor: "pointer",
                  background: "transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f0fdf4")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(34,197,94,0.35)",
                }}>
                  <MessageCircle style={{ width: 22, height: 22, color: "#fff" }} />
                </div>
                <div>
                  <p style={{ color: "#111827", fontSize: 15, fontWeight: 700, margin: 0 }}>
                    Compartilhar no WhatsApp
                  </p>
                  <p style={{ color: "#9ca3af", fontSize: 12, margin: "2px 0 0" }}>
                    Enviar link direto pelo WhatsApp
                  </p>
                </div>
              </a>

              {/* Copy link */}
              <button
                onClick={() => { copyLink(); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 12px", borderRadius: 16, textAlign: "left",
                  border: "none", background: "transparent", cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f3ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                  background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(109,40,217,0.35)",
                }}>
                  <Copy style={{ width: 20, height: 20, color: "#fff" }} />
                </div>
                <div>
                  <p style={{ color: "#111827", fontSize: 15, fontWeight: 700, margin: 0 }}>
                    Copiar link
                  </p>
                  <p style={{ color: "#9ca3af", fontSize: 12, margin: "2px 0 0" }}>
                    Colar em qualquer lugar
                  </p>
                </div>
              </button>

              {/* QR Code toggle */}
              <button
                onClick={() => setShowQR((v) => !v)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 12px", borderRadius: 16, textAlign: "left",
                  border: "none", background: "transparent", cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                  background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(59,130,246,0.35)",
                }}>
                  <QrCode style={{ width: 20, height: 20, color: "#fff" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#111827", fontSize: 15, fontWeight: 700, margin: 0 }}>
                    QR Code
                  </p>
                  <p style={{ color: "#9ca3af", fontSize: 12, margin: "2px 0 0" }}>
                    {showQR ? "Ocultar QR Code" : "Ver e baixar QR Code"}
                  </p>
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  border: "1.5px solid #e5e7eb",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: 0, height: 0,
                    borderLeft: "4px solid transparent",
                    borderRight: "4px solid transparent",
                    ...(showQR
                      ? { borderBottom: "6px solid #6b7280", marginTop: 2 }
                      : { borderTop: "6px solid #6b7280", marginBottom: 2 }),
                  }} />
                </div>
              </button>

              {/* QR Code panel */}
              {showQR && publicLink && (
                <div style={{
                  margin: "0 0 8px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 20,
                  padding: "24px 20px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                  animation: "fadeInBg 0.2s ease",
                }}>
                  <div
                    ref={qrRef}
                    style={{
                      background: "#fff",
                      padding: 16,
                      borderRadius: 16,
                      boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                      display: "inline-flex",
                    }}
                  >
                    <QRCode
                      value={publicLink}
                      size={180}
                      fgColor="#1e1b4b"
                      bgColor="#ffffff"
                      level="M"
                    />
                  </div>
                  <button
                    onClick={downloadQR}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "11px 24px", borderRadius: 12,
                      background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                      border: "none", color: "#fff",
                      fontSize: 14, fontWeight: 700, cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(109,40,217,0.35)",
                      transition: "transform 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    <Download style={{ width: 16, height: 16 }} />
                    Baixar QR Code
                  </button>
                </div>
              )}
            </div>

            {/* Bottom pad */}
            <div style={{ height: 12 }} />
          </div>
        </div>,
        document.body,
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ADD / EDIT SERVICE MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {showModal && createPortal(
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            touchAction: "none",
          }}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div
            style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.45)",
              animation: "fadeInBg 0.2s ease",
            }}
            onClick={closeModal}
          />
          <div
            style={{
              position: "relative",
              height: "calc(100dvh - 52px)",
              borderRadius: "20px 20px 0 0",
              background: "#ffffff",
              boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
              animation: "slideUpSheet 0.28s cubic-bezier(0.32,0.72,0,1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#d1d5db" }} />
            </div>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 20px 12px", borderBottom: "1px solid #f3f4f6",
              flexShrink: 0, boxSizing: "border-box",
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
            <div style={{
              flex: 1, overflowY: "auto", overflowX: "hidden",
              WebkitOverflowScrolling: "touch", padding: "20px",
              boxSizing: "border-box", minHeight: 0,
              display: "flex", flexDirection: "column", gap: 18,
            }}>
              <div>
                <label className={labelCls}>Nome do serviço <span style={{ color: "#ef4444" }}>*</span></label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Nome do serviço"
                  className={inputCls}
                  autoComplete="off"
                />
              </div>
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
            <div style={{
              flexShrink: 0, padding: "12px 20px",
              paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
              borderTop: "1px solid #f3f4f6",
              display: "flex", gap: 12,
              background: "#ffffff", boxSizing: "border-box",
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
                ) : editing ? "Salvar alterações" : "Adicionar serviço"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </BusinessLayout>
  );
}
