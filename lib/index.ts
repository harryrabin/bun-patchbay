import * as nunjucks from "nunjucks";
import * as _ from "lodash";
import {Server, ServeOptions} from "bun";
import {DefaultResponse, Patchable, PBRequest, Router} from "./core";

export * from './core';

declare global {
    const PatchBay: PBApp;
    const PB_port: number;
    const PB_baseURL: string;
    const nunjucks: nunjucks.Environment;
}

export interface MainBay {
    baseURL: string;
    port: number;
    patches: Patchable[];
    defaultResponse?: DefaultResponse;
}

export interface PBAppOptions {
    baseURL: string;
    port: number;
    mainRouter: Router;
    viewDirectory?: string;
    nunjucksConfig?: nunjucks.ConfigureOptions;
}

export class PBApp {
    private readonly mainRouter: Router;

    constructor(options: PBAppOptions) {
        this.mainRouter = options.mainRouter;

        Object.defineProperty(global, "PatchBay", {
            value: this,
            writable: false
        });
        Object.defineProperty(global, "PB_port", {
            value: options.port,
            writable: false
        })
        Object.defineProperty(global, "PB_baseURL", {
            value: options.baseURL,
            writable: false
        })
        Object.defineProperty(global, "nunjucks", {
            value: nunjucks.configure(options.viewDirectory || "./views", options.nunjucksConfig),
            writable: false
        });
    }

    serve(options?: ServeOptions): Server {
        let opt = {
            port: PB_port,
            fetch: this.fetch
        }

        if (options) _.merge(opt, options);

        const server = Bun.serve(opt);
        console.log(`Server started on port ${server.port}`);
        return server;
    }

    private fetch(req: Request): Promise<Response> {
        let overrideURL = req.url;
        if (overrideURL.at(-1) !== '/') overrideURL += '/';
        return this.mainRouter.fetch(new PBRequest(req, overrideURL));
    }
}
