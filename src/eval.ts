import OpenAI from "openai";
import { ARGS } from "./cli.ts";
import { ENV } from "./env.ts";
import { generateEvaluationPrompt } from "./providers/evaluation.ts";

const uuid = ARGS.UUID;
if (!uuid) throw new Error("no uuid to generate the transcripts");
await run(uuid);

async function run(uuid: string) {
    const evaluationPrompt = await generateEvaluationPrompt(uuid);

    const client = new OpenAI({
        baseURL: ENV.BASE_URL,
        apiKey: ENV.API_KEY,
    });
    const resp = await client.chat.completions.create({
        model: ENV.MODEL_NAME,
        messages: [
            {
                role: "user",
                content: evaluationPrompt,
            },
        ],
        max_completion_tokens: 2048,
    });
    // TODO: write eval.md into session directory.
    console.log(resp.choices[0]?.message.content);
}
