import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";

// Admin pages
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import TenantsPage from "@/pages/tenants";
import TenantDetailPage from "@/pages/tenant-detail";
import SubscriptionsPage from "@/pages/subscriptions";
import WhatsappPage from "@/pages/whatsapp";
import OnboardPage from "@/pages/onboard";

// Landing page
import LandingPage from "@/pages/landing";

// Public / sign-up flow
import SignupPage from "@/pages/signup";
import BusinessLoginPage from "@/pages/business-login";
import OnboardingPage from "@/pages/onboarding";
import WhatsAppSetupPage from "@/pages/whatsapp-setup";
import PricingPage from "@/pages/pricing";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";

// Business owner panel
import BusinessDashboardPage from "@/pages/business-dashboard";
import BusinessConversationsPage from "@/pages/business-conversations";
import BusinessClientsPage from "@/pages/business-clients";
import BusinessAutomationPage from "@/pages/business-automation";
import BusinessSettingsPage from "@/pages/business-settings";
import BusinessServicesPage from "@/pages/business-services";

// Public booking
import PublicBookingPage from "@/pages/public-booking";

import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AppRoutes() {
  useEffect(() => {
    setAuthTokenGetter(() => {
      return localStorage.getItem("business_token") ?? localStorage.getItem("admin_token");
    });
  }, []);

  return (
    <Switch>
      {/* ── Public / sign-up ── */}
      <Route path="/signup" component={SignupPage} />
      <Route path="/business/login" component={BusinessLoginPage} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/whatsapp/setup" component={WhatsAppSetupPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />

      {/* ── Business owner panel ── */}
      <Route path="/business/dashboard" component={BusinessDashboardPage} />
      <Route path="/business/conversations" component={BusinessConversationsPage} />
      <Route path="/business/clients" component={BusinessClientsPage} />
      <Route path="/business/automation" component={BusinessAutomationPage} />
      <Route path="/business/settings" component={BusinessSettingsPage} />
      <Route path="/business/services" component={BusinessServicesPage} />

      {/* ── Admin / super-admin ── */}
      <Route path="/admin" component={DashboardPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/tenants/:id" component={TenantDetailPage} />
      <Route path="/tenants" component={TenantsPage} />
      <Route path="/subscriptions" component={SubscriptionsPage} />
      <Route path="/whatsapp" component={WhatsappPage} />
      <Route path="/super-admin" component={DashboardPage} />
      <Route path="/" component={LandingPage} />

      {/* ── Public customer onboarding form ── */}
      <Route path="/onboard/:slug" component={OnboardPage} />

      {/* ── Public booking page (must be last — catch-all by slug) ── */}
      <Route path="/:slug" component={PublicBookingPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base="">
          <AppRoutes />
        </WouterRouter>
        <Toaster />
        <SonnerToaster position="top-center" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
