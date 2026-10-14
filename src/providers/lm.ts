import OpenAI from "openai";
import { ENV } from "../env.ts";
import { systemPrompt } from "./system.ts";
import { assistantPrompt } from "./assistant.ts";

class ModelError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ModelError";
    }
}

const client = new OpenAI({
    baseURL: ENV.BASE_URL,
    apiKey: ENV.API_KEY,
});

const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
        role: "system",
        content: systemPrompt,
    },
    {
        role: "assistant",
        content: assistantPrompt,
    },
];

export async function* chat(prompt: string) {
    messages.push({
        role: "user",
        content: prompt,
    });

    const resp = await client.chat.completions.create({
        model: ENV.MODEL_NAME,
        messages,
        stream: true,
    });

    let answer = "";
    for await (const chunk of resp) {
        const choice = chunk.choices[0];

        if (!choice) throw new ModelError("responded nothing");
        if (choice.finish_reason === "stop") break;

        const content = choice.delta.content;
        if (!content) continue;

        answer += content;
        yield content;
    }

    messages.push({
        role: "assistant",
        content: answer,
    });
}
