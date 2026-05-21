import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Phone, Lock, Loader2, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  whatsapp: z.string().min(7, "Digite um número de WhatsApp válido"),
  password: z.string().min(1, "Digite sua senha"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function BusinessLoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
    setLoading(true);
    try {
      const sanitizedPhone = data.whatsapp.replace(/\D/g, "");
      const email = `${sanitizedPhone}@reservaai.app`;

      const res = await fetch("/api/auth/business-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: data.password }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast({
          title: "Erro de acesso",
          description:
            json.error === "Invalid credentials"
              ? "Número de WhatsApp ou senha incorretos."
              : "Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      localStorage.setItem("business_token", json.token as string);
      localStorage.setItem("business_user", JSON.stringify(json.user));

      try {
        const dashRes = await fetch("/api/business/dashboard", {
          headers: { Authorization: `Bearer ${json.token as string}` },
        });
        if (dashRes.ok) {
          const dash = await dashRes.json();
          localStorage.setItem("business_tenant", JSON.stringify((dash as { tenant: unknown }).tenant));
        }
      } catch {
        // non-fatal
      }

      toast({ title: "Bem-vindo de volta 👋", duration: 2000 });
      navigate("/business/dashboard");
    } catch {
      toast({
        title: "Erro de conexão",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus-visible:ring-1 focus-visible:ring-violet-400 h-11 text-sm rounded-xl";
  const labelCls = "text-gray-700 text-[13px] font-medium mb-1.5 block";

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-md shadow-violet-200">
            <span className="text-white text-[15px] font-bold">R</span>
          </div>
          <span className="text-gray-900 font-semibold text-[1.1rem] tracking-tight">ReservaAI</span>
        </div>
        <h1 className="text-[1.375rem] font-bold text-gray-900 tracking-tight text-center">
          Entrar na sua conta
        </h1>
        <p className="text-gray-500 text-sm mt-1 text-center">
          Acesse o painel da sua empresa
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-[400px]">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <Label className={labelCls}>
                WhatsApp <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  {...register("whatsapp")}
                  inputMode="tel"
                  placeholder="+55 92 99999-9999"
                  className={`${inputCls} pl-9`}
                  autoComplete="tel"
                />
              </div>
              {errors.whatsapp && (
                <p className="text-red-500 text-[11px] mt-1">{errors.whatsapp.message}</p>
              )}
            </div>

            <div>
              <Label className={labelCls}>
                Senha <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  {...register("password")}
                  type="password"
                  placeholder="Sua senha"
                  className={`${inputCls} pl-9`}
                  autoComplete="current-password"
                />
              </div>
              {errors.password && (
                <p className="text-red-500 text-[11px] mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 h-11 mt-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm font-semibold shadow-md shadow-violet-200 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 text-sm mt-5">
          Não tem uma conta?{" "}
          <a href="/signup" className="text-violet-600 font-semibold hover:text-violet-700 transition-colors">
            Criar conta grátis
          </a>
        </p>
      </div>
    </div>
  );
}
