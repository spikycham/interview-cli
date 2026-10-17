import { chat, stt, tts } from "./providers/lm.ts";
import { spawn } from "node:child_process";
import { assistantPrompt } from "./providers/assistant.ts";
import { createSession, writeJDCV, writeHistory, writeAudio, readAudio } from "./record.ts";
import { ARGS } from "./cli.ts";
import { cv, jd } from "./providers/system.ts";
import { playAudio, recordAudio } from "openai/helpers/audio.mjs";
import { Readable } from "node:stream";

type State = "considering" | "listening" | "recording_audio" | "stt" | "asking" | "done"; // done for developing;
let state: State = "considering";

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
                clearInterval(interval);
                textChunks.push(content);
            }
            const text = textChunks.reduce((prev, curr) => prev + curr, "");
            const audio = await tts(text);

            clearline();
            writeHeader("interviewer");
            process.stdout.write("Asking...");

            await playAudio(audio);

            breakline();
            state = "done";
            break;
        }

        case "done": {
            loop = false;
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
    process.stdin.on("data", (key: Buffer) => {
        if (key[0] === 13) {
            process.stdin.setRawMode(false);
            cb();
        }
    });
}
