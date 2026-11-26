import ChatVivoAdmin from '@/components/chatVivo/ChatVivoAdmin';

export const metadata = {
  title: 'Chat en vivo',
  robots: { index: false, follow: false },
};

// Link que llega por Telegram cuando un cliente le escribe al asistente (tienda o auditoría privada).
export default async function ChatVivoPage({ params }) {
  const { id } = await params;
  return <ChatVivoAdmin chatId={decodeURIComponent(id)} />;
}
