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

export function createSession(uuid: string): Promise<void>;
export function createSession(uuid: undefined): Promise<string>;
export async function createSession(uuid: string | undefined): Promise<string | void> {
    if (uuid) return;
    uuid = randomUUID();

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

// TODO: read histories back when reopen this session.
