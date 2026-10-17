import { chat, stt, tts } from "./providers/lm.ts";
import { assistantPrompt } from "./providers/assistant.ts";
import { createSession, writeJDCV, writeHistory, writeAudio, readAudio } from "./record.ts";
import { ARGS } from "./cli.ts";
import { cv, jd } from "./providers/system.ts";
import { playAudio, recordAudio } from "openai/helpers/audio.mjs";

// Init session.
const uuid = ARGS.UUID ?? (await createSession());
await writeJDCV(uuid, jd, cv);

// Event loop.
type State = "commanding" | "considering" | "listening" | "recording_audio" | "stt" | "asking"; // use done for developing;
let state: State = "considering";

let first = true;
let prompt = "";
let loop = true;

while (loop) {
    if (first) {
        // TODO: play an audio here.
        writeHeader("interviewer");
        process.stdout.write(`${assistantPrompt}`);
        breakline();
        first = false;
    }

    switch (state) {
        case "commanding": {
            const command = await readline("What to do next? Enter to continue: ");
            switch (command) {
                case "\n": {
                    state = "considering";
                    break;
                }
                case "/exit": {
                    breakline();
                    process.stdout.write(`Run evaluation with node src/eval.ts --uuid=${uuid}`);
                    process.exit(0);
                }
                default: {
                    breakline();
                    process.stdout.write(`$ Prompt command ${command} not found\n`);
                }
            }
            break;
        }

        case "considering": {
            const CONSIDER_TIME = 30;

            let count = CONSIDER_TIME;
            const render = () => {
                clearline();
                writeHeader("system");
                process.stdout.write(
                    `Plz consider the question clearly ${count--}... Press Enter to answer.`,
                );
            };

            render();
            const interval = setInterval(() => render(), 1_000);

            await new Promise<void>((resolve) => {
                const cleanup = () => {
                    clearTimeout(timeout);
                    clearInterval(interval);
                    resolve();
                };

                const timeout = setTimeout(cleanup, CONSIDER_TIME * 1000);
                wait(cleanup);
            });

            state = "recording_audio";
            break;
        }

        case "recording_audio": {
            const ANSWER_TIME = 2 * 60;

            let count = ANSWER_TIME;
            let render = () => {
                clearline();
                writeHeader("system");
                process.stdout.write(`Answering ${count--}...`);
            };

            render();
            const interval = setInterval(() => render(), 1_000);

            const ac = new AbortController();
            const audioPromise = recordAudio({ device: 0, signal: ac.signal });

            await new Promise<File>((resolve) => {
                const cleanup = () => {
                    clearTimeout(timeout);
                    clearInterval(interval);
                    ac.abort();
                    resolve(audioPromise);
                };

                const timeout = setTimeout(() => cleanup(), ANSWER_TIME * 1000);
                wait(cleanup);
            }).then((audio) => writeAudio(uuid, audio));

            state = "stt";
            break;
        }

        case "stt": {
            const interval = loading();

            const base64 = await readAudio(uuid);
            prompt = await stt(base64);
            await writeHistory(uuid, prompt);
            clearline();

            writeHeader("user");
            process.stdout.write(`${prompt}`);
            breakline();
            breakline();

            clearInterval(interval);
            state = "asking";
            break;
        }

        case "asking": {
            const interval = loading();

            const textChunks: string[] = [];
            for await (const content of chat(prompt)) {
                textChunks.push(content);
            }
            const text = textChunks.reduce((prev, curr) => prev + curr, "");
            const audio = await tts(text);

            clearInterval(interval);
            clearline();
            writeHeader("interviewer");
            process.stdout.write("Asking...");

            await playAudio(audio);

            clearline();
            writeHeader("interviewer");
            process.stdout.write(text);

            breakline();
            state = "commanding";
            break;
        }
    }
}

// Helpers.
function breakline() {
    process.stdout.write("\n");
}
function clearline() {
    process.stdout.write("\r\x1B[K");
}
function readline(question: string) {
    clearline();
    writeHeader("system");
    process.stdout.write(question);

    let input = "";
    return new Promise((resolve) => {
        process.stdin.setRawMode(true);
        process.stdin.setEncoding("utf8");

        const onData = (chunk: string) => {
            if (chunk === "\r" || chunk === "\n") {
                process.stdin.off("data", onData);
                process.stdin.setRawMode(false);
                resolve(input.trim() || "\n");
                return;
            }

            process.stdout.write(chunk);
            input += chunk;
        };

        process.stdin.on("data", onData);
    });
}
function loading(): ReturnType<typeof setInterval> {
    const syms = ["|", "/", "-", "\\"];
    let count = 0;
    return setInterval(() => {
        clearline();
        writeHeader("system");
        process.stdout.write(`${syms[count % 4]}`);
        count++;
    }, 200);
}

function writeHeader(type: "interviewer" | "system" | "user") {
    const map = {
        system: "[_____System]",
        interviewer: "[Interviewer]",
        user: "[_______User]",
    };
    process.stdout.write(`${map[type]} `);
}

function wait(cb: () => void) {
    process.stdin.setRawMode(true);
    process.stdin.setEncoding("utf8");

    // After the commanding state, the encoding is utf8
    const onData = (key: string) => {
        if (key === "\r" || key === "\n") {
            process.stdin.off("data", onData);
            process.stdin.setRawMode(false);
            cb();
        }
    };
    process.stdin.on("data", onData);
}
