import { FinancialChat } from '@/src/components/chat/financial-chat';

export default function ChatPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Chat Financiero</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Consulta sobre tus gastos, categorías y presupuestos en lenguaje natural
        </p>
      </div>
      <FinancialChat />
    </div>
  );
}
