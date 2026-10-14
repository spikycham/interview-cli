class CLIError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CLIError";
    }
}

function parseArg(prefix: string): string {
    const err = new CLIError("missing argument --" + prefix);

    const arg = process.argv.find((arg) => arg.startsWith(`--${prefix}=`));
    if (!arg) throw err;
    const v = arg.split("=")[1];
    if (!v) throw err;

    return v;
}

export const ARGS = {
    OUTPUT: "sessions",
    JD: parseArg("jd"),
    CV: parseArg("cv"),
};
