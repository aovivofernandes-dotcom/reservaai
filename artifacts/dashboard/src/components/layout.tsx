import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  MessageCircle,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Settings2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Painel", icon: LayoutDashboard, testId: "dashboard" },
  { href: "/tenants", label: "Empresas", icon: Building2, testId: "tenants" },
  { href: "/subscriptions", label: "Assinaturas", icon: CreditCard, testId: "subscriptions" },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, testId: "whatsapp" },
  { href: "/whatsapp/setup", label: "Config. API", icon: Settings2, testId: "whatsapp-setup" },
];

function ReservaLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? "w-6 h-6 rounded-md text-xs" : "w-8 h-8 rounded-lg text-sm";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${iconSize} bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shrink-0 shadow-sm`}>
        <span className="text-white font-bold">R</span>
      </div>
      <span className="font-semibold text-[0.9375rem] tracking-tight text-foreground">ReservaAI</span>
    </div>
  );
}

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const [location] = useLocation();
  const { logout } = useAuth();

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <ReservaLogo />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, testId }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${testId}`}
              onClick={onNav}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
              )}
            >
              <Icon size={15} strokeWidth={1.8} className="shrink-0" />
              {label}
              {active && <ChevronRight size={13} className="ml-auto opacity-40" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          data-testid="button-logout"
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogOut size={15} strokeWidth={1.8} className="shrink-0" />
          Sair
        </button>
      </div>
    </div>
  );
}

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] bg-background">
      {/* Desktop sidebar */}
      <aside
        data-testid="sidebar"
        className="hidden md:flex md:w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0"
      >
        <SidebarContent />
      </aside>

      {/* Mobile backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[80vw] max-w-[300px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
          "transform transition-transform duration-200 ease-in-out md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <button
          onClick={() => setDrawerOpen(false)}
          aria-label="Fechar menu"
          className="absolute top-3 right-3 p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors"
        >
          <X size={16} />
        </button>
        <SidebarContent onNav={() => setDrawerOpen(false)} />
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
            className="p-2 -ml-1 rounded-lg hover:bg-accent transition-colors"
          >
            <Menu size={18} />
          </button>
          <ReservaLogo size="sm" />
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  return <>{children}</>;
}
