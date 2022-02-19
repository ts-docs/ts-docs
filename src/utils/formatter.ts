
export const red = (text: string): string => `\x1b[31m${text}\x1b[0m`;
export const gray = (text: string): string => `\x1b[90m${text}\x1b[0m`;
export const cyan = (text: string): string => `\x1b[36m${text}\x1b[0m`;

const hbar = "─";
const vbar = "│";
const grayVbar = gray(vbar);
const ltop = "╭";
const lbot = "╰";

export function formatErrorObj(err: Error, settings: {
    filename: string,
    content: string,
    additionalMsg?: string,
    lineProximity?: number,
    n?: number
}) : string {
    if (!err.stack) return err.toString();
    const errorLine = [...err.stack.matchAll(/:(?<line>\d+):(?<col>\d+)/gm)][settings.n || 1];
    if (!errorLine) return err.toString();
    const { line, col } = errorLine.groups as { line: string, col: string };
    return formatError({
        line: +line - 1,
        col: +col,
        name: err.name,
        message: err.message,
        ...settings
    });
}

export function formatError({line, col, name, message, filename, content, lineProximity, additionalMessage, endCol, endLine}: {
    line: number,
    col: number,
    name: string,
    message: string,
    filename: string,
    content: string,
    additionalMessage?: string,
    lineProximity?: number,
    endCol?: number,
    endLine?: number
}) : string {
    const spaceSkip = " ".repeat(4);
    let result = `${" ".repeat(2)} ${red(name)}: ${message}`;
    if (additionalMessage) result += `\n${" ".repeat(5)} ${additionalMessage}`;
    result += `\n${spaceSkip}${gray(ltop + hbar + "[")}${filename}${gray("]")}`;
    result += `\n${spaceSkip}${grayVbar}`;
    const lines = content.split("\n");
    const proximity = lineProximity || 1;
    const maxProximity = line + proximity;
    const startOffset = 2;
    
    for (let i=line-proximity; i < maxProximity; i++) {
        const lineContent = lines[i];
        if (!lineContent) continue;
        const redUnderlineStart = lineContent.length - col - (endCol || 0);
        const centerOfRedUnderline = Math.floor(redUnderlineStart / 2);
        result += `\n${spaceSkip}${grayVbar}${" ".repeat(startOffset)} ${lineContent}`;
        // If the error occured on this line...
        if (endLine ? i === endLine : line === i) {
            result += `\n${spaceSkip}${grayVbar}${" ".repeat(startOffset + col)}${red(hbar).repeat(redUnderlineStart)}`;
            result += `\n${spaceSkip}${grayVbar}${" ".repeat(startOffset + col + centerOfRedUnderline)}${red(vbar)}`;
            result += `\n${spaceSkip}${grayVbar}${" ".repeat(startOffset + col + centerOfRedUnderline)}${red(lbot + hbar.repeat(3))} ${message}`;
        } else if (endLine && i > line && i < endLine) {
            result += `\n${spaceSkip}${grayVbar}${" ".repeat(startOffset + col - 1)}${red(hbar).repeat(redUnderlineStart)}`;
        }
    }
    result += "\n";
    return result;
}