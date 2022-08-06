import {mergeWith} from "lodash";
import {Server, ServeOptions} from "bun";
import {DefaultResponse, Patchable, PBRequest, Router} from "./core";

export * from './core';

declare global {
    const PatchBay: PBApp;
    const Templates: Record<string, HandlebarsTemplateDelegate>;
}

export interface MainBay {
    baseURL: string;
    port: number;
    patches: Patchable[];
    defaultResponse?: DefaultResponse;
}

export interface PBAppOptions {
    skipGlobals?: boolean;
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

        if (options.skipGlobals) return;
        Object.defineProperty(global, "PatchBay", {
            value: this,
            writable: false
        });
        Object.defineProperty(global, "Templates", {
            value: {},
            writable: false
        })
    }

    serve(options?: ServeOptions): Server {
        const _this = this;
        let opt = {
            port: _this.mainBay.port,
            fetch(req: Request): Promise<Response> {
                let overrideURL = req.url;
                if (overrideURL.at(-1) !== '/') overrideURL += '/';
                return _this.mainRouter.fetch(new PBRequest(req, overrideURL));
            }
        }

        if (options) mergeWith(opt, options, (obj, src, key) => {
            if (key === 'port' || key === 'fetch') return obj[key];
        });

        const server = Bun.serve(opt);
        console.log(`Server started on port ${server.port}`);
        return server;
    }
}
