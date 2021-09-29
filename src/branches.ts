import { Project, TypescriptExtractor } from "@ts-docs/extractor";
import { Generator } from "./generator";
import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import { handleDefaultAPI, handleNodeAPI } from "./utils";
import { DocumentStructure, TsDocsOptions } from ".";

/**
 * The documentation will always have at least one branch: `stable`. All other branches will be placed in the main docs folder, with the prefix `b.`
 */
export function renderBranches(
    projects: Array<Project>,
    options: TsDocsOptions,
    documentStructure: DocumentStructure
) : void {
    if (!options.branches) return;

    const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), "ts-docs_"));

    for (const branchSetting of options.branches) {
        const entryPoints = [];
        const branchPath = path.join(tempFolder, branchSetting.displayName);
        fs.mkdirSync(branchPath);
        for (const branch of branchSetting.branches) {
            const project = branch.project ? projects.find(pr => pr.module.name === branch.project) : projects[0];
            if (!project) throw new Error(`Couldn't find project with name ${branch.project}`);
            if (!project.repository) throw new Error(`Couldn't find repository for project ${branch.project}`);
            const baseLink = project.repository.includes("/tree") ? project.repository.slice(0, project.repository.indexOf("/tree")) : project.repository;
            execSync(`git clone -b ${branch.name} ${baseLink}`, { cwd: branchPath, stdio: "ignore" });
            entryPoints.push(path.join(branchPath, baseLink.split("/").pop() as string, branch.entryPoint).replace(/\\/g, "/"));
        }

        const extractor = new TypescriptExtractor({
            entryPoints,
            externals: [handleDefaultAPI(), ...(options.externals||[]), ...handleNodeAPI()],
            maxConstantTextLength: 1024,
            ignoreFolderNames: ["lib"],
            passthroughModules: options.passthroughModules,
            cwd: branchPath
        });

        const newProjects = extractor.run();

        const gen = new Generator(documentStructure, {
            ...options,
            landingPage: branchSetting.landingPage ? newProjects.find(pr => pr.module.name === branchSetting.landingPage) : newProjects[0],
            out: path.join(options.out, `b.${branchSetting.displayName}`),
            changelog: false // Different branches don't have a changelog
        });

        gen.activeBranch = branchSetting.displayName;

        gen.generate(extractor, newProjects);
    }

    fs.rmSync(tempFolder, { recursive: true });
}