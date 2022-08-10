/* Copyright (C) 2022 Harrison Rabin

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>. */

import {ServeOptions, Server} from "bun";
import {DefaultResponse, extractResponse, Patchable, PBRequest, QuickRouter, RouteNotFound, Router} from "./core";
import * as hb from "handlebars";
import * as fs from "fs";
import * as path from "path";

export * from './core';
export * as PBUtils from './utilities';

declare global {
    const PatchBay: PBApp;
}

export type PBServeOptions = Omit<ServeOptions, "fetch" | "port" | "error">;

export interface MainBay {
    baseURL: string;
    port: number;
    patches: Patchable[];
    responseNotFound?: DefaultResponse;
    responseError?: DefaultResponse;
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
    readonly handlebars = hb;

    private readonly mainBay: MainBay;

    constructor(mainBay: MainBay, options: PBAppOptions = {}) {
        this.mainBay = mainBay;
        this.port = mainBay.port;
        this.baseURL = mainBay.baseURL;

        this.mainRouter = new QuickRouter(mainBay.baseURL, mainBay.patches);

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
            },
            error(err) {
                if (err instanceof RouteNotFound) {
                    return _this.mainBay.responseNotFound ?
                        extractResponse(_this.mainBay.responseNotFound)
                        : new Response("404: not found", {status:404});
                }

                return _this.mainBay.responseError ?
                    extractResponse(_this.mainBay.responseError)
                    : new Response("500: server error", {status:500});
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
            value: hb.compile(templateText, options.hbOptions),
            writable: false
        });
    }
}
