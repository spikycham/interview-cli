import path from "node:path";

process.loadEnvFile(path.join(process.cwd(), ".env"));

export const ENV = {
    BASE_URL: process.env.BASE_URL,
    API_KEY: process.env.API_KEY,
};
