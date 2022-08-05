import {mergeWith} from "lodash";
import {Server, ServeOptions} from "bun";
import {DefaultResponse, Patchable, PBRequest, Router} from "./core";

export * from './core';

declare global {
    const PatchBay: PBApp;
    const PB_port: number;
    const PB_baseURL: string;
}

export interface MainBay {
    baseURL: string;
    port: number;
    patches: Patchable[];
    defaultResponse?: DefaultResponse;
}

export interface PBAppOptions {
    mainBay: MainBay;
    skipGlobals?: boolean;
}

export class PBApp {
    readonly mainRouter: Router;
    readonly mainBay: MainBay;

    constructor(options: PBAppOptions) {
        this.mainBay = options.mainBay;

        this.mainRouter = new class extends Router {
            patches = options.mainBay.patches;
            defaultResponse = options.mainBay.defaultResponse ||
                new Response("404: not found", {status: 404});
        }(options.mainBay.baseURL);

        if (options.skipGlobals) return;
        Object.defineProperty(global, "PatchBay", {
            value: this,
            writable: false
        });
        Object.defineProperty(global, "PB_port", {
            value: options.mainBay.port,
            writable: false
        })
        Object.defineProperty(global, "PB_baseURL", {
            value: options.mainBay.baseURL,
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
