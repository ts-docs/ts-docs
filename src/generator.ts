
import {ExtractorList} from "@ts-docs/extractor";
import Handlebars from "handlebars";

export interface GeneratorSettings {
    outDir: string,
    readme: string,
    repository?: string,
    homepage?: string
}

function generate(packages: ExtractorList, settings: GeneratorSettings) : void {
    const currentContent = "";
    Handlebars.registerHelper("content", () => {
        console.log(currentContent);
        return currentContent;
    });


}