export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <a href="/signup" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center">
            <span className="text-white font-bold text-xs">R</span>
          </div>
          <span className="text-gray-900 font-semibold text-sm">ReservaAI</span>
        </a>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Termos de Uso</h1>
        <p className="text-gray-400 text-sm mb-8">Última atualização: maio de 2025</p>

        <div className="space-y-7 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">1. Aceitação dos termos</h2>
            <p>
              Ao criar uma conta e utilizar o ReservaAI, você concorda com estes Termos de Uso.
              Se não concordar com qualquer parte, não utilize o serviço.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">2. Descrição do serviço</h2>
            <p>
              O ReservaAI é uma plataforma web de gerenciamento de agendamentos com integração ao WhatsApp.
              Oferecemos painel de controle, cadastro de clientes, agenda e ferramentas de automação para pequenos e médios negócios.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">3. Funcionalidades sujeitas a atualização</h2>
            <p>
              O ReservaAI está em desenvolvimento ativo. Funcionalidades podem ser adicionadas, alteradas ou descontinuadas
              sem aviso prévio. Não garantimos disponibilidade contínua de recursos específicos.
              A integração com WhatsApp depende de disponibilidade técnica de terceiros.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">4. Conta de usuário</h2>
            <p>
              Você é responsável por manter sua senha segura e por todas as atividades realizadas com sua conta.
              Não compartilhe suas credenciais com terceiros. Cada conta é individual e intransferível.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">5. Planos e pagamentos</h2>
            <p>
              Oferecemos um período de teste gratuito de 7 dias. Após o período de teste, é necessário assinar o plano
              ReservaAI Pro (R$ 97/mês) para continuar utilizando o serviço. As cobranças são processadas via Mercado Pago
              e podem ser canceladas a qualquer momento sem multa.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">6. Cancelamento</h2>
            <p>
              Você pode cancelar sua assinatura a qualquer momento pelo painel ou entrando em contato com o suporte.
              Não há reembolso proporcional de períodos parciais já cobrados, exceto quando exigido por lei.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">7. Uso adequado</h2>
            <p>
              É proibido usar o ReservaAI para enviar spam, conteúdo ilegal, ou qualquer atividade que viole a legislação
              brasileira. Nos reservamos o direito de suspender contas que violem estas regras.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">8. Limitação de responsabilidade</h2>
            <p>
              O ReservaAI não se responsabiliza por perdas de dados, interrupções de serviço, ou danos indiretos
              decorrentes do uso da plataforma. O serviço é fornecido "como está", sem garantias explícitas de
              disponibilidade ou adequação a finalidade específica.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">9. Alterações nos termos</h2>
            <p>
              Podemos atualizar estes termos a qualquer momento. Usuários serão notificados por e-mail ou pelo painel
              em caso de mudanças relevantes. O uso continuado do serviço após alterações implica aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">10. Contato</h2>
            <p>
              Dúvidas sobre estes termos? Entre em contato pelo WhatsApp ou pelo e-mail exibido no painel de suporte.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
          <a href="/privacy" className="hover:text-gray-600 underline">Política de Privacidade</a>
          <a href="/signup" className="hover:text-gray-600 underline">Voltar para o início</a>
        </div>
      </div>
    </div>
  );
}
