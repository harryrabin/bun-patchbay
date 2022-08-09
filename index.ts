import {Server, ServeOptions} from "bun";
import {DefaultResponse, Patchable, PBRequest, Router} from "./core";
import {compile as hbCompile} from "handlebars";
import * as fs from "fs";
import * as path from "path";

export * from './core';
export * as PBUtils from './utilities';

declare global {
    const PatchBay: PBApp;
}

export type PBServeOptions = Omit<ServeOptions, "fetch" | "port">;

export interface MainBay {
    baseURL: string;
    port: number;
    patches: Patchable[];
    defaultResponse?: DefaultResponse;
}

export interface PBAppOptions {
    noHandlebars?: boolean;
    handlebarsOptions?: CompileOptions;
    viewDirectory?: string;
}

export class PBApp {
    readonly mainRouter: Router;
    readonly port: number;
    readonly baseURL: string;
    readonly templates: Record<string, HandlebarsTemplateDelegate> = {};

    private readonly mainBay: MainBay;

    constructor(mainBay: MainBay, options: PBAppOptions = {}) {
        this.mainBay = mainBay;
        this.port = mainBay.port;
        this.baseURL = mainBay.baseURL;

        this.mainRouter = new class extends Router {
            patches = mainBay.patches;
            defaultResponse = mainBay.defaultResponse ||
                new Response("404: not found", {status: 404});
        }(mainBay.baseURL);

        Object.defineProperty(global, "PatchBay", {
            value: this,
            writable: false
        });

        const viewDir = options.viewDirectory || "./views";
        if (!options.noHandlebars)
            loadTemplates(this.templates, viewDir, {hbOptions: options.handlebarsOptions});
    }


    serve(options: PBServeOptions = {}): Server {
        const _this = this;

        const server = Bun.serve({
            ...options,
            port: _this.mainBay.port,
            fetch(req: Request): Promise<Response> {
                let overrideURL = req.url;
                if (overrideURL.at(-1) !== '/') overrideURL += '/';
                return _this.mainRouter.fetch(new PBRequest(req, overrideURL));
            }
        });
        console.log(`Server started on port ${server.port}`);
        return server;
    }
}

function loadTemplates(target: object, dir: string, options: {
    parent?: string;
    hbOptions?: CompileOptions;
} = {}) {
    const contents = fs.readdirSync(path.normalize(dir), {withFileTypes: true});
    const parentName = options.parent ? (options.parent + "/") : "";

    for (const item of contents) {
        if (item.isDirectory()) {
            loadTemplates(target, path.resolve(dir, item.name), {
                ...options,
                parent: parentName + item.name
            });
            continue;
        }

        if (path.extname(item.name) !== ".hbs") continue;

        const templateName = parentName + path.basename(item.name, ".hbs");
        let templateText = fs.readFileSync(path.resolve(dir, item.name), "utf-8");

        Object.defineProperty(target, templateName, {
            value: hbCompile(templateText, options.hbOptions),
            writable: false
        });
    }
}
