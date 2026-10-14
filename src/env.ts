import path from "node:path";

process.loadEnvFile(path.join(process.cwd(), ".env"));

class EnvError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EnvError";
    }
}

function parseEnv(key: string): string {
    const val = process.env[key];
    if (!val) throw new EnvError(`missing value ${key}`);
    return val;
}

export const ENV = {
    BASE_URL: parseEnv("BASE_URL"),
    MODEL_NAME: parseEnv("MODEL_NAME"),
    API_KEY: parseEnv("API_KEY"),
};
