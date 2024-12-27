export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface ChatRequestBody {
    messages: ChatMessage[];
}

interface GroundingMetadata {
    citations?: Array<{
        startIndex?: number;
        endIndex?: number;
        url?: string;
        title?: string;
        snippet?: string;
    }>;
}

export interface ChatResponse {
    message: string;
    metadata?: GroundingMetadata;
}
