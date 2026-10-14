import OpenAI from "openai";
import { ENV } from "../env.ts";
import { systemPrompt } from "./system.ts";

const client = new OpenAI({
    baseURL: ENV.BASE_URL,
    apiKey: ENV.API_KEY,
});

const completion = client.chat.completions.create({
    model: ENV.MODEL_NAME,
    messages: [
        {
            role: "system",
            content: systemPrompt,
        },
    ],
});

export { client };
