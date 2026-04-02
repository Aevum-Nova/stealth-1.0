import { ChatInterface, ChatPageHeader, WelcomeState } from "@/components/chat";
import { useChat } from "@/hooks/use-chat";

export default function ChatPage() {
  const { messages, isLoading, sendMessage } = useChat();

  const hasMessages = messages.length > 0;

  return (
    <div className="app-chat-page relative flex min-h-0 flex-1 flex-col bg-[var(--canvas)]">
      <div className="pointer-events-none absolute right-4 top-4 z-10 md:right-6 md:top-5">
        <div className="pointer-events-auto">
          <ChatPageHeader />
        </div>
      </div>
      {hasMessages ? (
        <ChatInterface messages={messages} isLoading={isLoading} onSendMessage={sendMessage} />
      ) : (
        <WelcomeState onSendMessage={sendMessage} isLoading={isLoading} />
      )}
    </div>
  );
}
