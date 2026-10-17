import OpenAI from "openai";
import { ARGS } from "./cli.ts";
import { ENV } from "./env.ts";
import { generateEvaluationPrompt } from "./providers/evaluation.ts";
import { writeEval } from "./record.ts";

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

    const content = resp.choices[0]?.message.content;
    if (!content) throw new Error("no response for evaluation");
    await writeEval(uuid, content);
    console.log(`Evaluation saved to sessions/${uuid}/eval.md`);
}
