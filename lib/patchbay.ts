import * as fs from "fs";
import * as path from "path";

// Utilities

type RouteInput = string | RegExp
function parseRoute(route: RouteInput, router: boolean = false): RegExp {
    if (route instanceof RegExp) return route;
    // let temp = route.replace(/\/$/, "/?$")
    return new RegExp("^" + route + (router ? "" : "$"))
}

type DefaultResponse = Response | (() => Response)
function extractResponse(res: DefaultResponse): Response {
    return res instanceof Response ?
        res.clone() : res()
}

import mimeTypes from "./mime-types";
const mimeExtensions = Object.keys(mimeTypes)

// Exports

export class PBRequest {
    private readonly __raw: Request;
    readonly url: string;

    constructor(req: Request | PBRequest, overrideURL?: string) {
        this.__raw = req instanceof PBRequest ? req.raw() : req
        this.url = overrideURL || req.url
    }

    raw(): Request {
        return this.__raw.clone()
    }
}

export interface Patchable {
    readonly route: RegExp;
    __send(req: PBRequest): Response;
}

export abstract class Patch implements Patchable {
    readonly route: RegExp;
    abstract failedEntryResponse: DefaultResponse

    constructor(route: RouteInput) {
        this.route = parseRoute(route)
    }

    abstract entry(req: PBRequest);
    abstract exit(): Response;
    __send(req: PBRequest): Response {
        try {
            this.entry(req);
        } catch (e) {
            if (e instanceof FailedEntry) return extractResponse(this.failedEntryResponse)
            else throw e;
        }
        return this.exit()
    }
}

export class StaticPatch extends Patch {
    readonly response: DefaultResponse
    constructor(options: {
        route: RouteInput,
        response: DefaultResponse
    }) {
        super(options.route);
        this.response = options.response;
    }

    failedEntryResponse = null;
    entry(req: PBRequest) {}
    exit(): Response {return extractResponse(this.response)}
}

export class GlobalRedirect extends Patch {
    private readonly to: string;
    constructor(route: RouteInput, to: string) {
        super(route);
        this.to = to;
    }

    failedEntryResponse = null
    entry(req: PBRequest) {}
    exit(): Response {
        return Response.redirect(this.to)
    }
}

export class LocalRedirect extends Patch {
    private readonly to: string;
    private context: string;

    constructor(route: RouteInput, to: string) {
        super(route);
        this.to = to;
    }

    failedEntryResponse = null;
    entry(req: PBRequest) {
        this.context = req.raw().url.replace(PB_baseURL, "")
    }
    exit(): Response {
        return Response.redirect(this.context.replace(/\/[^\/]*$/, this.to))
    }
}

export abstract class Router implements Patchable {
    readonly route: RegExp;
    abstract readonly patches: Patchable[];
    abstract readonly defaultResponse: Response | (() => Response);

    constructor(route: RouteInput) {
        this.route = parseRoute(route, true)
    }

    __send(req: PBRequest): Response {
        const rte = req.url.replace(this.route, "");
        for (let p of this.patches) if (p.route.test(rte))
            return p.__send(new PBRequest(req, rte));

        return extractResponse(this.defaultResponse)
    }
}

export class StaticAssetRouter extends Router {
    readonly patches: Patchable[];
    readonly defaultResponse: DefaultResponse;

    constructor(options: {
        route: RouteInput,
        directory: string,
        defaultResponse: DefaultResponse
    }) {
        super(options.route);
        this.defaultResponse = options.defaultResponse

        let patches: Patchable[] = []
        const dirContents = fs.readdirSync(options.directory, {withFileTypes: true});
        for (let item of dirContents) {
            if (item.isDirectory()) {
                patches.push(new StaticAssetRouter({
                    route: '/' + item.name,
                    directory: path.join(options.directory, item.name),
                    defaultResponse: options.defaultResponse
                }));
                continue;
            }

            const itemExtname = path.extname(item.name)

            let patchHeaders = {}
            if (mimeExtensions.includes(itemExtname)) {
                // patchHeaders["Content-Disposition"] = `inline; filename="${item.name}"`;
                patchHeaders["Content-Type"] = mimeTypes[itemExtname];
            }
            patches.push(new StaticPatch({
                route: `/${item.name}`,
                response: new Response(Bun.file(path.join(options.directory, item.name)), {
                    headers: patchHeaders
                })
            }));

            if (itemExtname === ".html") patches.push(new LocalRedirect(
                '/' + path.basename(item.name, ".html"),
                '/' + item.name
            ));

            if (item.name === "index.html") patches.push(new LocalRedirect("/", "/index.html"));
        }

        this.patches = patches;
    }
}

export class FailedEntry extends Error {

}
