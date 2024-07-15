import ts from "typescript";

export enum LoggerLevel {
    DEBUG,
    INFO,
    WARNING,
    ERROR,
    CRITICAL
}

export type LoggerEmitter = (loggerLevel: LoggerLevel, messgae: string) => void;
export type LoggerFormatter<Msg> = (loggerLevel: LoggerLevel, source: string, message: Msg) => string;

export class Logger<Msg> {
    constructor(protected emitter: LoggerEmitter, protected formatter: LoggerFormatter<Msg>, protected source: string, public minLogLevel = 0) {}

    protected emit(level: LoggerLevel, message: Msg): void {
        if (this.minLogLevel > level) return;
        this.emitter(level, this.formatter(level, this.source, message));
    }

    debug(message: Msg) {
        this.emit(LoggerLevel.DEBUG, message);
    }

    info(message: Msg) {
        this.emit(LoggerLevel.INFO, message);
    }

    warning(message: Msg) {
        this.emit(LoggerLevel.WARNING, message);
    }

    error(message: Msg) {
        this.emit(LoggerLevel.ERROR, message);
    }

    critical(message: Msg) {
        this.emit(LoggerLevel.CRITICAL, message);
    }

    withFormatter<T>(formatter: LoggerFormatter<T>, source?: string) : Logger<T> {
        //@ts-expect-error We should be able to make this comparison...
        if (this.formatter === formatter) return this;
        return new Logger(this.emitter, formatter, source || this.source, this.minLogLevel);
    }

    withSource(source: string) : Logger<Msg> {
        if (this.source === source) return this;
        return new Logger(this.emitter, this.formatter, source, this.minLogLevel);
    }
}

export function createBaseLogger(source: string, minLogLevel?: number) : Logger<string> {
    return new Logger(consoleEmitter, stringFormatter, source, minLogLevel);
}

export function consoleEmitter(loggerLevel: LoggerLevel, message: string): void {
    if (loggerLevel >= LoggerLevel.ERROR) {
        console.error(message);
        process.exit(1);
    }
    else console.log(message);
}

export function stringFormatter(loggerLevel: LoggerLevel, source: string, message: string): string {
    return `[${source}] [${LoggerLevel[loggerLevel]}]: ${message}`;
}

export interface TsDiagnosticMessage {
    code?: number;
    message: string;
    node?: ts.Node;
}


export function createTsFormatter(color?: boolean) : LoggerFormatter<TsDiagnosticMessage> {
    return (loggerLevel: LoggerLevel, source: string, message: TsDiagnosticMessage) => {
        let tsCategory;
        switch (loggerLevel) {
            case LoggerLevel.DEBUG:
            case LoggerLevel.INFO:
                tsCategory = ts.DiagnosticCategory.Message;
                break;
            case LoggerLevel.WARNING:
                tsCategory = ts.DiagnosticCategory.Warning;
                break;
            case LoggerLevel.ERROR:
            case LoggerLevel.CRITICAL:
                tsCategory = ts.DiagnosticCategory.Error;
                break;
        }

        let start, length;
        if (message.node && !ts.isSourceFile(message.node)) {
            start = message.node.pos + 2;
            length = message.node.end - start;
        }

        const diagnostics = [
            {
                category: tsCategory,
                start,
                length,
                code: message.code || 8000,
                file: message.node?.getSourceFile(),
                messageText: `[${source}] ${message.message}`
            }
        ];

        const formatCtx = {
            getNewLine: () => "\r\n",
            getCurrentDirectory: () => "unknown directory",
            getCanonicalFileName: (fileName: string) => fileName
        };

        if (color) return ts.formatDiagnosticsWithColorAndContext(diagnostics, formatCtx);
        else return ts.formatDiagnostics(diagnostics, formatCtx);
    };

}
