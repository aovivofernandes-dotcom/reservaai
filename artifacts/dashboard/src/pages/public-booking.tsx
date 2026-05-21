import { useState, useEffect } from "react";
import { useParams } from "wouter";
import {
  Clock,
  DollarSign,
  Phone,
  User,
  Calendar,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  X,
  MessageCircle,
} from "lucide-react";

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  businessType: string | null;
  phone: string | null;
  address: string | null;
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

export default function PublicBookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [data, setData] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Booking modal state
  const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");

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
      .then((d) => {
        if (d) setData(d as BookingData);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  function openBooking(service: ServiceInfo) {
    setSelectedService(service);
    setForm({ clientName: "", clientPhone: "", date: todayISO(), time: "09:00", notes: "" });
    setFormError("");
    setStep("form");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setStep("form");
  }

  async function submitBooking() {
    setFormError("");
    if (!form.clientName.trim()) { setFormError("Informe seu nome"); return; }
    if (!form.clientPhone.trim()) { setFormError("Informe seu telefone/WhatsApp"); return; }
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

  const inputCls =
    "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-400 transition-colors bg-white";

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-violet-500 animate-spin" />
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
        <p className="text-gray-400 text-sm mt-2">
          Verifique o link e tente novamente.
        </p>
      </div>
    );
  }

  const { tenant, services } = data;
  const initial = tenant.name.charAt(0).toUpperCase();

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ overflowX: "hidden", maxWidth: "100%", width: "100%" }}
    >
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-6 w-full">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-md shadow-violet-200 shrink-0">
              <span className="text-white font-bold text-2xl">{initial}</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-gray-900 font-bold text-xl leading-tight truncate">
                {tenant.name}
              </h1>
              {tenant.businessType && (
                <p className="text-gray-400 text-sm mt-0.5">{tenant.businessType}</p>
              )}
              {tenant.address && (
                <p className="text-gray-400 text-xs mt-0.5 truncate">{tenant.address}</p>
              )}
            </div>
          </div>

          {tenant.phone && (
            <a
              href={`https://wa.me/${tenant.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-center gap-2 w-full justify-center py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Falar no WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* ── Services ── */}
      <div className="max-w-lg mx-auto px-4 py-6 w-full space-y-4">
        <h2 className="text-gray-900 font-bold text-lg">
          {services.length === 0 ? "Em breve" : "Nossos serviços"}
        </h2>

        {services.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
            <p className="text-gray-400 text-sm">
              Nenhum serviço disponível no momento.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-bold text-[15px] leading-tight">
                      {service.name}
                    </p>
                    {service.description && (
                      <p className="text-gray-500 text-sm mt-1 leading-relaxed">
                        {service.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2.5 mt-3 flex-wrap">
                      <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
                        <DollarSign className="w-3 h-3" />
                        <span className="text-xs font-bold">{formatPrice(service.price)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs font-semibold">{durationLabel(service.durationMinutes)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => openBooking(service)}
                    className="shrink-0 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors active:scale-95"
                  >
                    Agendar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-gray-300 text-xs pb-4">
          Agendamentos via ReservaAI
        </p>
      </div>

      {/* ── Booking modal ── */}
      {showModal && selectedService && (
        <div
          className={`fixed inset-0 bg-black/50 z-50 flex justify-center ${
            step === "success" ? "items-center" : "items-end sm:items-center"
          }`}
          style={{ padding: step === "success" ? "16px" : undefined }}
        >
          <div
            className={`bg-white w-full max-w-md shadow-2xl overflow-y-auto overflow-x-hidden ${
              step === "success" ? "rounded-3xl" : "rounded-t-3xl sm:rounded-2xl"
            }`}
            style={{
              maxHeight: "92dvh",
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {step === "form" ? (
              <>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                  <div className="min-w-0">
                    <h2 className="text-gray-900 font-bold text-[15px]">Agendar serviço</h2>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">{selectedService.name}</p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0 ml-3"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Service summary */}
                <div className="mx-5 my-4 bg-violet-50 border border-violet-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-violet-900 font-semibold text-sm truncate">{selectedService.name}</p>
                    <p className="text-violet-600 text-xs">
                      {formatPrice(selectedService.price)} · {durationLabel(selectedService.durationMinutes)}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-4 space-y-4">
                  <div>
                    <label className="text-gray-700 text-[12px] font-bold block mb-1.5">
                      Seu nome <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        value={form.clientName}
                        onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                        placeholder="Nome completo"
                        className={`${inputCls} pl-9`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-gray-700 text-[12px] font-bold block mb-1.5">
                      WhatsApp / Telefone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        value={form.clientPhone}
                        onChange={(e) => setForm((f) => ({ ...f, clientPhone: e.target.value }))}
                        placeholder="(11) 99999-9999"
                        inputMode="tel"
                        className={`${inputCls} pl-9`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-gray-700 text-[12px] font-bold block mb-1.5">
                        <Calendar className="inline w-3 h-3 mr-1" />
                        Data <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={form.date}
                        min={todayISO()}
                        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                        className={inputCls}
                        style={{ minHeight: "44px" }}
                      />
                    </div>
                    <div>
                      <label className="text-gray-700 text-[12px] font-bold block mb-1.5">
                        <Clock className="inline w-3 h-3 mr-1" />
                        Horário <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.time}
                        onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                        className={inputCls}
                        style={{ minHeight: "44px" }}
                      >
                        {TIME_SLOTS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-gray-700 text-[12px] font-bold block mb-1.5">
                      Observações <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Alguma informação adicional..."
                      rows={2}
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  {formError && <p className="text-red-500 text-xs">{formError}</p>}
                </div>

                <div
                  className="px-5 pt-4 border-t border-gray-100 bg-white sticky bottom-0"
                  style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
                >
                  <button
                    onClick={submitBooking}
                    disabled={booking}
                    className="w-full h-12 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.98] shadow-md shadow-violet-200"
                  >
                    {booking ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Agendando…</>
                    ) : (
                      "Confirmar agendamento"
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div
                className="px-5 pt-8 text-center"
                style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
              >
                {/* Success icon */}
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <h2 className="text-gray-900 font-bold text-2xl">Agendado!</h2>
                <p className="text-gray-500 text-sm mt-2.5 leading-relaxed max-w-xs mx-auto">
                  Seu agendamento foi recebido com sucesso.{" "}
                  {tenant.phone
                    ? "Em breve você receberá uma confirmação pelo WhatsApp."
                    : "Aguarde a confirmação do estabelecimento."}
                </p>

                <div className="mt-6 space-y-3">
                  {tenant.phone && (
                    <a
                      href={`https://wa.me/${tenant.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Acabei de agendar ${selectedService.name} para ${form.date} às ${form.time}. Meu nome é ${form.clientName}.`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors shadow-md shadow-emerald-100"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Confirmar pelo WhatsApp
                    </a>
                  )}

                  <button
                    onClick={closeModal}
                    className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl border border-gray-200 bg-white text-sm text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Ver outros serviços
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
