"use client";

import { useState } from "react";
import { ChatMessage } from "@/app/api/chat/types";

export function ChatForm() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        setIsLoading(true);
        const newMessages = [
            ...messages,
            { role: "user", content: input } as ChatMessage,
        ];

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ messages: newMessages }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessages([
                    ...newMessages,
                    { role: "assistant", content: data.message } as ChatMessage,
                ]);
            } else {
                console.error("Chat error:", data.error);
            }
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setInput("");
            setIsLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 rounded-md border p-2"
                    placeholder="Type your message..."
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="rounded-md bg-blue-500 px-4 py-2 text-white disabled:opacity-50">
                    Send
                </button>
            </div>

            <div className="space-y-2">
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`p-2 rounded-md ${
                            message.role === "user"
                                ? "bg-blue-100"
                                : "bg-gray-100"
                        }`}>
                        <p>{message.content}</p>
                    </div>
                ))}
            </div>
        </form>
    );
}
