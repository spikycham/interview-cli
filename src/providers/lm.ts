import OpenAI from "openai";
import { ENV } from "../env.ts";
import { systemPrompt } from "./system.ts";
import { assistantPrompt } from "./assistant.ts";

export class ModelError extends Error {
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
        max_completion_tokens: 512,
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
        yield content.replace(/\n/g, " ");
    }

    messages.push({
        role: "assistant",
        content: answer,
    });
}

export async function stt(base64: string) {
    const resp = await client.chat.completions.create({
        model: ENV.STT_MODEL_NAME,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "input_audio",
                        input_audio: {
                            data: `data:audio/wav;base64,${base64}`,
                            format: "wav",
                        },
                    },
                ],
            },
        ],
        // @ts-expect-error
        extra_body: {
            asr_options: {
                language: "en",
            },
        },
    });
    const content = resp.choices[0]?.message.content;
    if (!content) throw new ModelError("responded nothing");
    return content;
}
export async function tts(text: string) {
    const resp = await client.chat.completions.create({
        model: ENV.TTS_MODEL_NAME,
        messages: [
            {
                role: "user",
                content:
                    "You're the interviewer, and you're asking the user questions. Be serious about this.",
            },
            { role: "assistant", content: text },
        ],
        audio: {
            format: "mp3",
            voice: "Dean",
        },
    });

    const audio = resp.choices[0]?.message.audio?.data;
    if (!audio) throw new ModelError("responded nothing");
    return new File([Buffer.from(audio, "base64")], "audio.wav", { type: "audio/wav" });
}
