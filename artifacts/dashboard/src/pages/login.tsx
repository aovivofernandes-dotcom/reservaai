import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const loginMutation = useAdminLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    loginMutation.mutate(
      { data: { password } },
      {
        onSuccess: (result) => {
          login(result.token);
          setLocation("/");
        },
        onError: () => {
          setError("Senha incorreta. Tente novamente.");
        },
      },
    );
  };

  return (
    <div
      data-testid="page-login"
      className="min-h-[100dvh] flex items-center justify-center bg-white px-5"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="w-full max-w-[360px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center mb-4 shadow-md shadow-violet-200">
            <span className="text-white text-xl font-bold">R</span>
          </div>
          <h1 className="text-[1.25rem] font-semibold text-gray-900 tracking-tight">
            Acesso Administrativo
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Entre para acessar o painel de controle
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[13px] font-medium text-gray-700">
              Senha
            </Label>
            <Input
              id="password"
              data-testid="input-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha de administrador"
              autoFocus
              required
              className="h-11 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus-visible:ring-1 focus-visible:ring-violet-400 rounded-xl"
            />
          </div>

          {error && (
            <p data-testid="text-login-error" className="text-sm text-red-500">
              {error}
            </p>
          )}

          <button
            data-testid="button-login"
            type="submit"
            disabled={loginMutation.isPending || !password}
            className="w-full h-11 flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm font-semibold shadow-md shadow-violet-200 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {loginMutation.isPending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
