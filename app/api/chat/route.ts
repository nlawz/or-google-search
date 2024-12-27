import { ChatRequestBody } from "./types";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DynamicRetrievalMode } from "@google/generative-ai";

// Initialize Google AI for search
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
const searchModel = genAI.getGenerativeModel(
    {
        model: "models/gemini-1.5-pro-002",
        tools: [
            {
                googleSearchRetrieval: {
                    dynamicRetrievalConfig: {
                        mode: DynamicRetrievalMode.MODE_DYNAMIC,
                        dynamicThreshold: 0.7,
                    },
                },
            },
        ],
    },
    { apiVersion: "v1beta" }
);

async function performGoogleSearch({ query }: { query: string }) {
    try {
        const result = await searchModel.generateContent(query);
        const response = await result.response;

        // Log the complete response for debugging
        console.log(
            "Complete search response:",
            JSON.stringify(response, null, 2)
        );

        if (!response.candidates?.[0]?.groundingMetadata) {
            console.error("Search response:", response);
            throw new Error("No search results found");
        }

        // Log the grounding metadata
        console.log("Search grounding metadata:", {
            webSearchQueries:
                response.candidates[0].groundingMetadata.webSearchQueries,
            citations:
                response.candidates[0].groundingMetadata.groundingChuncks,
            support: response.candidates[0].groundingMetadata.groundingSupport,
            text: response.text(), // Add the actual response text
            raw: response.candidates[0].groundingMetadata, // Add the raw metadata
        });

        return response.candidates[0].groundingMetadata;
    } catch (error) {
        console.error("Google Search error:", error);
        throw error;
    }
}

export async function POST(request: Request) {
    try {
        const body: ChatRequestBody = await request.json();

        const completion = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "",
                    "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "google/gemini-2.0-flash-exp:free",
                    messages: body.messages,
                    tools: [
                        {
                            type: "function",
                            function: {
                                name: "performGoogleSearch",
                                description:
                                    "Search the web using Google's dynamic retrieval",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        query: {
                                            type: "string",
                                            description: "The search query",
                                        },
                                    },
                                    required: ["query"],
                                },
                            },
                        },
                    ],
                    tool_choice: "auto",
                }),
            }
        );

        const result = await completion.json();

        // Add validation for the OpenRouter response
        if (!result?.choices?.[0]?.message) {
            console.error("Invalid OpenRouter response:", result);
            throw new Error("Invalid response from OpenRouter");
        }

        if (result.choices[0].message.tool_calls) {
            const toolCall = result.choices[0].message.tool_calls[0];
            const args = JSON.parse(toolCall.function.arguments);
            const searchResults = await performGoogleSearch(args);

            const finalCompletion = await fetch(
                "https://openrouter.ai/api/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "",
                        "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: "google/gemini-2.0-flash-exp:free",
                        messages: [
                            ...body.messages,
                            result.choices[0].message,
                            {
                                role: "tool",
                                name: "performGoogleSearch",
                                tool_call_id: toolCall.id,
                                content: JSON.stringify(searchResults),
                            },
                        ],
                    }),
                }
            );

            const finalResult = await finalCompletion.json();
            console.log("Final OpenRouter response:", finalResult); // Debug log

            if (!finalResult?.choices?.[0]?.message?.content) {
                console.error("Invalid final response structure:", finalResult);
                throw new Error(
                    `Invalid final response from OpenRouter: ${JSON.stringify(
                        finalResult
                    )}`
                );
            }

            return NextResponse.json({
                message: finalResult.choices[0].message.content,
                metadata: searchResults,
            });
        }

        return NextResponse.json({
            message: result.choices[0].message.content,
        });
    } catch (error) {
        console.error("Chat API error:", {
            error,
            message: error instanceof Error ? error.message : String(error),
            details: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
            { error: "Failed to process chat request" },
            { status: 500 }
        );
    }
}
