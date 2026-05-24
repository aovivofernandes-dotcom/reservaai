import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Building2, User, Phone, Mail, MapPin, Globe, Instagram,
  Link2, Copy, Check, ExternalLink, Share2,
  Clock, Bell, Shield, LogOut, Trash2, Eye, EyeOff,
  ChevronRight, Camera, X, Loader2, CreditCard,
  MessageCircle, Pencil, Save, RotateCcw,
} from "lucide-react";
import { BusinessLayout } from "@/components/business-layout";

// ── helpers ───────────────────────────────────────────────────────────────────

function getToken() { return localStorage.getItem("business_token") ?? ""; }
function getOrigin() { return window.location.origin; }

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(opts?.headers ?? {}),
    },
  });
  const data = await res.json() as unknown;
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Erro desconhecido");
  return data;
}

const DAYS = [
  { key: "mon", label: "Segunda" },
  { key: "tue", label: "Terça" },
  { key: "wed", label: "Quarta" },
  { key: "thu", label: "Quinta" },
  { key: "fri", label: "Sexta" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
] as const;
type DayKey = typeof DAYS[number]["key"];

interface DayHours { open: boolean; start: string; end: string; }
type BusinessHours = Record<DayKey, DayHours>;

const DEFAULT_HOURS: BusinessHours = {
  mon: { open: true,  start: "09:00", end: "18:00" },
  tue: { open: true,  start: "09:00", end: "18:00" },
  wed: { open: true,  start: "09:00", end: "18:00" },
  thu: { open: true,  start: "09:00", end: "18:00" },
  fri: { open: true,  start: "09:00", end: "18:00" },
  sat: { open: true,  start: "09:00", end: "14:00" },
  sun: { open: false, start: "09:00", end: "12:00" },
};

interface Prefs { notifications: boolean; autoReminder: boolean; autoConfirm: boolean; autoAccept: boolean; }
const DEFAULT_PREFS: Prefs = { notifications: true, autoReminder: true, autoConfirm: false, autoAccept: true };

const BUSINESS_CATEGORIES = [
  "Barbearia", "Salão de beleza", "Estética", "Clínica", "Tattoo & Piercing",
  "Consultoria", "Personal Trainer", "Yoga & Pilates", "Fotografia",
  "Pet Shop", "Odontologia", "Outro",
];

interface TenantData {
  id: string; name: string; slug: string; email: string; phone: string | null;
  plan: string; trialEndsAt: string | null; businessType: string | null;
  description: string | null; address: string | null; city: string | null;
  instagram: string | null; website: string | null; logoUrl: string | null;
  openingHours: string | null; preferences: string | null;
}
interface UserData { id: string; name: string; email: string; }

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: "success"|"error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, maxWidth: "calc(100vw - 32px)",
      background: type === "success" ? "#059669" : "#dc2626",
      color: "#fff", borderRadius: 14, padding: "12px 18px",
      fontSize: 14, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap",
    }}>
      {type === "success" ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{msg}</span>
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
          <span className="text-violet-600 [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
        </div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────

function Field({
  label, value, editing, name, type = "text", placeholder, as,
  onChange, options,
}: {
  label: string; value: string; editing: boolean; name: string;
  type?: string; placeholder?: string; as?: "textarea" | "select";
  onChange: (name: string, val: string) => void;
  options?: string[];
}) {
  if (!editing) {
    return (
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-medium ${value ? "text-gray-900" : "text-gray-400 italic"}`}>
          {value || "Não informado"}
        </p>
      </div>
    );
  }
  const base = "w-full border border-gray-200 rounded-xl px-3.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all placeholder-gray-400";
  if (as === "textarea") {
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
        <textarea
          className={`${base} py-3 resize-none`} rows={3}
          value={value} placeholder={placeholder}
          onChange={e => onChange(name, e.target.value)}
        />
      </div>
    );
  }
  if (as === "select") {
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
        <select className={`${base} h-11 pr-8 appearance-none`} value={value} onChange={e => onChange(name, e.target.value)}>
          <option value="">Selecione uma categoria</option>
          {options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
      <input className={`${base} h-11`} type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(name, e.target.value)} />
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${on ? "bg-violet-600" : "bg-gray-200"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function BusinessSettingsPage() {
  const [, navigate] = useLocation();

  // Remote data
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [user, setUser]     = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: "success"|"error" } | null>(null);
  const showToast = useCallback((msg: string, type: "success"|"error" = "success") => setToast({ msg, type }), []);

  // Edit modes
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingLink, setEditingLink]       = useState(false);
  const [savingProfile, setSavingProfile]   = useState(false);

  // Profile form
  const [form, setForm] = useState({
    userName: "", name: "", phone: "", email: "",
    businessType: "", description: "", address: "", city: "",
    instagram: "", website: "",
  });
  const [logoUrl, setLogoUrl] = useState("");
  const [logoCompressing, setLogoCompressing] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Booking link
  const [slugEdit, setSlugEdit] = useState("");
  const [savingSlug, setSavingSlug] = useState(false);
  const [copied, setCopied]         = useState(false);

  // Hours
  const [hours, setHours]     = useState<BusinessHours>(DEFAULT_HOURS);
  const [savingHours, setSavingHours] = useState(false);

  // Prefs
  const [prefs, setPrefs]       = useState<Prefs>(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Security
  const [showPwForm, setShowPwForm] = useState(false);
  const [pw, setPw]                 = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw]         = useState({ current: false, next: false });
  const [savingPw, setSavingPw]     = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword]   = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ── Load profile ──────────────────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch("/api/business/profile") as { tenant: TenantData; user: UserData };
        setTenant(data.tenant);
        setUser(data.user);
        setForm({
          userName: data.user?.name ?? "",
          name: data.tenant.name,
          phone: data.tenant.phone ?? "",
          email: data.tenant.email,
          businessType: data.tenant.businessType ?? "",
          description: data.tenant.description ?? "",
          address: data.tenant.address ?? "",
          city: data.tenant.city ?? "",
          instagram: data.tenant.instagram ?? "",
          website: data.tenant.website ?? "",
        });
        setLogoUrl(data.tenant.logoUrl ?? "");
        setSlugEdit(data.tenant.slug);

        if (data.tenant.openingHours) {
          try { setHours(JSON.parse(data.tenant.openingHours) as BusinessHours); } catch { /* keep default */ }
        }
        if (data.tenant.preferences) {
          try { setPrefs(JSON.parse(data.tenant.preferences) as Prefs); } catch { /* keep default */ }
        }
      } catch {
        // fallback to localStorage
        const t = localStorage.getItem("business_tenant");
        const u = localStorage.getItem("business_user");
        if (t) {
          const parsed = JSON.parse(t) as TenantData;
          setTenant(parsed);
          setForm(f => ({ ...f, name: parsed.name, phone: parsed.phone ?? "", email: parsed.email }));
          setSlugEdit(parsed.slug);
        }
        if (u) {
          const parsed = JSON.parse(u) as UserData;
          setUser(parsed);
          setForm(f => ({ ...f, userName: parsed.name }));
        }
      } finally { setLoading(false); }
    })();
  }, []);

  // ── Save profile ──────────────────────────────────────────────────────────

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const data = await apiFetch("/api/business/profile", {
        method: "PUT",
        body: JSON.stringify({ ...form, logoUrl }),
      }) as { tenant: TenantData; user: UserData };
      setTenant(data.tenant);
      setUser(data.user);
      setSlugEdit(data.tenant.slug);
      localStorage.setItem("business_tenant", JSON.stringify(data.tenant));
      if (data.user) localStorage.setItem("business_user", JSON.stringify(data.user));
      setEditingProfile(false);
      showToast("Alterações salvas com sucesso");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally { setSavingProfile(false); }
  }

  // ── Save slug ─────────────────────────────────────────────────────────────

  async function saveSlug() {
    if (!slugEdit.trim()) return;
    setSavingSlug(true);
    try {
      const data = await apiFetch("/api/business/profile", {
        method: "PUT",
        body: JSON.stringify({ slug: slugEdit.trim() }),
      }) as { tenant: TenantData };
      setTenant(data.tenant);
      setSlugEdit(data.tenant.slug);
      localStorage.setItem("business_tenant", JSON.stringify(data.tenant));
      setEditingLink(false);
      showToast("Link atualizado com sucesso");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally { setSavingSlug(false); }
  }

  // ── Logo upload ───────────────────────────────────────────────────────────

  function compressImage(dataUrl: string, maxPx = 800): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
          else { width = Math.round(width * maxPx / height); height = maxPx; }
        }
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        // try progressively lower quality until under 500 KB
        const qualities = [0.85, 0.70, 0.55, 0.40];
        for (const q of qualities) {
          const out = canvas.toDataURL("image/jpeg", q);
          if (out.length < 700_000 || q === 0.40) { resolve(out); return; }
        }
        resolve(canvas.toDataURL("image/jpeg", 0.40));
      };
      img.onerror = () => reject(new Error("load"));
      img.src = dataUrl;
    });
  }

  async function handleLogoFile(file: File) {
    // Reject only truly gigantic files (> 10 MB) — everything else gets compressed
    if (file.size > 10_485_760) {
      showToast("Arquivo muito grande. Máximo 10MB.", "error");
      return;
    }
    setLogoCompressing(true);
    try {
      const raw: string = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = e => res(e.target?.result as string ?? "");
        reader.onerror = () => rej(new Error("read"));
        reader.readAsDataURL(file);
      });
      const compressed = await compressImage(raw);
      setLogoUrl(compressed);
      showToast("Logo atualizada com sucesso");
    } catch {
      showToast("Não foi possível processar a imagem. Tente outro arquivo.", "error");
    } finally {
      setLogoCompressing(false);
      // reset input so same file can be re-selected
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  // ── Save hours ────────────────────────────────────────────────────────────

  async function saveHours() {
    setSavingHours(true);
    try {
      await apiFetch("/api/business/profile", { method: "PUT", body: JSON.stringify({ openingHours: JSON.stringify(hours) }) });
      showToast("Horários salvos com sucesso");
    } catch (e) { showToast((e as Error).message, "error"); }
    finally { setSavingHours(false); }
  }

  // ── Save prefs ────────────────────────────────────────────────────────────

  async function savePref(key: keyof Prefs, val: boolean) {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    setSavingPrefs(true);
    try {
      await apiFetch("/api/business/profile", { method: "PUT", body: JSON.stringify({ preferences: JSON.stringify(next) }) });
    } catch (e) { showToast((e as Error).message, "error"); }
    finally { setSavingPrefs(false); }
  }

  // ── Change password ───────────────────────────────────────────────────────

  async function changePassword() {
    if (!pw.current || !pw.next) { showToast("Preencha todos os campos", "error"); return; }
    if (pw.next !== pw.confirm) { showToast("As senhas não coincidem", "error"); return; }
    if (pw.next.length < 6) { showToast("Nova senha: mínimo 6 caracteres", "error"); return; }
    setSavingPw(true);
    try {
      await apiFetch("/api/business/password", { method: "PUT", body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }) });
      setPw({ current: "", next: "", confirm: "" });
      setShowPwForm(false);
      showToast("Senha alterada com sucesso");
    } catch (e) { showToast((e as Error).message, "error"); }
    finally { setSavingPw(false); }
  }

  // ── Delete account ────────────────────────────────────────────────────────

  async function deleteAccount() {
    if (!deletePassword) { showToast("Digite sua senha para confirmar", "error"); return; }
    setDeletingAccount(true);
    try {
      await apiFetch("/api/business/account", { method: "DELETE", body: JSON.stringify({ password: deletePassword }) });
      ["business_token","business_user","business_tenant"].forEach(k => localStorage.removeItem(k));
      navigate("/signup");
    } catch (e) { showToast((e as Error).message, "error"); setDeletingAccount(false); }
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  function logout() {
    ["business_token","business_user","business_tenant"].forEach(k => localStorage.removeItem(k));
    navigate("/signup");
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const bookingLink = `${getOrigin()}/onboard/${slugEdit || (tenant?.slug ?? "")}`;
  const planLabel   = tenant?.plan === "pro" ? "Pro" : tenant?.plan === "enterprise" ? "Premium" : "Starter";
  const trialDays   = tenant?.trialEndsAt ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86_400_000)) : null;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <BusinessLayout title="Configurações">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout title="Configurações">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="px-4 py-6 max-w-2xl mx-auto w-full space-y-5 pb-10">

        {/* ── Header ── */}
        <div>
          <h1 className="text-lg font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-500 text-sm mt-0.5">Gerencie sua conta e preferências</p>
        </div>

        {/* ── 1. Profile ── */}
        <SectionCard title="Perfil da empresa" icon={<Building2 />}>
          {/* Logo */}
          {/* ── Row 1: avatar + name + action buttons ── */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center overflow-hidden border-2 border-white shadow-md">
                {logoCompressing
                  ? <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                  : logoUrl
                    ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
                    : <span className="text-xl font-black text-violet-600">{form.name?.charAt(0).toUpperCase() || "R"}</span>
                }
              </div>
              {editingProfile && !logoCompressing && (
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-md hover:bg-violet-700 transition-colors"
                >
                  <Camera className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            {/* Name + subtitle */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate leading-tight">
                {form.name || tenant?.name || "—"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{user?.name}</p>
            </div>

            {/* Action buttons — always shrink-0, never overflow */}
            <div className="shrink-0">
              {!editingProfile ? (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Editar
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditingProfile(false)}
                    className="h-8 w-8 rounded-xl border border-gray-200 text-gray-400 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="flex items-center gap-1 h-8 px-3 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors disabled:opacity-60"
                  >
                    {savingProfile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Salvar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Row 2: logo actions (only while editing) ── */}
          {editingProfile && (
            <div className="flex items-center gap-3 mb-4 -mt-1">
              {logoCompressing ? (
                <span className="text-xs text-violet-500 font-semibold">Otimizando imagem...</span>
              ) : (
                <>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="text-xs text-violet-600 font-semibold hover:text-violet-800 transition-colors"
                  >
                    Alterar logo
                  </button>
                  {logoUrl && (
                    <>
                      <span className="text-gray-200 text-xs">|</span>
                      <button
                        onClick={() => setLogoUrl("")}
                        className="text-xs text-red-400 font-semibold hover:text-red-600 transition-colors"
                      >
                        Remover
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          <input ref={logoInputRef} type="file"
            accept="image/*,.heic,.heif"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }} />

          {/* Form fields */}
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome do negócio" name="name" value={form.name} editing={editingProfile}
                placeholder="Ex: Ana Salão" onChange={(n, v) => setForm(f => ({ ...f, [n]: v }))} />
              <Field label="Responsável" name="userName" value={form.userName} editing={editingProfile}
                placeholder="Seu nome" onChange={(n, v) => setForm(f => ({ ...f, [n]: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="WhatsApp" name="phone" value={form.phone} editing={editingProfile}
                placeholder="5592999999999" onChange={(n, v) => setForm(f => ({ ...f, [n]: v }))} />
              <Field label="E-mail" name="email" value={form.email} editing={editingProfile}
                type="email" placeholder="email@empresa.com"
                onChange={(n, v) => setForm(f => ({ ...f, [n]: v }))} />
            </div>
            <Field label="Categoria" name="businessType" value={form.businessType} editing={editingProfile}
              as="select" options={BUSINESS_CATEGORIES}
              onChange={(n, v) => setForm(f => ({ ...f, [n]: v }))} />
            <Field label="Descrição curta" name="description" value={form.description} editing={editingProfile}
              as="textarea" placeholder="Ex: Atendimento profissional com agendamento rápido e personalizado"
              onChange={(n, v) => setForm(f => ({ ...f, [n]: v }))} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Endereço" name="address" value={form.address} editing={editingProfile}
                placeholder="Rua, número" onChange={(n, v) => setForm(f => ({ ...f, [n]: v }))} />
              <Field label="Cidade" name="city" value={form.city} editing={editingProfile}
                placeholder="Ex: Manaus - AM" onChange={(n, v) => setForm(f => ({ ...f, [n]: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Instagram" name="instagram" value={form.instagram} editing={editingProfile}
                placeholder="@seu.perfil" onChange={(n, v) => setForm(f => ({ ...f, [n]: v }))} />
              <Field label="Website" name="website" value={form.website} editing={editingProfile}
                placeholder="https://..." onChange={(n, v) => setForm(f => ({ ...f, [n]: v }))} />
            </div>
          </div>
        </SectionCard>

        {/* ── 2. Booking link ── */}
        <SectionCard title="Link de agendamento" icon={<Link2 />}>
          <p className="text-gray-500 text-sm mb-3 leading-relaxed">
            Compartilhe este link com seus clientes para agendamento direto.
          </p>

          {/* Link display */}
          <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3.5 py-2.5 mb-3">
            <Link2 className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-violet-700 text-sm font-medium truncate flex-1">
              {bookingLink}
            </span>
          </div>

          {/* Slug edit */}
          {editingLink ? (
            <div className="space-y-3 mb-3">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Personalizar link</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3.5 h-11 text-sm">
                  <span className="text-gray-400 shrink-0 hidden sm:inline">{getOrigin()}/onboard/</span>
                  <input
                    className="flex-1 min-w-0 bg-transparent text-gray-900 font-semibold focus:outline-none"
                    value={slugEdit}
                    onChange={e => setSlugEdit(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder="meu-negocio"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Use letras minúsculas, números e hifens.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingLink(false); setSlugEdit(tenant?.slug ?? ""); }}
                  className="flex-1 h-9 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={saveSlug} disabled={savingSlug}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors disabled:opacity-60">
                  {savingSlug ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Salvar link
                </button>
              </div>
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => {
              navigator.clipboard.writeText(bookingLink).then(() => {
                setCopied(true); setTimeout(() => setCopied(false), 2000);
              });
            }}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-all ${
                copied ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiado!" : "Copiar"}
            </button>
            <button onClick={() => {
              if (navigator.share) {
                void navigator.share({ title: "Agende aqui", url: bookingLink });
              } else {
                navigator.clipboard.writeText(bookingLink);
                showToast("Link copiado para compartilhar");
              }
            }}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all">
              <Share2 className="w-4 h-4" />
              Compartilhar
            </button>
            <a href={bookingLink} target="_blank" rel="noreferrer"
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all">
              <ExternalLink className="w-4 h-4" />
              Abrir
            </a>
          </div>

          {!editingLink && (
            <button onClick={() => setEditingLink(true)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 h-9 rounded-xl border border-violet-200 text-violet-600 text-xs font-semibold hover:bg-violet-50 transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Personalizar link
            </button>
          )}
        </SectionCard>

        {/* ── 3. Opening hours ── */}
        <SectionCard title="Horário de funcionamento" icon={<Clock />}>
          <div className="space-y-2.5">
            {DAYS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-20 shrink-0">
                  <p className="text-xs font-semibold text-gray-700">{label}</p>
                </div>
                <Toggle on={hours[key].open} onChange={v => setHours(h => ({ ...h, [key]: { ...h[key], open: v } }))} />
                {hours[key].open ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <input type="time" value={hours[key].start}
                      onChange={e => setHours(h => ({ ...h, [key]: { ...h[key], start: e.target.value } }))}
                      className="flex-1 h-8 text-xs border border-gray-200 rounded-lg px-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-300" />
                    <span className="text-gray-400 text-xs shrink-0">até</span>
                    <input type="time" value={hours[key].end}
                      onChange={e => setHours(h => ({ ...h, [key]: { ...h[key], end: e.target.value } }))}
                      className="flex-1 h-8 text-xs border border-gray-200 rounded-lg px-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic flex-1">Fechado</span>
                )}
              </div>
            ))}
          </div>
          <button onClick={saveHours} disabled={savingHours}
            className="mt-4 w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-60">
            {savingHours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar horários
          </button>
        </SectionCard>

        {/* ── 4. Preferences ── */}
        <SectionCard title="Preferências" icon={<Bell />}>
          <div className="space-y-4">
            {([
              { key: "notifications",  label: "Notificações",           desc: "Receba alertas de novos agendamentos" },
              { key: "autoReminder",   label: "Lembrete automático",    desc: "Envia lembrete ao cliente 24h antes" },
              { key: "autoConfirm",    label: "Confirmação automática", desc: "Confirma agendamentos automaticamente" },
              { key: "autoAccept",     label: "Aceitar automaticamente", desc: "Novos agendamentos entram como confirmados" },
            ] as Array<{ key: keyof Prefs; label: string; desc: string }>).map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
                <Toggle on={prefs[key]} onChange={v => void savePref(key, v)} />
              </div>
            ))}
          </div>
          {savingPrefs && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
            </div>
          )}
        </SectionCard>

        {/* ── 5. Subscription ── */}
        <SectionCard title="Assinatura" icon={<CreditCard />}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-base font-bold text-gray-900">Plano {planLabel}</p>
              {trialDays !== null && trialDays > 0 ? (
                <p className="text-emerald-600 text-xs font-semibold mt-0.5">✓ Teste grátis — {trialDays} dia{trialDays !== 1 ? "s" : ""} restante{trialDays !== 1 ? "s" : ""}</p>
              ) : (
                <p className="text-gray-500 text-xs mt-0.5">Para ativar ou gerenciar, fale com o suporte</p>
              )}
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap border ${
              tenant?.plan === "pro" ? "text-violet-700 bg-violet-50 border-violet-100" :
              tenant?.plan === "enterprise" ? "text-amber-700 bg-amber-50 border-amber-100" :
              "text-gray-600 bg-gray-50 border-gray-200"
            }`}>
              {tenant?.plan === "pro" ? "⚡ Pro" : tenant?.plan === "enterprise" ? "👑 Premium" : "Starter"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            {[
              { label: "Plano", value: planLabel },
              { label: "Status", value: "Ativo" },
              { label: "Ciclo", value: "Mensal" },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                <p className="text-gray-400 text-[10px] uppercase tracking-wide">{s.label}</p>
                <p className="text-gray-900 text-xs font-bold mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          <a href="https://wa.me/5592992208060?text=Ol%C3%A1%20quero%20ativar%20meu%20plano%20ReservaAI"
            target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-bold transition-colors">
            <MessageCircle className="w-4 h-4 shrink-0" />
            Gerenciar assinatura via WhatsApp
          </a>
        </SectionCard>

        {/* ── 6. Security ── */}
        <SectionCard title="Segurança" icon={<Shield />}>
          {/* Change password */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Alterar senha</p>
                <p className="text-xs text-gray-400 mt-0.5">Recomendamos uma senha forte</p>
              </div>
              <button onClick={() => setShowPwForm(v => !v)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                {showPwForm ? <ChevronRight className="w-3.5 h-3.5 rotate-90" /> : <Pencil className="w-3.5 h-3.5" />}
                {showPwForm ? "Fechar" : "Alterar"}
              </button>
            </div>

            {showPwForm && (
              <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
                {[
                  { key: "current" as const, label: "Senha atual", show: showPw.current, toggle: () => setShowPw(s => ({ ...s, current: !s.current })) },
                  { key: "next" as const,    label: "Nova senha",   show: showPw.next,    toggle: () => setShowPw(s => ({ ...s, next: !s.next })) },
                ].map(({ key, label, show, toggle }) => (
                  <div key={key}>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
                    <div className="relative mt-1.5">
                      <input
                        type={show ? "text" : "password"}
                        value={pw[key]}
                        onChange={e => setPw(p => ({ ...p, [key]: e.target.value }))}
                        placeholder="••••••••"
                        className="w-full h-11 border border-gray-200 rounded-xl px-3.5 pr-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                      />
                      <button type="button" onClick={toggle}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Confirmar nova senha</label>
                  <input
                    type="password" value={pw.confirm}
                    onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full h-11 mt-1.5 border border-gray-200 rounded-xl px-3.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                  />
                </div>
                <button onClick={changePassword} disabled={savingPw}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-60">
                  {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Atualizar senha
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-2">
            <button onClick={logout}
              className="w-full flex items-center gap-3 px-4 h-11 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
              <LogOut className="w-4 h-4 text-gray-400 shrink-0" />
              Sair da conta
            </button>
            <button onClick={() => setShowDeleteModal(true)}
              className="w-full flex items-center gap-3 px-4 h-11 rounded-xl border border-red-100 bg-red-50 text-red-500 text-sm font-semibold hover:bg-red-100 transition-colors">
              <Trash2 className="w-4 h-4 shrink-0" />
              Excluir minha conta
            </button>
          </div>
        </SectionCard>

      </div>

      {/* ── Delete modal ── */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) { setShowDeleteModal(false); setDeletePassword(""); } }}
        >
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="text-center text-base font-black text-gray-900 mb-1">Excluir conta</h3>
            <p className="text-center text-sm text-gray-500 mb-4">
              Esta ação desativa sua conta permanentemente. Confirme com sua senha.
            </p>
            <div className="relative mb-4">
              <input
                type="password" value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full h-11 border border-gray-200 rounded-xl px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeletePassword(""); }}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={deleteAccount} disabled={deletingAccount}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-60">
                {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Excluir conta
              </button>
            </div>
          </div>
        </div>
      )}
    </BusinessLayout>
  );
}
