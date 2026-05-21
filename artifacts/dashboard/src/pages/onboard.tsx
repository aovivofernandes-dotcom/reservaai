import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetPublicTenant,
  getGetPublicTenantQueryKey,
  useSubmitOnboarding,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

interface FormState {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  industry: string;
  notes: string;
}

const initial: FormState = {
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  industry: "",
  notes: "",
};

export default function OnboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<FormState>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: tenant, isLoading: tenantLoading, isError: tenantError } =
    useGetPublicTenant(slug, {
      query: { enabled: !!slug, queryKey: getGetPublicTenantQueryKey(slug) },
    });

  const submitMutation = useSubmitOnboarding();

  const update = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    submitMutation.mutate(
      {
        slug,
        data: {
          businessName: form.businessName,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          address: form.address || undefined,
          industry: form.industry || undefined,
          notes: form.notes || undefined,
        },
      },
      {
        onSuccess: () => setSubmitted(true),
        onError: () => setError("Algo deu errado. Tente novamente."),
      },
    );
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (tenantError || !tenant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div data-testid="text-tenant-not-found" className="text-center">
          <h1 className="text-xl font-semibold text-foreground">Não encontrado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este link de onboarding é inválido ou expirou.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div data-testid="text-submission-success" className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Cadastro enviado!</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Seu cadastro foi recebido. A equipe da{" "}
            <strong>{tenant.name}</strong> vai analisá-lo e entrar em contato.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="page-onboard"
      className="min-h-screen bg-background py-12 px-6"
    >
      <div className="max-w-lg mx-auto">
        {/* Cabeçalho */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded bg-primary mb-4">
            <span className="text-primary-foreground text-sm font-bold">
              {tenant.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Cadastre-se em {tenant.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha seus dados para começar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="businessName">Nome do negócio *</Label>
              <Input
                id="businessName"
                data-testid="input-business-name"
                value={form.businessName}
                onChange={update("businessName")}
                required
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="contactName">Seu nome completo *</Label>
              <Input
                id="contactName"
                data-testid="input-contact-name"
                value={form.contactName}
                onChange={update("contactName")}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                data-testid="input-email"
                type="email"
                value={form.email}
                onChange={update("email")}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone *</Label>
              <Input
                id="phone"
                data-testid="input-phone"
                value={form.phone}
                onChange={update("phone")}
                required
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="industry">Segmento</Label>
              <Input
                id="industry"
                data-testid="input-industry"
                value={form.industry}
                onChange={update("industry")}
                placeholder="Ex: Varejo, Saúde, Tecnologia"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                data-testid="input-address"
                value={form.address}
                onChange={update("address")}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                data-testid="input-notes"
                value={form.notes}
                onChange={update("notes")}
                rows={3}
                placeholder="Algo mais que devemos saber..."
              />
            </div>
          </div>

          {error && (
            <p data-testid="text-submit-error" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            data-testid="button-submit-onboard"
            type="submit"
            className="w-full"
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? "Enviando..." : "Enviar Cadastro"}
          </Button>
        </form>
      </div>
    </div>
  );
}
