'use client';

import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { FinancialChat } from './financial-chat';

export function FloatingChat() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[360px] max-w-[calc(100vw-3rem)] h-[520px] rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden">
          <FinancialChat onClose={() => setOpen(false)} />
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar chat' : 'Abrir chat financiero'}
        className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center justify-center text-white transition-colors"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
