import {mergeWith} from "lodash";
import {Server, ServeOptions} from "bun";
import {DefaultResponse, Patchable, PBRequest, Router} from "./core";
import {compile as hbCompile} from "handlebars";
import * as fs from "fs";
import * as path from "path";

export * from './core';
export * as PBUtils from './utilities';

declare global {
    const PatchBay: PBApp;
    const Templates: { [key: string]: HandlebarsTemplateDelegate };
}

export interface MainBay {
    baseURL: string;
    port: number;
    patches: Patchable[];
    defaultResponse?: DefaultResponse;
}

export interface PBAppOptions {
    skipGlobals?: boolean;
    noHandlebars?: boolean;
    handlebarsOptions?: CompileOptions;
    viewDirectory?: string;
}

export class PBApp {
    readonly mainRouter: Router;
    readonly port: number;
    readonly baseURL: string;

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

        const _this = this;
        (() => {
            if (options.skipGlobals) return;
            Object.defineProperty(global, "PatchBay", {
                value: _this,
                writable: false
            });
            Object.defineProperty(global, "Templates", {
                value: {},
                writable: false
            });
        })();

        const viewDir = options.viewDirectory || "./views";
        if (!options.noHandlebars)
            loadTemplates(viewDir, {hbOptions: options.handlebarsOptions});
    }


    serve(options: Partial<ServeOptions> = {}): Server {
        const _this = this;
        let opt = {
            port: _this.mainBay.port,
            fetch(req: Request): Promise<Response> {
                let overrideURL = req.url;
                if (overrideURL.at(-1) !== '/') overrideURL += '/';
                return _this.mainRouter.fetch(new PBRequest(req, overrideURL));
            }
        }

        mergeWith(opt, options, (obj, src, key) => {
            if (key === 'port' || key === 'fetch') return obj[key];
        });

        const server = Bun.serve(opt);
        console.log(`Server started on port ${server.port}`);
        return server;
    }
}

function loadTemplates(dir: string, options: {
    parent?: string;
    hbOptions?: CompileOptions;
} = {}) {
    const contents = fs.readdirSync(path.normalize(dir), {withFileTypes: true});
    const parentName = options.parent ? (options.parent + "/") : "";

    for (const item of contents) {
        if (item.isDirectory()) {
            loadTemplates(path.resolve(dir, item.name), {
                ...options,
                parent: parentName + item.name
            });
            continue;
        }

        if (path.extname(item.name) !== ".hbs") continue;

        const templateName = parentName + path.basename(item.name, ".hbs");
        let templateText = fs.readFileSync(path.resolve(dir, item.name), "utf-8");

        Templates[templateName] = hbCompile(templateText, options.hbOptions);
    }
}
