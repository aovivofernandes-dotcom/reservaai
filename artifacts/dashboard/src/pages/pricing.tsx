import { Check, MessageCircle, Calendar, Users, Headphones, Zap, Shield } from "lucide-react";

const features = [
  { icon: MessageCircle, text: "Integração WhatsApp para agendamentos automáticos" },
  { icon: Calendar, text: "Painel web com agenda e gestão de clientes" },
  { icon: Users, text: "Cadastro e histórico de clientes" },
  { icon: Headphones, text: "Suporte via WhatsApp em português" },
  { icon: Zap, text: "7 dias de teste grátis, sem cartão" },
  { icon: Shield, text: "Cancele quando quiser, sem fidelidade" },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <a href="/signup" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-sm shadow-violet-200">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <span className="text-gray-900 font-semibold text-base tracking-tight">ReservaAI</span>
        </a>
        <div className="flex items-center gap-3">
          <a href="/business/login" className="text-gray-500 text-sm hover:text-gray-700 transition-colors">
            Entrar
          </a>
          <a
            href="/signup"
            className="inline-flex items-center px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
          >
            Começar grátis
          </a>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 py-12">
        {/* Hero */}
        <div className="text-center max-w-lg mb-10">
          <span className="inline-block bg-violet-50 text-violet-700 text-xs font-semibold px-3.5 py-1.5 rounded-full border border-violet-100 uppercase tracking-wide mb-4">
            Plano único · Sem surpresas
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-3">
            Um plano simples.<br />Tudo que você precisa.
          </h1>
          <p className="text-gray-500 text-base leading-relaxed">
            Teste por 7 dias grátis. Decida só depois de ver o resultado.
          </p>
        </div>

        {/* Pricing card */}
        <div className="w-full max-w-sm">
          <div className="bg-white border-2 border-violet-500 rounded-2xl p-7 shadow-lg shadow-violet-100 relative">
            {/* Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="bg-violet-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full whitespace-nowrap shadow-sm">
                Mais popular
              </span>
            </div>

            {/* Plan name */}
            <div className="flex items-center gap-3 mb-5 mt-1">
              <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-gray-900 font-bold text-lg leading-tight">ReservaAI Pro</h2>
                <p className="text-gray-500 text-xs">Para negócios em crescimento</p>
              </div>
            </div>

            {/* Price */}
            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-gray-500 text-sm">R$</span>
                <span className="text-5xl font-bold text-gray-900">97</span>
                <span className="text-gray-400 text-sm">/mês</span>
              </div>
              <p className="text-gray-400 text-xs mt-1">após 7 dias de teste grátis</p>
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-7">
              {features.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-600" />
                  </div>
                  <span className="text-gray-700 text-sm leading-snug">{text}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <a
              href="/signup"
              className="block w-full text-center py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold text-sm shadow-md shadow-violet-200 transition-all active:scale-[0.98]"
            >
              Começar teste grátis
            </a>
            <p className="text-center text-gray-400 text-xs mt-3">
              Sem cartão de crédito · Cancele quando quiser
            </p>
          </div>
        </div>

        {/* Trust section */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
          {[
            { title: "Sem fidelidade", desc: "Cancele quando quiser, sem multa ou aviso prévio." },
            { title: "Pagamento seguro", desc: "PIX ou cartão de crédito via Mercado Pago." },
            { title: "Suporte em português", desc: "Atendimento por WhatsApp direto com nossa equipe." },
          ].map((item) => (
            <div key={item.title} className="text-center p-5 rounded-xl bg-gray-50 border border-gray-100">
              <p className="font-semibold text-gray-900 text-sm mb-1">{item.title}</p>
              <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-10 text-center text-xs text-gray-400 max-w-sm leading-relaxed">
          Preços em Reais (BRL). Cobranças mensais via Mercado Pago.{" "}
          Funcionalidades sujeitas a atualização sem aviso prévio.{" "}
          <a href="/terms" className="underline hover:text-gray-600">Termos de uso</a>
          {" · "}
          <a href="/privacy" className="underline hover:text-gray-600">Privacidade</a>
        </p>
      </div>
    </div>
  );
}
