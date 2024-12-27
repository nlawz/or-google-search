import { ChatForm } from "./_components/chat-form";

export default function ChatPage() {
    return (
        <div className="container mx-auto max-w-2xl p-4">
            <h1 className="text-2xl font-bold mb-4">Chat</h1>
            <ChatForm />
        </div>
    );
}
