import { ARGS } from "../cli.ts";

export const languages = ["zh", "en"] as const;
export type LanguageType = (typeof languages)[number];
const map = {
    zh: {
        label: "Chinese",
        welcome: "欢迎参加本次面试，我是 Alex，请你先简单介绍一下自己。",
    },
    en: {
        label: "English",
        welcome: "Welcome to this interview, I'm Alex. Please introduce yourself briefly.",
    },
};
export const lang = map[ARGS.LANG];
