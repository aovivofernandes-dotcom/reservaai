import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Lock,
  Phone,
  ArrowRight,
  Loader2,
  MessageCircle,
  CalendarCheck,
  TrendingUp,
  ShieldCheck,
  Gift,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const signupSchema = z.object({
  businessName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  whatsapp: z.string().min(7, "Digite um número de WhatsApp válido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type SignupForm = z.infer<typeof signupSchema>;

const benefits = [
  { icon: MessageCircle, label: "Confirmação automática", color: "text-violet-600", bg: "bg-violet-50" },
  { icon: CalendarCheck, label: "Agenda inteligente", color: "text-blue-600", bg: "bg-blue-50" },
  { icon: TrendingUp, label: "Mais clientes e vendas", color: "text-emerald-600", bg: "bg-emerald-50" },
  { icon: ShieldCheck, label: "Seguro e confiável", color: "text-amber-600", bg: "bg-amber-50" },
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-red-500 text-[11px] mt-1 leading-tight">{message}</p>;
}

export default function SignupPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    mode: "onTouched",
  });

  async function onSubmit(data: SignupForm) {
    setLoading(true);
    try {
      const res = await fetch("/api/public/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        toast({
          title: res.status === 409 ? "WhatsApp já cadastrado" : "Erro no cadastro",
          description:
            res.status === 409
              ? "Já existe uma conta com este número. Faça login."
              : (json.error as string) ?? "Algo deu errado. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      localStorage.setItem("business_token", json.token as string);
      localStorage.setItem("business_user", JSON.stringify(json.user));
      localStorage.setItem("business_tenant", JSON.stringify(json.tenant));

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
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-start px-5 pt-8 pb-12 max-w-[480px] mx-auto w-full">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-md shadow-violet-200">
            <span className="text-white text-[15px] font-bold tracking-tight">R</span>
          </div>
          <span className="text-gray-900 font-semibold text-[1.1rem] tracking-tight">ReservaAI</span>
        </div>

        {/* Badge */}
        <div className="flex justify-center mb-5">
          <span className="inline-flex items-center gap-1.5 bg-violet-50 text-violet-700 text-[11px] font-semibold px-3.5 py-1.5 rounded-full border border-violet-100 tracking-wide uppercase">
            <MessageCircle className="w-3 h-3" />
            Agendamentos automáticos via WhatsApp
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-[2rem] sm:text-[2.25rem] leading-[1.12] font-bold text-gray-900 text-center mb-3 tracking-tight">
          Mais agendamentos.<br />
          Menos trabalho.
        </h1>

        <p className="text-gray-500 text-center text-[0.9375rem] leading-relaxed mb-7 px-2">
          Crie sua conta em segundos e explore o painel gratuitamente por 7 dias.
        </p>

        {/* Benefits 2×2 */}
        <div className="grid grid-cols-2 gap-2.5 w-full mb-5">
          {benefits.map(({ icon: Icon, label, color, bg }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100"
            >
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-[17px] h-[17px] ${color}`} />
              </div>
              <span className="text-gray-700 text-[12px] font-medium leading-tight">{label}</span>
            </div>
          ))}
        </div>

        {/* Trial cards */}
        <div className="flex gap-2.5 w-full mb-7">
          <div className="flex-1 flex items-center gap-2.5 bg-violet-50 rounded-xl p-3.5 border border-violet-100">
            <Gift className="w-4 h-4 text-violet-600 shrink-0" />
            <div>
              <p className="text-gray-900 text-[12px] font-semibold leading-tight">7 dias grátis</p>
              <p className="text-gray-400 text-[11px] mt-0.5">Sem cartão de crédito</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-2.5 bg-emerald-50 rounded-xl p-3.5 border border-emerald-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="text-gray-900 text-[12px] font-semibold leading-tight">Sem risco</p>
              <p className="text-gray-400 text-[11px] mt-0.5">Cancele quando quiser</p>
            </div>
          </div>
        </div>

        {/* Form card */}
        <div className="w-full bg-white border border-gray-200 rounded-2xl p-5 shadow-sm shadow-gray-100 mb-4">
          <p className="text-gray-900 font-semibold text-[15px] mb-4">Crie sua conta grátis</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <Label className={labelCls}>
                Nome do negócio <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  {...register("businessName")}
                  placeholder="Minha Empresa"
                  className={`${inputCls} pl-9`}
                  autoComplete="organization"
                />
              </div>
              <FieldError message={errors.businessName?.message} />
            </div>

            <div>
              <Label className={labelCls}>
                WhatsApp <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  {...register("whatsapp")}
                  placeholder="+55 92 99999-9999"
                  className={`${inputCls} pl-9`}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <FieldError message={errors.whatsapp?.message} />
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
                  placeholder="Mínimo 6 caracteres"
                  className={`${inputCls} pl-9`}
                  autoComplete="new-password"
                />
              </div>
              <FieldError message={errors.password?.message} />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm font-semibold shadow-md shadow-violet-200 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Criando conta…
                </>
              ) : (
                <>
                  Acessar painel grátis
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-gray-400 text-sm text-center">
          Já tem uma conta?{" "}
          <a
            href="/business/login"
            className="text-violet-600 font-semibold hover:text-violet-700 transition-colors"
          >
            Entrar
          </a>
        </p>

        <div className="flex items-center gap-1.5 mt-3 text-gray-300 text-[11px]">
          <Lock className="w-3 h-3" />
          <span>Seus dados estão protegidos com segurança 256-bit</span>
        </div>

        <p className="text-gray-300 text-[11px] text-center mt-2 px-4 leading-relaxed">
          Ao criar sua conta, você concorda com os{" "}
          <a href="/terms" className="underline hover:text-gray-500 transition-colors">Termos de Uso</a>
          {" "}e a{" "}
          <a href="/privacy" className="underline hover:text-gray-500 transition-colors">Política de Privacidade</a>.
        </p>
      </div>
    </div>
  );
}
