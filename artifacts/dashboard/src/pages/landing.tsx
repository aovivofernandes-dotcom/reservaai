import { useState, useEffect } from "react";
import { useLocation } from "wouter";

const SUPPORT_WA = "https://wa.me/5592992208060?text=Ol%C3%A1%20quero%20ativar%20meu%20plano%20ReservaAI";
const SIGNUP_WA  = "https://wa.me/5592992208060?text=Ol%C3%A1%20quero%20criar%20minha%20conta%20gr%C3%A1tis%20no%20ReservaAI";

// ── tiny helpers ──────────────────────────────────────────────────────────────

function WaIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size, fill: "currentColor", flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.526 5.847L0 24l6.304-1.654A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 01-5.001-1.369l-.359-.213-3.722.976.993-3.628-.234-.373A9.79 9.79 0 012.182 12C2.182 6.579 6.579 2.182 12 2.182S21.818 6.579 21.818 12 17.421 21.818 12 21.818z"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" style={{ width: 16, height: 16, fill: "none", stroke: "#7c3aed", strokeWidth: 2.5, flexShrink: 0 }}>
      <polyline points="4,10 8,14 16,6" />
    </svg>
  );
}

// ── Phone mockup ──────────────────────────────────────────────────────────────

function PhoneMockup() {
  return (
    <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      {/* Glow */}
      <div style={{
        position: "absolute", inset: -24,
        background: "radial-gradient(ellipse at center, rgba(124,58,237,0.35) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      {/* Phone shell */}
      <div style={{
        width: 230, borderRadius: 36, padding: 10,
        background: "linear-gradient(160deg, #1e1144 0%, #0f0a24 100%)",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
        position: "relative",
      }}>
        {/* Notch */}
        <div style={{ width: 60, height: 22, background: "#0f0a24", borderRadius: 12, margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2d2250" }} />
        </div>
        {/* Screen */}
        <div style={{ background: "#f9fafb", borderRadius: 26, overflow: "hidden", minHeight: 460 }}>
          {/* Status bar */}
          <div style={{ background: "#fff", padding: "8px 14px 6px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 9 }}>R</span>
            </div>
            <span style={{ color: "#111827", fontSize: 10, fontWeight: 600 }}>ReservaAI</span>
          </div>

          {/* Welcome */}
          <div style={{ padding: "12px 14px 8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ color: "#111827", fontSize: 11, fontWeight: 800, margin: 0 }}>Olá, Ana!</p>
                <p style={{ color: "#9ca3af", fontSize: 8, margin: "1px 0 0" }}>segunda-feira, 20 de maio</p>
              </div>
              <span style={{ fontSize: 8, fontWeight: 700, color: "#5b21b6", background: "#f5f3ff", border: "1px solid #ede9fe", padding: "2px 7px", borderRadius: 99 }}>
                5d de teste
              </span>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "0 14px 10px" }}>
            {[
              { label: "agendamentos", value: "24", color: "#7c3aed", bg: "#f5f3ff" },
              { label: "serviços ativos", value: "8",  color: "#059669", bg: "#ecfdf5" },
            ].map((s) => (
              <div key={s.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                </div>
                <div style={{ color: "#111827", fontWeight: 800, fontSize: 14 }}>{s.value}</div>
                <div style={{ color: "#9ca3af", fontSize: 7 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Appointments */}
          <div style={{ margin: "0 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "#111827", fontWeight: 700, fontSize: 9 }}>Agendamentos recentes</span>
              <span style={{ color: "#7c3aed", fontSize: 8, fontWeight: 600 }}>Ver todos →</span>
            </div>
            {[
              { name: "Marcos Silva",  service: "Corte + Barba",  time: "Hoje 14:00",   status: "Confirmado", dot: "#10b981" },
              { name: "Julia Costa",   service: "Manicure",       time: "Hoje 15:30",   status: "Pendente",   dot: "#f59e0b" },
              { name: "Pedro Alves",   service: "Massagem",       time: "Amanhã 10:00", status: "Confirmado", dot: "#10b981" },
            ].map((a) => (
              <div key={a.name} style={{ padding: "7px 10px", display: "flex", alignItems: "center", gap: 7, borderBottom: "1px solid #f9fafb" }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, background: "#f5f3ff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#7c3aed", fontSize: 9, fontWeight: 800 }}>{a.name.charAt(0)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "#111827", fontSize: 8, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</p>
                  <p style={{ color: "#9ca3af", fontSize: 7, margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.time} · {a.service}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: a.dot }} />
                  <span style={{ color: "#6b7280", fontSize: 7, fontWeight: 600 }}>{a.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom nav */}
          <div style={{ display: "flex", justifyContent: "space-around", padding: "10px 4px 14px", background: "#fff", marginTop: 10, borderTop: "1px solid #e5e7eb" }}>
            {["Painel","Clientes","Serviços","Config."].map((t, i) => (
              <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ width: 22, height: 14, borderRadius: 7, background: i === 0 ? "#ede9fe" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: i === 0 ? "#7c3aed" : "#d1d5db" }} />
                </div>
                <span style={{ fontSize: 6, fontWeight: 600, color: i === 0 ? "#7c3aed" : "#9ca3af" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 20); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollTo(id: string) {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif", overflowX: "hidden", background: "#fff" }}>

      {/* ── HEADER ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: scrolled ? "rgba(255,255,255,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.07)" : "1px solid transparent",
        transition: "all 0.2s",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
      }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(124,58,237,0.4)" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>R</span>
            </div>
            <span style={{ color: "#111827", fontWeight: 800, fontSize: 18, letterSpacing: "-0.03em" }}>ReservaAI</span>
          </div>

          {/* Desktop nav */}
          <nav style={{ display: "none", alignItems: "center", gap: 28 }} className="hidden md:flex">
            {[["funcionalidades","Funcionalidades"],["como-funciona","Como funciona"],["para-quem","Para quem é"],["precos","Preços"]].map(([id,label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", fontSize: 14, fontWeight: 500 }}
              >{label}</button>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div style={{ display: "none", alignItems: "center", gap: 10 }} className="hidden md:flex">
            <button onClick={() => navigate("/signup")}
              style={{ height: 38, padding: "0 20px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >Entrar</button>
            <button onClick={() => navigate("/signup")}
              style={{ height: 38, padding: "0 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(124,58,237,0.35)" }}
            >Começar grátis</button>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", flexDirection: "column", gap: 4.5 }}
          >
            {[0,1,2].map(i => (
              <span key={i} style={{ display: "block", width: 20, height: 2, background: "#374151", borderRadius: 2, transition: "all 0.2s",
                transform: menuOpen && i === 0 ? "translateY(6.5px) rotate(45deg)" : menuOpen && i === 2 ? "translateY(-6.5px) rotate(-45deg)" : "none",
                opacity: menuOpen && i === 1 ? 0 : 1,
              }} />
            ))}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div style={{ background: "#fff", borderTop: "1px solid #f3f4f6", padding: "12px 20px 20px" }}>
            {[["funcionalidades","Funcionalidades"],["como-funciona","Como funciona"],["para-quem","Para quem é"],["precos","Preços"]].map(([id,label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "#374151", fontSize: 15, fontWeight: 500, padding: "12px 0", borderBottom: "1px solid #f9fafb" }}
              >{label}</button>
            ))}
            <button onClick={() => { setMenuOpen(false); navigate("/signup"); }}
              style={{ marginTop: 16, width: "100%", height: 48, borderRadius: 14, border: "none", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
            >Começar grátis</button>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section style={{ background: "linear-gradient(160deg, #0f0528 0%, #1e0a4e 40%, #2d1279 100%)", padding: "72px 20px 80px", overflow: "hidden", position: "relative" }}>
        {/* Background decorations */}
        <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "rgba(124,58,237,0.15)", filter: "blur(80px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(37,211,102,0.08)", filter: "blur(60px)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 48 }}>
          {/* Text block */}
          <div style={{ textAlign: "center", maxWidth: 700 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 99, padding: "6px 14px", marginBottom: 24 }}>
              <WaIcon size={14} />
              <span style={{ color: "#c4b5fd", fontSize: 12, fontWeight: 600 }}>Integração nativa com WhatsApp Business</span>
            </div>

            <h1 style={{ color: "#fff", fontWeight: 900, fontSize: "clamp(32px, 7vw, 58px)", lineHeight: 1.1, letterSpacing: "-0.03em", margin: "0 0 20px" }}>
              Automatize seus<br />
              <span style={{ background: "linear-gradient(90deg, #a78bfa, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                agendamentos pelo
              </span>
              <br />WhatsApp
            </h1>

            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "clamp(15px, 2.5vw, 18px)", lineHeight: 1.65, margin: "0 0 36px", maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
              Clientes agendam sozinhos, você acompanha tudo pelo painel e economiza horas de atendimento todos os dias.
            </p>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <button onClick={() => navigate("/signup")}
                style={{ width: "100%", maxWidth: 360, height: 56, borderRadius: 16, border: "none", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", letterSpacing: "-0.01em", boxShadow: "0 8px 32px rgba(124,58,237,0.5)" }}
              >Começar grátis — sem cartão</button>
              <a href="#demo"
                onClick={(e) => { e.preventDefault(); scrollTo("demo"); }}
                style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 500, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}
              >
                <svg viewBox="0 0 20 20" style={{ width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 2 }}><circle cx="10" cy="10" r="8"/><polygon points="8,7 14,10 8,13" fill="currentColor" stroke="none"/></svg>
                Ver demonstração
              </a>
            </div>

            {/* Social proof */}
            <div style={{ marginTop: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <div style={{ display: "flex" }}>
                {["#7c3aed","#6d28d9","#5b21b6","#4c1d95","#2e1065"].map((bg, i) => (
                  <div key={i} style={{ width: 28, height: 28, borderRadius: "50%", background: bg, border: "2px solid rgba(255,255,255,0.2)", marginLeft: i ? -8 : 0 }} />
                ))}
              </div>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, margin: 0 }}>
                +200 negócios já usam o ReservaAI
              </p>
            </div>
          </div>

          {/* Phone mockup */}
          <div id="demo" style={{ display: "flex", justifyContent: "center" }}>
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section id="funcionalidades" style={{ padding: "80px 20px", background: "#fff" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p style={{ color: "#7c3aed", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Funcionalidades</p>
            <h2 style={{ color: "#111827", fontWeight: 900, fontSize: "clamp(26px, 5vw, 40px)", letterSpacing: "-0.03em", margin: "0 0 16px" }}>
              Tudo que você precisa.<br />Nada que você não precisa.
            </h2>
            <p style={{ color: "#6b7280", fontSize: 16, maxWidth: 480, margin: "0 auto" }}>
              Um sistema simples que funciona para barbearias, salões, clínicas e qualquer negócio de serviços.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 16 }}>
            {[
              { icon: "🗓", title: "Agendamento online 24/7", desc: "Seu link funciona a qualquer hora. O cliente agenda enquanto você dorme." },
              { icon: "💬", title: "Confirmação pelo WhatsApp", desc: "Mensagem automática de confirmação assim que o agendamento é feito." },
              { icon: "👥", title: "Clientes ilimitados", desc: "Sem limites. Cadastre todos os seus clientes e acompanhe o histórico." },
              { icon: "⏰", title: "Lembretes automáticos", desc: "Lembrete 24h antes do horário. Menos faltas, mais presença." },
              { icon: "📊", title: "Painel simples e bonito", desc: "Veja agendamentos, clientes e serviços em uma tela limpa e intuitiva." },
              { icon: "🕐", title: "Mais tempo livre", desc: "Pare de responder mensagens manualmente. Foque no seu trabalho." },
            ].map((b) => (
              <div key={b.title} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 20, padding: "24px", transition: "border-color 0.15s, box-shadow 0.15s", boxSizing: "border-box" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#c4b5fd"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 24px rgba(124,58,237,0.1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: 28, marginBottom: 14 }}>{b.icon}</div>
                <h3 style={{ color: "#111827", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>{b.title}</h3>
                <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="como-funciona" style={{ padding: "80px 20px", background: "#f9fafb" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p style={{ color: "#7c3aed", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Como funciona</p>
            <h2 style={{ color: "#111827", fontWeight: 900, fontSize: "clamp(26px, 5vw, 40px)", letterSpacing: "-0.03em", margin: 0 }}>
              Configure em 3 minutos
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))", gap: 24, position: "relative" }}>
            {[
              { n: "01", title: "Cadastre seus serviços", desc: "Adicione nome, preço e duração dos serviços que você oferece. Leva menos de 2 minutos." },
              { n: "02", title: "Compartilhe seu link", desc: "Cada conta tem um link exclusivo. Mande no WhatsApp, Instagram ou coloque na bio." },
              { n: "03", title: "Receba agendamentos", desc: "Clientes escolhem serviço, data e horário sozinhos. Você vê tudo no painel em tempo real." },
            ].map((s) => (
              <div key={s.n} style={{ position: "relative", background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 20, padding: "28px 24px 24px", boxSizing: "border-box" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#7c3aed", letterSpacing: "0.05em", marginBottom: 14, fontFeatureSettings: '"tnum"' }}>
                  PASSO {s.n}
                </div>
                <h3 style={{ color: "#111827", fontWeight: 800, fontSize: 18, margin: "0 0 10px", letterSpacing: "-0.02em" }}>{s.title}</h3>
                <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.65, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHATSAPP HIGHLIGHT ── */}
      <section style={{ padding: "80px 20px", background: "linear-gradient(135deg, #0f0528 0%, #1e0a4e 100%)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 300, height: 300, borderRadius: "50%", background: "rgba(37,211,102,0.1)", filter: "blur(60px)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: 48, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(37,211,102,0.15)", border: "1px solid rgba(37,211,102,0.3)", borderRadius: 99, padding: "6px 14px", marginBottom: 24 }}>
              <WaIcon size={14} />
              <span style={{ color: "#86efac", fontSize: 12, fontWeight: 600 }}>WhatsApp inteligente</span>
            </div>
            <h2 style={{ color: "#fff", fontWeight: 900, fontSize: "clamp(26px, 4.5vw, 38px)", letterSpacing: "-0.03em", margin: "0 0 16px" }}>
              Menos mensagens<br />manuais. Mais reservas.
            </h2>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, lineHeight: 1.7, margin: "0 0 32px" }}>
              Conecte seu WhatsApp Business e deixe o ReservaAI cuidar das confirmações, lembretes e respostas automáticas.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                "Resposta automática para novos agendamentos",
                "Lembrete 24h antes do horário marcado",
                "Confirmação de presença via mensagem",
                "Suporte ao cliente integrado ao painel",
              ].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(37,211,102,0.15)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg viewBox="0 0 16 16" style={{ width: 10, height: 10, fill: "none", stroke: "#34d399", strokeWidth: 2.5 }}><polyline points="3,8 6.5,11.5 13,5"/></svg>
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* WA chat bubble mockup */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { from: "client", text: "Olá! Quero agendar um corte de cabelo amanhã às 14h." },
              { from: "bot",    text: "✅ Agendado! Corte às 14h de amanhã com a Ana.\n\nVocê receberá um lembrete 24h antes. Até lá!" },
              { from: "client", text: "Perfeito, muito obrigado! 🙏" },
              { from: "bot",    text: "⏰ Lembrete: você tem um agendamento amanhã às 14h.\n\nAté logo!" },
            ].map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.from === "client" ? "flex-start" : "flex-end" }}>
                <div style={{
                  maxWidth: "78%", padding: "10px 14px", borderRadius: msg.from === "client" ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                  background: msg.from === "client" ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg,#25D366,#128C7E)",
                  color: "#fff", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-line",
                }}>
                  {msg.text}
                  {msg.from === "bot" && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4, textAlign: "right" }}>ReservaAI Bot ✓✓</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOR WHOM ── */}
      <section id="para-quem" style={{ padding: "80px 20px", background: "#fff" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ color: "#7c3aed", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Para quem é</p>
            <h2 style={{ color: "#111827", fontWeight: 900, fontSize: "clamp(26px, 5vw, 40px)", letterSpacing: "-0.03em", margin: "0 0 14px" }}>
              Para qualquer negócio de serviços
            </h2>
            <p style={{ color: "#6b7280", fontSize: 16, maxWidth: 440, margin: "0 auto" }}>
              Do solopreneur ao estúdio com equipe. Se você agenda, o ReservaAI funciona.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {[
              { icon: "✂️", label: "Barbearias" },
              { icon: "💅", label: "Salões de beleza" },
              { icon: "✨", label: "Estética" },
              { icon: "🩺", label: "Clínicas" },
              { icon: "🎨", label: "Tattoo & Piercing" },
              { icon: "💼", label: "Consultorias" },
              { icon: "🏋️", label: "Personal Trainer" },
              { icon: "🧘", label: "Yoga & Pilates" },
              { icon: "📸", label: "Fotografia" },
              { icon: "🐾", label: "Pet Shop" },
              { icon: "🦷", label: "Odontologia" },
              { icon: "🏠", label: "Pequenos negócios" },
            ].map((item) => (
              <div key={item.label} style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 12,
                padding: "10px 16px", fontSize: 14, fontWeight: 600, color: "#374151",
                transition: "border-color 0.15s, background 0.15s",
                cursor: "default",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#c4b5fd"; (e.currentTarget as HTMLDivElement).style.background = "#faf8ff"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLDivElement).style.background = "#f9fafb"; }}
              >
                <span>{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT DEMO ── */}
      <section style={{ padding: "80px 20px", background: "#f9fafb" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p style={{ color: "#7c3aed", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>O produto</p>
            <h2 style={{ color: "#111827", fontWeight: 900, fontSize: "clamp(26px, 5vw, 40px)", letterSpacing: "-0.03em", margin: 0 }}>
              Simples de usar. Poderoso por dentro.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))", gap: 14 }}>
            {[
              {
                title: "Dashboard", icon: "📊",
                lines: [
                  { label: "Agendamentos", value: "24", color: "#7c3aed" },
                  { label: "Serviços", value: "8", color: "#059669" },
                  { label: "Pendentes", value: "3", color: "#f59e0b" },
                ],
              },
              {
                title: "Serviços", icon: "📋",
                items: ["Corte masculino — R$45", "Barba — R$25", "Sobrancelha — R$20", "Progressiva — R$120"],
              },
              {
                title: "Clientes", icon: "👥",
                clients: ["Marcos Silva", "Julia Costa", "Pedro Alves", "Ana Beatriz"],
              },
              {
                title: "Link de agendamento", icon: "🔗",
                link: true,
              },
              {
                title: "WhatsApp", icon: "💬",
                wa: true,
              },
            ].map((card) => (
              <div key={card.title} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 20, padding: 20, boxSizing: "border-box" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 18 }}>{card.icon}</span>
                  <span style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>{card.title}</span>
                </div>
                {card.lines && card.lines.map((l) => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ color: "#9ca3af", fontSize: 12 }}>{l.label}</span>
                    <span style={{ color: l.color, fontWeight: 800, fontSize: 20 }}>{l.value}</span>
                  </div>
                ))}
                {card.items && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {card.items.map((item) => (
                      <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7c3aed", flexShrink: 0 }} />
                        <span style={{ color: "#374151", fontSize: 12 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
                {card.clients && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {card.clients.map((c) => (
                      <div key={c} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 8, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ color: "#7c3aed", fontSize: 10, fontWeight: 800 }}>{c.charAt(0)}</span>
                        </div>
                        <span style={{ color: "#374151", fontSize: 12, fontWeight: 500 }}>{c}</span>
                      </div>
                    ))}
                  </div>
                )}
                {card.link && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px" }}>
                      <span style={{ color: "#9ca3af", fontSize: 10 }}>reservaai.app/</span>
                      <span style={{ color: "#7c3aed", fontSize: 10, fontWeight: 700 }}>seu-negocio</span>
                    </div>
                    <div style={{ height: 32, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>Copiar link</span>
                    </div>
                  </div>
                )}
                {card.wa && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#25D366" }} />
                      <span style={{ color: "#374151", fontSize: 12, fontWeight: 600 }}>Conectado</span>
                    </div>
                    {["3 automações ativas","24 msgs enviadas hoje","0 faltas esta semana"].map((t) => (
                      <div key={t} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "6px 10px" }}>
                        <span style={{ color: "#14532d", fontSize: 11 }}>{t}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="precos" style={{ padding: "80px 20px", background: "#fff" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p style={{ color: "#7c3aed", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Preços</p>
            <h2 style={{ color: "#111827", fontWeight: 900, fontSize: "clamp(26px, 5vw, 40px)", letterSpacing: "-0.03em", margin: "0 0 14px" }}>
              Simples e transparente
            </h2>
            <p style={{ color: "#6b7280", fontSize: 16, margin: 0 }}>
              Comece grátis. Cancele quando quiser.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 16 }}>
            {[
              {
                id: "starter", name: "Starter", price: "Grátis", period: "7 dias de teste",
                highlight: false,
                features: ["Até 30 agendamentos/mês", "1 serviço", "Link de agendamento", "Painel básico"],
                ctaLabel: "Começar agora", ctaHref: "/signup",
              },
              {
                id: "pro", name: "Pro", price: "R$97", period: "/mês",
                highlight: true,
                badge: "Mais popular",
                features: ["Agendamentos ilimitados", "Serviços ilimitados", "WhatsApp automático", "Painel completo", "Lembretes automáticos", "Suporte prioritário"],
                ctaLabel: "Falar com suporte", ctaHref: SUPPORT_WA,
              },
              {
                id: "premium", name: "Premium", price: "R$197", period: "/mês",
                highlight: false,
                features: ["Tudo do Pro", "Múltiplos usuários", "Analytics avançado", "Automações ilimitadas", "Suporte VIP WhatsApp"],
                ctaLabel: "Falar com suporte", ctaHref: SUPPORT_WA,
              },
            ].map((plan) => (
              <div key={plan.id} style={{
                background: plan.highlight ? "linear-gradient(160deg, #1e0a4e, #2d1279)" : "#fff",
                border: plan.highlight ? "2px solid #7c3aed" : "1.5px solid #e5e7eb",
                borderRadius: 24, padding: "28px 24px 24px",
                boxShadow: plan.highlight ? "0 16px 48px rgba(124,58,237,0.25)" : "none",
                boxSizing: "border-box", position: "relative",
              }}>
                {plan.badge && (
                  <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#7c3aed", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 99 }}>
                    {plan.badge}
                  </div>
                )}
                <h3 style={{ color: plan.highlight ? "#fff" : "#111827", fontWeight: 800, fontSize: 20, margin: "0 0 4px" }}>{plan.name}</h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "12px 0 20px" }}>
                  <span style={{ color: plan.highlight ? "#fff" : "#111827", fontWeight: 900, fontSize: 36, letterSpacing: "-0.03em" }}>{plan.price}</span>
                  <span style={{ color: plan.highlight ? "rgba(255,255,255,0.6)" : "#9ca3af", fontSize: 14 }}>{plan.period}</span>
                </div>
                <div style={{ borderTop: `1px solid ${plan.highlight ? "rgba(255,255,255,0.1)" : "#f3f4f6"}`, paddingTop: 20, marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: plan.highlight ? "rgba(167,139,250,0.2)" : "#ecfdf5", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg viewBox="0 0 14 14" style={{ width: 9, height: 9, fill: "none", stroke: plan.highlight ? "#a78bfa" : "#059669", strokeWidth: 2.5 }}>
                          <polyline points="2,7 5.5,10.5 12,3.5" />
                        </svg>
                      </div>
                      <span style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "#374151", fontSize: 13 }}>{f}</span>
                    </div>
                  ))}
                </div>
                {plan.ctaHref.startsWith("/") ? (
                  <button onClick={() => navigate(plan.ctaHref)}
                    style={{ width: "100%", height: 48, borderRadius: 14, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, background: plan.highlight ? "#fff" : "linear-gradient(135deg,#7c3aed,#6d28d9)", color: plan.highlight ? "#7c3aed" : "#fff" }}
                  >{plan.ctaLabel}</button>
                ) : (
                  <a href={plan.ctaHref} target="_blank" rel="noreferrer"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 48, borderRadius: 14, textDecoration: "none", fontWeight: 700, fontSize: 14, background: plan.highlight ? "#fff" : "#f9fafb", color: plan.highlight ? "#7c3aed" : "#374151", border: plan.highlight ? "none" : "1.5px solid #e5e7eb", boxSizing: "border-box" }}
                  >
                    <WaIcon size={16} />
                    {plan.ctaLabel}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: "80px 20px", background: "linear-gradient(135deg, #0f0528 0%, #1e0a4e 100%)", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ color: "#fff", fontWeight: 900, fontSize: "clamp(28px, 5vw, 44px)", letterSpacing: "-0.03em", margin: "0 0 18px" }}>
            Comece hoje seu atendimento automático
          </h2>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 17, lineHeight: 1.65, margin: "0 0 40px" }}>
            Teste grátis e veja seus clientes agendando sozinhos.
          </p>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <button onClick={() => navigate("/signup")}
              style={{ width: "100%", maxWidth: 360, height: 56, borderRadius: 16, border: "none", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 32px rgba(124,58,237,0.5)" }}
            >Criar conta grátis</button>
            <a href={SIGNUP_WA} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.6)", fontSize: 14, textDecoration: "none" }}
            >
              <WaIcon size={15} />
              Ou fale com a gente pelo WhatsApp
            </a>
          </div>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 28 }}>
            Sem cartão de crédito. Cancele quando quiser.
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#060213", padding: "40px 20px 32px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 32, marginBottom: 40 }}>
            {/* Brand */}
            <div style={{ maxWidth: 280 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>R</span>
                </div>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>ReservaAI</span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Agendamentos inteligentes para negócios modernos.
              </p>
            </div>

            {/* Links */}
            <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
              <div>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px" }}>Produto</p>
                {[["funcionalidades","Funcionalidades"],["como-funciona","Como funciona"],["precos","Preços"]].map(([id,label]) => (
                  <button key={id} onClick={() => scrollTo(id)}
                    style={{ display: "block", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.45)", fontSize: 13, padding: "4px 0", textAlign: "left" }}
                  >{label}</button>
                ))}
              </div>
              <div>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px" }}>Legal</p>
                <a href="/terms"    style={{ display: "block", color: "rgba(255,255,255,0.45)", fontSize: 13, textDecoration: "none", padding: "4px 0" }}>Termos de uso</a>
                <a href="/privacy"  style={{ display: "block", color: "rgba(255,255,255,0.45)", fontSize: 13, textDecoration: "none", padding: "4px 0" }}>Privacidade</a>
              </div>
              <div>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px" }}>Contato</p>
                <a href={SUPPORT_WA} target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 6, color: "#34d399", fontSize: 13, textDecoration: "none", padding: "4px 0" }}
                >
                  <WaIcon size={13} />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 24, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, margin: 0 }}>
              © {new Date().getFullYear()} ReservaAI · Todos os direitos reservados.
            </p>
            <button onClick={() => navigate("/signup")}
              style={{ height: 36, padding: "0 16px", borderRadius: 10, border: "1px solid rgba(124,58,237,0.4)", background: "rgba(124,58,237,0.1)", color: "#c4b5fd", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >Criar conta grátis →</button>
          </div>
        </div>
      </footer>

    </div>
  );
}
