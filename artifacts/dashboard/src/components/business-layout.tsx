import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  MessageCircle,
  Users,
  LayoutGrid,
  Settings,
  LogOut,
  Zap,
} from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

const NAV: NavItem[] = [
  { label: "Painel",      icon: LayoutDashboard, path: "/business/dashboard" },
  { label: "Conversas",  icon: MessageCircle,   path: "/business/conversations" },
  { label: "Clientes",   icon: Users,           path: "/business/clients" },
  { label: "Serviços",   icon: LayoutGrid,      path: "/business/services" },
  { label: "Automação",  icon: Zap,             path: "/business/automation" },
  { label: "Config.",    icon: Settings,        path: "/business/settings" },
];

interface Props {
  children: React.ReactNode;
  title?: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("business_token") ?? "";
  return { Authorization: `Bearer ${token}` };
}

export function BusinessLayout({ children, title }: Props) {
  const [location, navigate] = useLocation();

  const tenantRaw = localStorage.getItem("business_tenant");
  const tenant: { name: string; slug: string } | null = tenantRaw
    ? (JSON.parse(tenantRaw) as { name: string; slug: string })
    : null;

  useEffect(() => {
    const token = localStorage.getItem("business_token");
    if (!token) navigate("/signup");
  }, []);

  function logout() {
    localStorage.removeItem("business_token");
    localStorage.removeItem("business_user");
    localStorage.removeItem("business_tenant");
    navigate("/signup");
  }

  function isActive(path: string) {
    return location === path || location.startsWith(path + "/");
  }

  /*
   * ─── Layout strategy ────────────────────────────────────────────────────
   *
   * MOBILE (< md):
   *   position: fixed; inset: 0  ← entire app occupies viewport, never shifts
   *   ┌────────────────────────┐
   *   │  Top bar (shrink-0)    │  ← sticky, not pushed by keyboard
   *   ├────────────────────────┤
   *   │  Main content          │  ← overflow-y: auto, the ONLY scrollable area
   *   │  (flex-1, min-h: 0)    │
   *   ├────────────────────────┤
   *   │  Bottom nav (shrink-0) │  ← part of flex, NOT position:fixed
   *   └────────────────────────┘
   *
   * DESKTOP (≥ md):
   *   ┌──────┬─────────────────┐
   *   │ Side │  Main content   │
   *   │ bar  │  (scrollable)   │
   *   └──────┴─────────────────┘
   *
   * Why this fixes Safari iOS:
   *  • No page-level scroll → no bounce / drift / horizontal shift
   *  • Bottom nav is flow-positioned → no fixed-element misalignment
   *  • Keyboard overlays content, doesn't resize the layout root
   *  • Safe-area is applied exactly where needed (top bar, bottom nav)
   * ────────────────────────────────────────────────────────────────────── */

  return (
    <>
      {/* ── MOBILE layout ── */}
      <div
        className="md:hidden"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#f9fafb",
          /* willChange instead of transform — avoids creating a new containing block
             for child position:fixed elements on Safari */
          willChange: "transform",
        }}
      >
        {/* Mobile top bar — logout removed; use Settings > Conta > Sair */}
        <header
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            background: "#ffffff",
            borderBottom: "1px solid #e5e7eb",
            /* single padding declaration avoids Safari conflict */
            padding: "12px 16px",
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 1px 4px rgba(124,58,237,0.3)",
              }}
            >
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>R</span>
            </div>
            <span
              style={{
                color: "#111827",
                fontSize: 15,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title ?? tenant?.name ?? "ReservaAI"}
            </span>
          </div>
        </header>

        {/* Scrollable content — the ONLY scroll zone */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            minHeight: 0,           /* critical for flex shrink in Safari */
            width: "100%",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </main>

        {/* Mobile bottom nav — part of flex column, never "fixed" */}
        <nav
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "stretch",
            background: "#ffffff",
            borderTop: "1px solid #e5e7eb",
            boxShadow: "0 -2px 16px rgba(0,0,0,0.06)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            width: "100%",
            height: "calc(56px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {NAV.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 0",
                  WebkitTapHighlightColor: "transparent",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 24,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: active ? "#ede9fe" : "transparent",
                    transition: "background 0.15s",
                  }}
                >
                  <Icon
                    style={{
                      width: 21,
                      height: 21,
                      color: active ? "#6d28d9" : "#9ca3af",
                      transition: "color 0.15s",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: active ? "#6d28d9" : "#9ca3af",
                    lineHeight: 1,
                    transition: "color 0.15s",
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── DESKTOP layout ── */}
      <div
        className="hidden md:flex"
        style={{
          minHeight: "100dvh",
          width: "100%",
          overflow: "hidden",
          background: "#f9fafb",
        }}
      >
        {/* Desktop sidebar */}
        <aside
          style={{
            width: 224,
            flexShrink: 0,
            background: "#ffffff",
            borderRight: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            height: "100dvh",
            position: "sticky",
            top: 0,
          }}
        >
          <div
            style={{
              padding: "20px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>R</span>
              </div>
              <span style={{ color: "#111827", fontWeight: 600, fontSize: 14 }}>
                ReservaAI
              </span>
            </div>
            {tenant && (
              <p
                style={{
                  color: "#9ca3af",
                  fontSize: 11,
                  marginTop: 6,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {tenant.name}
              </p>
            )}
          </div>

          <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
            {NAV.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    color: active ? "#6d28d9" : "#4b5563",
                    background: active ? "#ede9fe" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    marginBottom: 2,
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  <Icon
                    style={{
                      width: 16,
                      height: 16,
                      flexShrink: 0,
                      color: active ? "#7c3aed" : "#9ca3af",
                    }}
                  />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div style={{ padding: "12px 8px", borderTop: "1px solid #e5e7eb" }}>
            <button
              onClick={logout}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 500,
                color: "#6b7280",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <LogOut style={{ width: 16, height: 16, color: "#9ca3af", flexShrink: 0 }} />
              Sair
            </button>
          </div>
        </aside>

        {/* Desktop main content */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            overflowX: "hidden",
            overflowY: "auto",
            minHeight: "100dvh",
          }}
        >
          {children}
        </main>
      </div>
    </>
  );
}

export { getAuthHeaders };
