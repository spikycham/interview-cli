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

// TODO: optimize the way of getting the arguments.
// The validation should be put into the user.
export const ARGS = {
    OUTPUT: "sessions",
    UUID: parseArg("uuid", false),
    JD: parseArg("jd", false),
    CV: parseArg("cv", false),
};
