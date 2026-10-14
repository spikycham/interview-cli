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

let first = false;
let prompt = "";
while (true) {
    if (!first) {
        process.stdout.write(`$ ${assistantPrompt}\n`);
        first = true;
    }

    switch (state) {
        case "inputting":
            prompt = await rl.question("Your answer: ");
            if (prompt === "/exit") process.exit(0);
            process.stdout.write("\n");
            state = "responding";
            break;
        case "responding":
            // TODO: catch no response and retry.
            // TODO: the last line will be overwrite by the `rl.question`.
            process.stdout.write("$ ");
            for await (const content of chat(prompt)) {
                process.stdout.write(content);
            }
            state = "recording";
            break;
        case "recording":
            state = "inputting";
            break;
    }
}
