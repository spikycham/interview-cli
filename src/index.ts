// import { chat } from "./providers/lm.ts";
import { assistantPrompt } from "./providers/assistant.ts";
import { createSession, writeJDCV, writeHistory, writeAudio } from "./record.ts";
import { ARGS } from "./cli.ts";
import { cv, jd } from "./providers/system.ts";
import { recordAudio } from "openai/helpers/audio.mjs";

type State = "considering" | "listening" | "recording_audio" | "tts" | "responding" | "stt";
let state: State = "considering";
// TOOD(optimize): 30 seconds for considering each question, and 2 minutes for answering.
// type State = "inputting" | "responding" | "recording";
// let state: State = "inputting";

// Prompt commands.
const commands = ["exit"] as const;
type PromptCommand = (typeof commands)[number];
function handleCommand(uuid: string, prompt: string): boolean {
    const command = prompt.slice(1) as PromptCommand;
    switch (command) {
        case "exit":
            // TODO: update this prompt.
            breakline();
            process.stdout.write(`Run evaluation with node src/eval.ts --uuid=${uuid}`);
            process.exit(0);
        default:
            breakline();
            process.stdout.write(`$ Prompt command ${command} not found\n`);
            return false;
    }
}

// Init session.
const uuid = ARGS.UUID ?? (await createSession());
await writeJDCV(uuid, jd, cv);

// Event loop.
let first = false;
// let prompt = "";
while (true) {
    if (!first) {
        // TODO: play an audio here.
        process.stdout.write(`[INTERVIEWER] ${assistantPrompt}\n`);
        first = true;
    }

    switch (state) {
        case "considering": {
            let count = 3;
            const render = () => {
                process.stdout.write(
                    `\r[_____SYSTEM] Plz consider the question clearly ${count}... Press Enter to answer.`,
                );
            };

            render();
            const interval = setInterval(() => {
                count--;
                render();
            }, 1_000);

            await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => cleanup(), 3000);

                const cleanup = () => {
                    clearTimeout(timeout);
                    clearInterval(interval);
                    resolve();
                };

                wait(cleanup);
            });

            state = "recording_audio";
            break;
        }

        case "recording_audio": {
            process.stdout.write(`\r\x1B[K[_____SYSTEM] Answering...`);
            // const audioPromise = recordAudio({ signal: AbortSignal.timeout(2 * 60 * 1000) });
            // wait(() => {});
            // await writeAudio(uuid, audio);
            state = "stt";
            break;
        }

        case "stt": {
            state = "considering";
            break;
        }
    }
}

// Helpers.
function breakline() {
    process.stdout.write("\n");
}
function loading(): ReturnType<typeof setInterval> {
    const syms = ["|", "/", "-", "\\"];
    let count = 0;
    return setInterval(() => {
        process.stdout.write(`\r$ ${syms[count % 4]}`);
        count++;
    }, 200);
}
function wait(cb: () => void) {
    process.stdin.setRawMode(true);
    process.stdin.on("data", (key: Buffer) => {
        if (key[0] === 13) {
            process.stdin.setRawMode(false);
            cb();
        }
    });
}
