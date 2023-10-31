
export type ReMapHooks<H> = {
    [Property in keyof H]?: H[Property][]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class HookManager<H extends Record<string, (...params: any[]) => any>> {
    private hooks: ReMapHooks<H>;
    constructor() {
        this.hooks = {};
    }

    has(hookName: keyof H) : boolean {
        return !!this.hooks[hookName]?.length;
    } 

    attach<T extends keyof H>(hookName: T, call: H[T]) : void {
        if (!this.hooks[hookName]) this.hooks[hookName] = [call];
        else this.hooks[hookName]!.push(call);
    }

    trigger<T extends keyof H>(hookName: T, ...params: Parameters<H[T]>) : ReturnType<H[T]> | undefined {
        if (!this.hooks[hookName]) return;
        for (const call of this.hooks[hookName]!) {
            const result = call(...params);
            if (result !== undefined) return result; 
        }
        return undefined;
    }
}