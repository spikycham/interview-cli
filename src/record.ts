import fs from "fs/promises";
import path from "node:path";
import { assistantPrompt } from "./providers/assistant.ts";
import { randomUUID } from "node:crypto";

type RoleType = "assistant" | "user";

interface Metadata {
    uuid: string;
    current_round: number;
    current_role: RoleType;
}

export async function createSession(): Promise<string> {
    const uuid = randomUUID();

    await fs.mkdir(path.join(process.cwd(), `sessions/${uuid}`), { recursive: true });
    await fs.writeFile(
        path.join(process.cwd(), `sessions/${uuid}/assistant_001.txt`),
        assistantPrompt,
    );
    await fs.writeFile(
        path.join(process.cwd(), `sessions/${uuid}/metadata.json`),
        JSON.stringify({
            uuid: uuid,
            current_round: 1,
            current_role: "user",
        }),
    );

    return uuid;
}

export async function writeJDCV(uuid: string, jd: string, cv: string) {
    await fs.writeFile(path.join(process.cwd(), `sessions/${uuid}/jd.md`), jd);
    await fs.writeFile(path.join(process.cwd(), `sessions/${uuid}/cv.md`), cv);
}
export async function readJDCV(uuid: string) {
    const jd = await fs.readFile(path.join(process.cwd(), `sessions/${uuid}/jd.md`), "utf-8");
    const cv = await fs.readFile(path.join(process.cwd(), `sessions/${uuid}/cv.md`), "utf-8");
    return { jd, cv };
}

export async function writeHistory(uuid: string, content: string) {
    const str = await fs.readFile(
        path.join(process.cwd(), `sessions/${uuid}/metadata.json`),
        "utf-8",
    );
    const metadata: Metadata = JSON.parse(str);

    const filename = `${metadata.current_role}_${metadata.current_round.toString().padStart(3, "0")}`;
    if (metadata.current_role === "user") metadata.current_round++;
    metadata.current_role = metadata.current_role === "user" ? "assistant" : "user";

    await fs.writeFile(
        path.join(process.cwd(), `sessions/${metadata.uuid}/${filename}.txt`),
        content,
    );
    await fs.writeFile(
        path.join(process.cwd(), `sessions/${metadata.uuid}/metadata.json`),
        JSON.stringify(metadata),
    );
}

export async function readHistory(uuid: string) {
    const str = await fs.readFile(
        path.join(process.cwd(), `sessions/${uuid}/metadata.json`),
        "utf-8",
    );
    const metadata: Metadata = JSON.parse(str);

    let history = "";
    for (let i = 1; i < metadata.current_round; i++) {
        const idx = i.toString().padStart(3, "0");

        const assistant = await fs.readFile(
            path.join(process.cwd(), `sessions/${uuid}/assistant_${idx}.txt`),
            "utf-8",
        );
        history += `Interviewer_${idx}: ${assistant}`;
        const user = await fs.readFile(
            path.join(process.cwd(), `sessions/${uuid}/user_${idx}.txt`),
            "utf-8",
        );
        history += `Speaker_${idx}: ${user}`;
    }

    return history;
}
