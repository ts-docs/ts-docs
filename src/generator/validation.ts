import { Declaration, DeclarationTypes } from "@ts-docs/extractor";
import { Generator } from "..";
import { emitWarning } from "../utils";

/**
 * Emits a warning if the following items are not documented:
 * - Classes
 *  - Class properties which are not computed
 *  - Class methods which are not computed
 * - Interfaces
 *  - Interface properties which are not computed
 * - Enums
 *  - Enum members which have no initializer
 * - Functions
 * - Types
 * - Constants
 */
export function validationNotDocumented(gen: Generator, decl: Declaration) : void {
    if (!gen.settings.logNotDocumented) return;
    switch (decl.kind) {
    case DeclarationTypes.CLASS:
        if (gen.settings.logNotDocumented.size && !gen.settings.logNotDocumented.has("class")) return;
        if (!decl.jsDoc) emitWarning`Class ${decl.name} is not documented.`;
        for (const method of decl.methods) {
            if (!method.jsDoc && typeof method.name === "string") emitWarning`Method ${decl.name}.${method.name} is not documented.`;
        }
        for (const prop of decl.properties) {
            if (!prop.jsDoc && prop.prop && typeof prop.prop.name === "string") emitWarning`Property ${decl.name}.${prop.prop.name} is not documented.`;
        }
        break;
    case DeclarationTypes.INTERFACE:
        if (gen.settings.logNotDocumented.size && !gen.settings.logNotDocumented.has("interface")) return;
        if (!decl.jsDoc || !decl.jsDoc.length) emitWarning`Interface ${decl.name} is not documented.`;
        for (const prop of decl.properties) {
            if (!prop.jsDoc && prop.prop && typeof prop.prop.name === "string") emitWarning`Property ${decl.name}.${prop.prop.name} is not documented.`;
        }
        break;
    case DeclarationTypes.ENUM:
        if (gen.settings.logNotDocumented.size && !gen.settings.logNotDocumented.has("enum")) return;
        if (!decl.jsDoc || !decl.jsDoc.length) emitWarning`Enum ${decl.name} is not documented.`;
        for (const member of decl.members) {
            if (!member.jsDoc && !member.initializer) emitWarning`Member ${decl.name}.${member.name} is not documented.`;
        }
        break;
    case DeclarationTypes.FUNCTION:
        if ((!gen.settings.logNotDocumented.size || gen.settings.logNotDocumented.has("function")) && !decl.jsDoc) emitWarning`Function ${decl.name} is not documented.`;
        break;
    case DeclarationTypes.TYPE_ALIAS:
        if ((!gen.settings.logNotDocumented.size || gen.settings.logNotDocumented.has("type")) && !decl.jsDoc) emitWarning`Type alias ${decl.name} is not documented.`;
        break;
    case DeclarationTypes.CONSTANT:
        if ((!gen.settings.logNotDocumented.size || gen.settings.logNotDocumented.has("constant")) && !decl.jsDoc) emitWarning`Constant ${decl.name} is not documented.`;
    }
}