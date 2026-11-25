'use client';

// Abre el AIChatBot del header (escucha el evento 'abrir-chat').
export default function AbrirChatButton({ children, className }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event('abrir-chat'))}>
      {children}
    </button>
  );
}
