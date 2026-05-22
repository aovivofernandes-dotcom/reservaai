import { useState, useEffect } from "react";
import { useParams } from "wouter";
import {
  Clock,
  Phone,
  User,
  Calendar,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  MessageCircle,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  businessType: string | null;
  phone: string | null;
  address: string | null;
  logoUrl?: string | null;
}

interface ServiceInfo {
  id: string;
  name: string;
  description: string | null;
  price: string;
  durationMinutes: number;
}

interface BookingData {
  tenant: TenantInfo;
  services: ServiceInfo[];
}

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

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h <= 19; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 19) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// ── Input class — 52px height, premium feel ────────────────────────────────
const INPUT =
  "w-full border border-gray-200 rounded-2xl px-4 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all bg-white";
const INPUT_H = { minHeight: 52 };

export default function PublicBookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [data, setData] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null);
  const [step, setStep] = useState<"services" | "form" | "success">("services");

  const [form, setForm] = useState({
    clientName: "",
    clientPhone: "",
    date: todayISO(),
    time: "09:00",
    notes: "",
  });
  const [booking, setBooking] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/booking/${slug}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => { if (d) setData(d as BookingData); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  // Lock body scroll when in form step on mobile
  useEffect(() => {
    if (step === "form") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [step]);

  function selectService(service: ServiceInfo) {
    setSelectedService(service);
    setForm({ clientName: "", clientPhone: "", date: todayISO(), time: "09:00", notes: "" });
    setFormError("");
    setStep("form");
  }

  function backToServices() {
    setStep("services");
    setSelectedService(null);
  }

  async function submitBooking() {
    setFormError("");
    if (!form.clientName.trim()) { setFormError("Informe seu nome completo"); return; }
    if (!form.clientPhone.trim()) { setFormError("Informe seu WhatsApp"); return; }
    if (!form.date) { setFormError("Escolha uma data"); return; }

    setBooking(true);
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString();
      const res = await fetch(`/api/public/booking/${slug}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: form.clientName.trim(),
          clientPhone: form.clientPhone.trim(),
          serviceId: selectedService?.id,
          scheduledAt,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        setFormError(err.error ?? "Erro ao agendar. Tente novamente.");
        return;
      }
      setStep("success");
    } catch {
      setFormError("Erro de conexão. Tente novamente.");
    } finally {
      setBooking(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 text-center">
        <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-3xl flex items-center justify-center mb-4">
          <span className="text-3xl">🔍</span>
        </div>
        <h1 className="text-gray-900 font-bold text-xl">Página não encontrada</h1>
        <p className="text-gray-400 text-sm mt-2">Verifique o link e tente novamente.</p>
      </div>
    );
  }

  const { tenant, services } = data;
  const initial = tenant.name.charAt(0).toUpperCase();

  // ── Success ───────────────────────────────────────────────────────────────
  if (step === "success" && selectedService) {
    return (
      <div
        className="min-h-screen bg-gradient-to-b from-violet-50 to-white flex flex-col items-center justify-center px-5 text-center"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-100">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        <h2 className="text-gray-900 font-black text-3xl tracking-tight">Agendado!</h2>
        <p className="text-gray-500 text-base mt-3 leading-relaxed max-w-xs">
          <span className="font-semibold text-gray-700">{selectedService.name}</span> confirmado para{" "}
          <span className="font-semibold text-gray-700">
            {new Date(form.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} às {form.time}
          </span>.
        </p>
        {tenant.phone && (
          <p className="text-gray-400 text-sm mt-2">Em breve você receberá uma confirmação pelo WhatsApp.</p>
        )}

        <div className="mt-8 w-full max-w-sm space-y-3">
          {tenant.phone && (
            <a
              href={`https://wa.me/${tenant.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Acabei de agendar ${selectedService.name} para ${form.date} às ${form.time}. Meu nome é ${form.clientName}.`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2.5 w-full rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-[15px] font-bold transition-all active:scale-[0.98] shadow-md shadow-emerald-100"
              style={{ height: 52 }}
            >
              <MessageCircle className="w-5 h-5" />
              Confirmar pelo WhatsApp
            </a>
          )}
          <button
            onClick={backToServices}
            className="flex items-center justify-center gap-2 w-full rounded-2xl border border-gray-200 bg-white text-[15px] text-gray-600 font-semibold hover:bg-gray-50 transition-all active:scale-[0.98]"
            style={{ height: 52 }}
          >
            <ArrowLeft className="w-4 h-4" />
            Ver outros serviços
          </button>
        </div>

        <p className="text-gray-300 text-xs mt-8">Agendamentos via ReservaAI</p>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  if (step === "form" && selectedService) {
    return (
      <div
        className="fixed inset-0 bg-white flex flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 border-b border-gray-100 shrink-0" style={{ height: 60, paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <button
            onClick={backToServices}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 font-bold text-[15px] truncate">{selectedService.name}</p>
            <p className="text-gray-400 text-xs">{tenant.name}</p>
          </div>
        </div>

        {/* Scrollable form area */}
        <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>
          <div className="px-4 pt-4 pb-2 space-y-4 max-w-lg mx-auto w-full">

            {/* Service summary pill */}
            <div className="flex items-center gap-3 bg-violet-50 border border-violet-100 rounded-2xl px-4 py-3">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-violet-900 font-bold text-sm truncate">{selectedService.name}</p>
                <p className="text-violet-500 text-xs mt-0.5">
                  {formatPrice(selectedService.price)} · {durationLabel(selectedService.durationMinutes)}
                </p>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-gray-700 text-[13px] font-bold block mb-2">
                Seu nome <span className="text-violet-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  value={form.clientName}
                  onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                  placeholder="Nome completo"
                  autoComplete="name"
                  className={`${INPUT} pl-11`}
                  style={INPUT_H}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="text-gray-700 text-[13px] font-bold block mb-2">
                WhatsApp <span className="text-violet-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  value={form.clientPhone}
                  onChange={(e) => setForm((f) => ({ ...f, clientPhone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                  className={`${INPUT} pl-11`}
                  style={INPUT_H}
                />
              </div>
            </div>

            {/* Date + Time side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-700 text-[13px] font-bold block mb-2">
                  <Calendar className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                  Data <span className="text-violet-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.date}
                  min={todayISO()}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className={INPUT}
                  style={INPUT_H}
                />
              </div>
              <div>
                <label className="text-gray-700 text-[13px] font-bold block mb-2">
                  <Clock className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                  Horário <span className="text-violet-500">*</span>
                </label>
                <select
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  className={INPUT}
                  style={INPUT_H}
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-gray-700 text-[13px] font-bold block mb-2">
                Observação{" "}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Alguma informação adicional..."
                rows={2}
                className={`${INPUT} py-3 resize-none`}
              />
            </div>

            {formError && (
              <p className="text-red-500 text-sm font-medium bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                {formError}
              </p>
            )}

            {/* Spacer so content isn't hidden behind sticky button */}
            <div className="h-4" />
          </div>
        </div>

        {/* Sticky confirm button */}
        <div
          className="shrink-0 px-4 pt-3 pb-4 bg-white border-t border-gray-100"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={submitBooking}
            disabled={booking}
            className="w-full rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-[16px] flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-violet-200"
            style={{ height: 56 }}
          >
            {booking ? (
              <><Loader2 className="w-5 h-5 animate-spin" />Agendando…</>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Confirmar Agendamento
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Services list ─────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-violet-700 to-violet-600">
        <div className="max-w-lg mx-auto px-4 pt-10 pb-8 w-full">
          <div className="flex flex-col items-center text-center">
            {/* Logo / Avatar */}
            <div className="w-20 h-20 rounded-3xl bg-white/20 border-2 border-white/30 flex items-center justify-center shadow-xl shadow-violet-900/30 mb-4 backdrop-blur-sm">
              <span className="text-white font-black text-3xl">{initial}</span>
            </div>

            <h1 className="text-white font-black text-2xl tracking-tight leading-tight">
              {tenant.name}
            </h1>

            <p className="text-violet-200 text-sm mt-1.5 font-medium">
              Agende seu horário em menos de 1 minuto
            </p>

            {tenant.phone && (
              <a
                href={`https://wa.me/${tenant.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-colors backdrop-blur-sm"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Falar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Services ─────────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-4 -mt-4 pb-8 w-full space-y-3">
        {services.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center shadow-sm">
            <p className="text-gray-400 text-sm">Nenhum serviço disponível no momento.</p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest pt-2 pb-1">
              Escolha um serviço
            </p>
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => selectService(service)}
                className="w-full bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-left flex items-center gap-4 hover:border-violet-200 hover:shadow-md transition-all active:scale-[0.99] group"
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-2xl bg-violet-50 group-hover:bg-violet-100 flex items-center justify-center shrink-0 transition-colors">
                  <Clock className="w-5 h-5 text-violet-500" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-bold text-[15px] leading-tight">{service.name}</p>
                  {service.description && (
                    <p className="text-gray-400 text-xs mt-0.5 truncate">{service.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {formatPrice(service.price)}
                    </span>
                    <span className="text-gray-400 bg-gray-50 border border-gray-100 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      {durationLabel(service.durationMinutes)}
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="w-8 h-8 rounded-xl bg-violet-600 group-hover:bg-violet-700 flex items-center justify-center shrink-0 transition-colors shadow-md shadow-violet-200">
                  <ChevronRight className="w-4 h-4 text-white" />
                </div>
              </button>
            ))}
          </>
        )}

        <p className="text-center text-gray-300 text-xs pt-4">Agendamentos via ReservaAI</p>
      </div>
    </div>
  );
}
