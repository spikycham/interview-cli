import { createInterface } from "node:readline/promises";
import { chat } from "./providers/lm.ts";
import { assistantPrompt } from "./providers/assistant.ts";

// type State = "listening" | "tts" | "responding" | "stt" | "recording";
type State = "inputting" | "responding" | "recording";
let state: State = "inputting";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Prompt commands.
const commands = ["exit"] as const;
type PromptCommand = (typeof commands)[number];
function handleCommand(prompt: string): boolean {
    const command = prompt.slice(1) as PromptCommand;
    switch (command) {
        case "exit":
            process.exit(0);
        default:
            breakline();
            process.stdout.write(`$ Prompt command ${command} not found\n`);
            return false;
    }
}

// Event loop.
let first = false;
let prompt = "";
while (true) {
    if (!first) {
        process.stdout.write(`$ ${assistantPrompt}\n`);
        first = true;
    }

    switch (state) {
        case "inputting": {
            prompt = await rl.question("# ");
            if (prompt.startsWith("/")) {
                if (!handleCommand(prompt)) continue;
            }
            breakline();
            state = "responding";
            break;
        }

        case "responding": {
            // TODO: catch no response and retry.
            let interval: ReturnType<typeof loading> | null = loading();

            let lastChunk = "";
            for await (const content of chat(prompt)) {
                if (interval) {
                    clearInterval(interval);
                    process.stdout.write("\r$ ");
                    interval = null;
                }

                lastChunk = content;
                process.stdout.write(content);
            }
            if (!lastChunk.endsWith("\n")) breakline();
            state = "recording";
            break;
        }

        case "recording": {
            state = "inputting";
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
