export class BitField {
    bits: number;
    constructor(bits: Array<number | undefined | false>) {
        this.bits = 0;
        this.set(...BitField.resolve(bits));
    }

    has(bit: number): boolean {
        return (this.bits & bit) === bit;
    }

    set(...bits: Array<number | undefined | false>) {
        for (const bit of BitField.resolve(bits)) {
            this.bits |= bit;
        }
    }

    remove(...bits: Array<number | undefined | false>) {
        let total = 0;
        for (const bit of BitField.resolve(bits)) {
            total |= bit;
        }
        this.bits &= ~total;
    }

    toJSON(): number {
        return this.bits;
    }

    static resolve(bits: Array<number | undefined | false>): number[] {
        return bits.filter(b => b !== undefined && b !== false) as number[];
    }

    static has(bitfield: number, bit: number): boolean {
        return (bitfield & bit) !== 0;
    }
}
