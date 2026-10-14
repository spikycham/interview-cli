import { createInterface } from "node:readline/promises";

// type State = "listening" | "tts" | "responding" | "stt" | "recording";
type State = "inputting" | "responding" | "recording";
let state: State = "inputting";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
});

while (true) {
    switch (state) {
        case "inputting":
            const prompt = await rl.question("Your answer: ");
            handleInput(prompt);

            state = "responding";
            break;
        case "responding":
            state = "recording";
            break;
        case "recording":
            state = "inputting";
            break;
    }
}

function handleInput(txt: string) {
    switch (txt) {
        case "/exit":
            process.exit(0);
        default:
            break;
    }
}
