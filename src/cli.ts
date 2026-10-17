class CLIError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CLIError";
    }
}

function parseArg(prefix: string, shouldExist: true): string;
function parseArg(prefix: string, shouldExist: false): string | undefined;
function parseArg(prefix: string, shouldExist: boolean) {
    const err = new CLIError(`missing argument --${prefix}`);

    const arg = process.argv.find((arg) => arg.startsWith(`--${prefix}=`));
    if (!shouldExist) {
        return arg?.split("=")[1];
    }
    if (!arg) throw err;

    const v = arg.split("=")[1];
    if (!v) throw err;

    return v;
}

const languages = ["zh", "en"] as const;
type LanguageType = (typeof languages)[number];
function parseLang(): LanguageType {
    const DEFAULT_LANGUAGE = "zh";

    const arg = process.argv.find((arg) => arg.startsWith("--lang="));
    if (!arg) return DEFAULT_LANGUAGE;

    const v = arg.split("=")[1] as LanguageType;
    if (!v || !languages.includes(v)) return DEFAULT_LANGUAGE;
    return v;
}

// TODO: optimize the way of getting the arguments.
// The validation should be put into the user.
export const ARGS = {
    OUTPUT: "sessions",
    UUID: parseArg("uuid", false),
    JD: parseArg("jd", false),
    CV: parseArg("cv", false),
    LANG: parseLang(),
};

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
