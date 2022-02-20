
export const red = (text: string): string => `\x1b[31m${text}\x1b[0m`;
export const gray = (text: string): string => `\x1b[90m${text}\x1b[0m`;
export const cyan = (text: string): string => `\x1b[36m${text}\x1b[0m`;

const hbar = "^";
const grayVbar = gray("|");

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
    lineProximity?: number|false,
    endCol?: number,
    endLine?: number
}) : string {
    const spaceSkip = " ".repeat(4);
    let result = `${" ".repeat(2)} ${red(name)}: ${message}`;
    if (additionalMessage) result += `\n${" ".repeat(5)} ${additionalMessage}`;
    result += `\n${spaceSkip}${gray("--->" + " [")}${filename}${gray("]")}`;
    result += `\n${spaceSkip}${grayVbar}`;
    const lines = content.split("\n");
    const proximity = lineProximity || 1;
    const maxProximity = line + proximity;
    const startOffset = 1;
    
    for (let i=line-proximity; i < maxProximity; i++) {
        const untrimmedlineContent = lines[i];
        if (!untrimmedlineContent) continue;
        const lineContent = trim(untrimmedlineContent);
        const newCol = col - (untrimmedlineContent.length - lineContent.length);
        const newEndCol = endCol && endCol - (untrimmedlineContent.length - lineContent.length);
        const redUnderlineStart = lineContent.length - newCol - ((newEndCol && endLine === i) ? newEndCol : 0);
        result += `\n${spaceSkip}${grayVbar}${" ".repeat(startOffset)} ${lineContent}`;
        // If the error occured on this line...
        if (endLine ? i === endLine : line === i) {
            result += `\n${spaceSkip}${grayVbar}${" ".repeat(startOffset + newCol)}${red(hbar).repeat(redUnderlineStart)} ${red(message)}`;
        } else if (endLine && i > line && i < endLine) {
            result += `\n${spaceSkip}${grayVbar}${" ".repeat(startOffset + newCol - 1)}${red(hbar).repeat(redUnderlineStart)}`;
        }
    }
    result += "\n";
    return result;
}

function trim(str: string) : string {
    // eslint-disable-next-line no-control-regex
    const newStr = str.replace(/^[\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF]*/, "");
    const removedSpace = str.length - newStr.length;
    if (!removedSpace) return newStr;
    return " ".repeat(Math.floor(removedSpace / 4)) + newStr;
}
