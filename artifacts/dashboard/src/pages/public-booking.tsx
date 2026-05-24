import { useState, useEffect, useRef } from "react";
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
  Check,
  Plus,
} from "lucide-react";

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  businessType: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
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

function formatCurrency(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function formatPrice(price: string) {
  const n = parseFloat(price);
  if (isNaN(n) || n === 0) return "Grátis";
  return formatCurrency(n);
}

function priceNum(price: string) {
  return parseFloat(price) || 0;
}

function durationLabel(mins: number) {
  if (mins < 60) return `aprox. ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `aprox. ${h}h ${m}min` : `aprox. ${h}h`;
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

// Pure helper: is slot HH:MM blocked given existing bookings and new booking duration?
function isSlotBlockedFn(
  slot: string,
  durationMins: number,
  booked: { scheduledAt: string; durationMinutes: number }[],
): boolean {
  if (!slot) return false;
  const [h, m] = slot.split(":").map(Number);
  const slotStart = h * 60 + m;
  const slotEnd = slotStart + Math.max(durationMins, 30);
  for (const appt of booked) {
    const d = new Date(appt.scheduledAt);
    const apptStart = d.getHours() * 60 + d.getMinutes();
    const apptEnd = apptStart + appt.durationMinutes;
    if (slotStart < apptEnd && apptStart < slotEnd) return true;
  }
  return false;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function applyPhoneMask(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const INPUT =
  "w-full border border-gray-200 rounded-2xl px-4 text-[15px] text-gray-900 placeholder:text-gray-400 " +
  "focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all bg-white";
const INPUT_H: React.CSSProperties = { height: 52 };

const emptyForm = () => ({
  clientName: "",
  clientPhone: "",
  date: todayISO(),
  time: "09:00",
  notes: "",
});

export default function PublicBookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [data, setData] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedServices, setSelectedServices] = useState<ServiceInfo[]>([]);
  const [step, setStep] = useState<"services" | "form" | "success">("services");

  // Form data is NEVER reset when navigating back to services —
  // only cleared when starting a fresh booking from the success screen.
  const [form, setForm] = useState(emptyForm());
  const [booking, setBooking] = useState(false);
  const [formError, setFormError] = useState("");

  // Availability
  const [availability, setAvailability] = useState<{ scheduledAt: string; durationMinutes: number }[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  // Fetch availability whenever date changes while on the form step
  useEffect(() => {
    if (!slug || step !== "form" || !form.date) return;
    let cancelled = false;
    setLoadingAvail(true);
    fetch(`/api/public/booking/${slug}/availability?date=${form.date}`)
      .then((r) => r.json())
      .then((d: { appointments?: { scheduledAt: string; durationMinutes: number }[] }) => {
        if (cancelled) return;
        setAvailability(d.appointments ?? []);
      })
      .catch(() => { if (!cancelled) setAvailability([]); })
      .finally(() => { if (!cancelled) setLoadingAvail(false); });
    return () => { cancelled = true; };
  }, [slug, form.date, step]);

  // When availability loads, if the selected time is now blocked — pick the first free slot
  useEffect(() => {
    if (loadingAvail) return;
    const dur = selectedServices.reduce((s, sv) => s + sv.durationMinutes, 0) || 30;
    if (isSlotBlockedFn(form.time, dur, availability)) {
      const first = TIME_SLOTS.find((s) => !isSlotBlockedFn(s, dur, availability));
      setForm((f) => ({ ...f, time: first ?? "" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, loadingAvail]);

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

  function toggleService(service: ServiceInfo) {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.id === service.id);
      return exists ? prev.filter((s) => s.id !== service.id) : [...prev, service];
    });
  }

  // Go to form — PRESERVE existing form data (don't reset)
  function goToForm() {
    if (selectedServices.length === 0) return;
    setFormError("");
    setStep("form");
  }

  // Go back to services from the form — preserve EVERYTHING (services + form data)
  function backToServicesFromForm() {
    setStep("services");
  }

  // Start a completely new booking from success screen
  function startNewBooking() {
    setSelectedServices([]);
    setForm(emptyForm());
    setFormError("");
    setStep("services");
  }

  const totalPrice = selectedServices.reduce((sum, s) => sum + priceNum(s.price), 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  const allFree = selectedServices.every((s) => priceNum(s.price) === 0);
  const formReady =
    form.clientName.trim().length > 0 &&
    form.clientPhone.trim().length >= 14 && // (XX) XXXXX-XXXX
    form.time.length > 0 &&
    !isSlotBlockedFn(form.time, totalDuration || 30, availability);

  async function submitBooking() {
    setFormError("");
    if (!form.clientName.trim()) { setFormError("Informe seu nome completo"); return; }
    if (!form.clientPhone.trim()) { setFormError("Informe seu WhatsApp"); return; }
    if (!form.date) { setFormError("Escolha uma data"); return; }

    setBooking(true);
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString();
      const responses = await Promise.all(
        selectedServices.map((service) =>
          fetch(`/api/public/booking/${slug}/appointments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientName: form.clientName.trim(),
              clientPhone: form.clientPhone.trim(),
              serviceId: service.id,
              scheduledAt,
              notes: form.notes.trim() || null,
              totalDurationMinutes: totalDuration || service.durationMinutes,
            }),
          })
        )
      );
      const failed = responses.find((r) => !r.ok);
      if (failed) {
        const err = await failed.json() as { error?: string };
        const isConflict = failed.status === 409;
        setFormError(err.error ?? "Erro ao agendar. Tente novamente.");
        if (isConflict) {
          // Re-fetch availability so the newly-blocked slot shows immediately
          setForm((f) => ({ ...f, time: "" }));
          setLoadingAvail(true);
          try {
            const avRes = await fetch(
              `/api/public/booking/${slug}/availability?date=${form.date}`,
            );
            const avData = await avRes.json() as {
              appointments?: { scheduledAt: string; durationMinutes: number }[];
            };
            setAvailability(avData.appointments ?? []);
          } finally {
            setLoadingAvail(false);
          }
        }
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
  const scrollRef = useRef<HTMLDivElement>(null);

  function buildWhatsAppText() {
    const dateLabel = new Date(form.date + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long",
    });
    const names = selectedServices.map((s) => s.name).join(", ");
    return encodeURIComponent(
      `Olá! Acabei de agendar: ${names} para ${dateLabel} às ${form.time}. Meu nome é ${form.clientName}.`
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (step === "success") {
    const dateLabel = new Date(form.date + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long",
    });
    return (
      <div
        className="flex flex-col items-center justify-center px-5 text-center bg-gradient-to-b from-violet-50 to-white"
        style={{
          minHeight: "100dvh",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-100">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        <h2 className="text-gray-900 font-black text-3xl tracking-tight">Agendado!</h2>
        <p className="text-gray-500 text-base mt-3 leading-relaxed max-w-xs">
          {selectedServices.length === 1 ? (
            <>
              <span className="font-semibold text-gray-700">{selectedServices[0].name}</span>{" "}
              confirmado para{" "}
              <span className="font-semibold text-gray-700">{dateLabel} às {form.time}</span>.
            </>
          ) : (
            <>
              <span className="font-semibold text-gray-700">{selectedServices.length} serviços</span>{" "}
              confirmados para{" "}
              <span className="font-semibold text-gray-700">{dateLabel} às {form.time}</span>.
            </>
          )}
        </p>

        <p className="text-gray-700 text-sm mt-3 font-semibold">
          Seu agendamento foi registrado com sucesso.
        </p>
        {tenant.phone && (
          <p className="text-gray-400 text-sm mt-1.5 max-w-xs leading-relaxed">
            Você também pode receber os detalhes pelo WhatsApp.
          </p>
        )}

        <div className="mt-8 w-full max-w-sm space-y-3">
          {tenant.phone && (
            <a
              href={`https://wa.me/${tenant.phone.replace(/\D/g, "")}?text=${buildWhatsAppText()}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2.5 w-full rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-[15px] font-bold transition-all active:scale-[0.98] shadow-md shadow-emerald-100"
              style={{ height: 52 }}
            >
              <MessageCircle className="w-5 h-5" />
              Enviar comprovante pelo WhatsApp
            </a>
          )}
          <button
            onClick={startNewBooking}
            className="flex items-center justify-center gap-2 w-full rounded-2xl border border-gray-200 bg-white text-[15px] text-gray-600 font-semibold hover:bg-gray-50 transition-all active:scale-[0.98]"
            style={{ height: 52 }}
          >
            <Plus className="w-4 h-4" />
            Novo agendamento
          </button>
        </div>

        <p className="text-gray-300 text-xs mt-8">Agendamentos via ReservaAI</p>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  if (step === "form") {
    return (
      <div className="fixed inset-0 bg-white flex flex-col">
        {/* Top bar */}
        <div
          className="flex items-center gap-3 px-4 border-b border-gray-100 shrink-0"
          style={{ height: 60, paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <button
            onClick={backToServicesFromForm}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Voltar para serviços"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 font-bold text-[15px] truncate">
              {selectedServices.length === 1
                ? selectedServices[0].name
                : `${selectedServices.length} serviços selecionados`}
            </p>
            <p className="text-gray-400 text-xs">{tenant.name}</p>
          </div>
          {/* "Editar serviços" chip */}
          <button
            onClick={backToServicesFromForm}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-600 text-xs font-semibold hover:bg-violet-100 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Editar
          </button>
        </div>

        {/* Scrollable form area */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}
        >
          <div className="px-4 pt-4 pb-4 space-y-4 max-w-lg mx-auto w-full">

            {/* ── Services summary card ── */}
            <div className="bg-violet-50 border border-violet-100 rounded-2xl px-4 py-3 space-y-2">
              {selectedServices.map((service) => (
                <div key={service.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-violet-900 font-bold text-sm truncate">{service.name}</p>
                    <p className="text-violet-500 text-xs mt-0.5">
                      {formatPrice(service.price)} · {durationLabel(service.durationMinutes)}
                    </p>
                  </div>
                </div>
              ))}
              {selectedServices.length > 1 && (
                <div className="pt-2 mt-1 border-t border-violet-200 flex items-center justify-between">
                  <span className="text-violet-600 text-xs font-bold">Total</span>
                  <span className="text-violet-700 text-xs font-bold">
                    {allFree ? "Grátis" : formatCurrency(totalPrice)}
                    {" · "}
                    {durationLabel(totalDuration)}
                  </span>
                </div>
              )}
            </div>

            {/* ── Seu nome ── */}
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

            {/* ── WhatsApp ── */}
            <div>
              <label className="text-gray-700 text-[13px] font-bold block mb-2">
                WhatsApp <span className="text-violet-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  value={form.clientPhone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, clientPhone: applyPhoneMask(e.target.value) }))
                  }
                  placeholder="(92) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                  className={`${INPUT} pl-11`}
                  style={INPUT_H}
                />
              </div>
            </div>

            {/* ── Data (full width) ── */}
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

            {/* ── Horário ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-gray-700 text-[13px] font-bold">
                  <Clock className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                  Horário <span className="text-violet-500">*</span>
                </label>
                {loadingAvail && (
                  <span className="flex items-center gap-1 text-[11px] text-violet-500 font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Verificando disponibilidade…
                  </span>
                )}
              </div>

              {loadingAvail ? (
                /* Skeleton while loading */
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-11 rounded-xl bg-gray-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS.map((slot) => {
                    const blocked = isSlotBlockedFn(slot, totalDuration || 30, availability);
                    const selected = form.time === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={blocked}
                        onClick={() => !blocked && setForm((f) => ({ ...f, time: slot }))}
                        className={[
                          "flex flex-col items-center justify-center rounded-xl py-2 text-[13px] font-semibold transition-all select-none",
                          blocked
                            ? "bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed opacity-60"
                            : selected
                              ? "bg-violet-600 text-white border border-violet-600 shadow-md shadow-violet-200 scale-[1.03]"
                              : "bg-white text-gray-700 border border-gray-200 hover:border-violet-400 hover:bg-violet-50 active:scale-[0.97]",
                        ].join(" ")}
                      >
                        <span>{slot}</span>
                        {blocked && (
                          <span className="text-[9px] font-medium mt-0.5 text-gray-300">
                            Indisponível
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {!loadingAvail && availability.length > 0 && !form.time && (
                <p className="text-amber-600 text-xs font-medium mt-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  Todos os horários estão ocupados nesta data. Tente outro dia.
                </p>
              )}
            </div>

            {/* ── Observação ── */}
            <div>
              <label className="text-gray-700 text-[13px] font-bold block mb-2">
                Observação{" "}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Alguma informação adicional..."
                rows={3}
                className={`${INPUT} py-3 resize-none`}
              />
            </div>

            {formError && (
              <p className="text-red-500 text-sm font-medium bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                {formError}
              </p>
            )}

            <div className="h-2" />
          </div>
        </div>

        {/* Sticky confirm button — safe area aware */}
        <div
          className="shrink-0 px-4 pt-3 bg-white border-t border-gray-100"
          style={{ paddingBottom: "calc(0.875rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            onClick={submitBooking}
            disabled={booking || !formReady}
            className="w-full rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-black text-[16px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] shadow-lg shadow-violet-200 disabled:shadow-none disabled:active:scale-100"
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
          {!formReady && !booking && (
            <p className="text-center text-gray-400 text-xs mt-2">
              Preencha seu nome e WhatsApp para continuar
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Services list ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col bg-gray-50">
      {/* ── Hero — full-bleed logo/photo ── */}
      <div
        className="shrink-0 relative overflow-hidden"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          minHeight: 300,
          ...(tenant.logoUrl
            ? {
                backgroundImage: `url(${tenant.logoUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {}),
        }}
      >
        {/* Purple gradient fallback — shown only when no logo */}
        {!tenant.logoUrl && (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-purple-800" />
        )}

        {/* Dark vignette overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background: tenant.logoUrl
              ? "linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.46) 55%, rgba(0,0,0,0.84) 100%)"
              : "linear-gradient(to bottom, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.38) 100%)",
          }}
        />

        {/* Content anchored to bottom of hero */}
        <div
          className="relative z-10 max-w-lg mx-auto px-5 w-full flex flex-col justify-end"
          style={{ minHeight: 300, paddingBottom: 28, paddingTop: 48 }}
        >
          <h1 className="text-white font-black text-[28px] leading-tight tracking-tight"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.45)" }}>
            {tenant.name}
          </h1>

          {(tenant.description || tenant.businessType) && (
            <p className="text-white/88 text-sm mt-1.5 leading-relaxed font-medium line-clamp-2"
               style={{ textShadow: "0 1px 4px rgba(0,0,0,0.40)" }}>
              {tenant.description ?? tenant.businessType}
            </p>
          )}

          <div className="flex items-center gap-3 mt-5 flex-wrap">
            {tenant.phone && (
              <a
                href={`https://wa.me/${tenant.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90 active:opacity-75"
                style={{ background: "linear-gradient(135deg,#25D366 0%,#128C7E 100%)" }}
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
            )}
            <button
              onClick={() => scrollRef.current?.scrollBy({ top: 400, behavior: "smooth" })}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white text-violet-700 text-sm font-bold shadow-lg hover:bg-violet-50 active:scale-95 transition-all"
            >
              Agendar agora
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Scrollable services list ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}
      >
        <div
          className="max-w-lg mx-auto px-4 pt-5 w-full space-y-3"
          style={{ paddingBottom: selectedServices.length > 0 ? "9rem" : "2.5rem" }}
        >
          {services.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center shadow-sm">
              <p className="text-gray-400 text-sm">Nenhum serviço disponível no momento.</p>
            </div>
          ) : (
            <>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest pb-1">
                Escolha um ou mais serviços
              </p>
              {services.map((service) => {
                const isSelected = selectedServices.some((s) => s.id === service.id);
                return (
                  <button
                    key={service.id}
                    onClick={() => toggleService(service)}
                    className={`w-full rounded-2xl p-4 shadow-sm text-left flex items-center gap-4 transition-all active:scale-[0.99] group border ${
                      isSelected
                        ? "bg-violet-50 border-violet-300 shadow-violet-100"
                        : "bg-white border-gray-100 hover:border-violet-200 hover:shadow-md"
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? "bg-violet-600" : "bg-violet-50 group-hover:bg-violet-100"
                      }`}
                    >
                      {isSelected
                        ? <Check className="w-5 h-5 text-white" />
                        : <Clock className="w-5 h-5 text-violet-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-[15px] leading-tight ${isSelected ? "text-violet-900" : "text-gray-900"}`}>
                        {service.name}
                      </p>
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

                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-md shadow-violet-200 ${
                        isSelected ? "bg-violet-600" : "bg-violet-600 group-hover:bg-violet-700"
                      }`}
                    >
                      {isSelected
                        ? <Check className="w-4 h-4 text-white" />
                        : <ChevronRight className="w-4 h-4 text-white" />}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          <p className="text-center text-gray-300 text-xs pt-2 pb-2">Agendamentos via ReservaAI</p>
        </div>
      </div>

      {/* ── Sticky bottom CTA — visible when ≥1 service selected ── */}
      {selectedServices.length > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 pt-3 shadow-2xl shadow-black/10"
          style={{ paddingBottom: "calc(0.875rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {/* Summary row */}
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <span className="text-gray-500 text-[13px]">
              {selectedServices.length === 1
                ? "1 serviço selecionado"
                : `${selectedServices.length} serviços selecionados`}
            </span>
            <span className="text-violet-700 text-[13px] font-bold">
              {allFree ? "Grátis" : formatCurrency(totalPrice)}
              {totalDuration > 0 && ` · ${durationLabel(totalDuration)}`}
            </span>
          </div>
          <button
            onClick={goToForm}
            className="w-full rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-[16px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-violet-200"
            style={{ height: 56 }}
          >
            <Sparkles className="w-4 h-4" />
            {form.clientName.trim()
              ? "Confirmar Agendamento"
              : "Continuar"}
          </button>
        </div>
      )}
    </div>
  );
}
