export default function PrivacyPage() {
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
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Política de Privacidade</h1>
        <p className="text-gray-400 text-sm mb-8">Última atualização: maio de 2025</p>

        <div className="space-y-7 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">1. Informações coletadas</h2>
            <p>Coletamos as seguintes informações ao criar sua conta e usar o serviço:</p>
            <ul className="mt-2 space-y-1.5 list-disc list-inside text-gray-600">
              <li>Nome do negócio</li>
              <li>Número de WhatsApp (usado como identificador de conta)</li>
              <li>Dados dos seus clientes cadastrados na plataforma</li>
              <li>Informações de uso e navegação (logs de acesso)</li>
              <li>Dados de pagamento (processados pelo Mercado Pago — não armazenamos dados de cartão)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">2. Como usamos suas informações</h2>
            <p>Suas informações são usadas exclusivamente para:</p>
            <ul className="mt-2 space-y-1.5 list-disc list-inside text-gray-600">
              <li>Operar e melhorar o serviço ReservaAI</li>
              <li>Enviar comunicações relacionadas à sua conta (suporte, cobranças)</li>
              <li>Garantir a segurança da plataforma</li>
              <li>Cumprir obrigações legais</li>
            </ul>
            <p className="mt-3">
              Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">3. Dados dos seus clientes</h2>
            <p>
              Você é responsável pelos dados de clientes inseridos na plataforma. Você declara ter o consentimento
              adequado para armazenar e processar esses dados. O ReservaAI age como operador de dados em nome do
              seu negócio (controlador).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">4. Armazenamento e segurança</h2>
            <p>
              Seus dados são armazenados em servidores seguros com criptografia em trânsito (HTTPS).
              Senhas são armazenadas com hash criptográfico. Tomamos medidas razoáveis para proteger suas informações,
              mas nenhum sistema é 100% seguro.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">5. Retenção de dados</h2>
            <p>
              Mantemos seus dados enquanto sua conta estiver ativa. Após o cancelamento, os dados podem ser
              mantidos por até 90 dias antes da exclusão definitiva. Você pode solicitar a exclusão antecipada
              entrando em contato com o suporte.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">6. Seus direitos (LGPD)</h2>
            <p>De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
            <ul className="mt-2 space-y-1.5 list-disc list-inside text-gray-600">
              <li>Acessar seus dados pessoais armazenados</li>
              <li>Corrigir dados incorretos ou desatualizados</li>
              <li>Solicitar a exclusão dos seus dados</li>
              <li>Revogar consentimentos dados anteriormente</li>
            </ul>
            <p className="mt-3">
              Para exercer seus direitos, entre em contato pelo suporte disponível no painel.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">7. Cookies e rastreamento</h2>
            <p>
              Usamos apenas cookies essenciais para funcionamento da sessão. Não utilizamos cookies de rastreamento
              de terceiros ou publicidade comportamental.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">8. Alterações nesta política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Notificaremos usuários sobre mudanças relevantes
              pelo painel ou por mensagem no WhatsApp cadastrado.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">9. Contato</h2>
            <p>
              Para dúvidas sobre privacidade ou para exercer seus direitos, entre em contato pelo suporte
              disponível no painel após o login.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
          <a href="/terms" className="hover:text-gray-600 underline">Termos de Uso</a>
          <a href="/signup" className="hover:text-gray-600 underline">Voltar para o início</a>
        </div>
      </div>
    </div>
  );
}
