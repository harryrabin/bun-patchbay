import * as fs from "fs";
import * as path from "path";

// Utilities
import mimeTypes from "./mime-types";

type DefaultResponse = Response | (() => Response);

function extractResponse(res: DefaultResponse): Response {
    return res instanceof Response ? res.clone() : res()
}

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

export class Route {
    private static readonly paramRegExp = /\{([^}]+)}/gi;

    readonly str: string;
    readonly re: RegExp;
    readonly routeParameterNames: string[] = [];

    constructor(route: string, routeType: "patch" | "router") {
        this.str = route;

        if (routeType === "router") {
            if (route === "/") this.re = new RegExp("^(?=.*/$)", "i");
            else this.re = new RegExp("^" + route + "(?=.*/$)", "i");
            return;
        }

        if (route === "/") this.re = new RegExp("^/$", "i");
        else {
            const paramMatches = route.matchAll(Route.paramRegExp);
            if (paramMatches != null) {
                this.routeParameterNames = [];
                for (const match of paramMatches) this.routeParameterNames.push(match[1]);
            }

            const formattedRoute = route.replace(Route.paramRegExp, "(.+)");
            this.re = new RegExp("^" + formattedRoute + "/$", "i");
        }
    }
}

export interface Patchable {
    readonly route: Route;

    __send(req: PBRequest): Response;
}

export abstract class Patch implements Patchable {
    readonly route: Route;
    readonly failedEntryResponse?: DefaultResponse
    routeParameters: Record<string, string> = {};
    queryStringParameters: Record<string, string> = {};

    constructor(route: string) {
        this.route = new Route(route, "patch")
    }

    abstract entry(req: PBRequest): void;

    abstract exit(): Response;

    __send(req: PBRequest): Response {
        try {
            this.entry(req);
        } catch (e) {
            if (e instanceof FailedEntry) {
                if (this.failedEntryResponse) return extractResponse(this.failedEntryResponse)
                else throw e;
            }
            else throw e;
        }
        return this.exit()
    }

    // TODO
    // parseQueryString(query: string): object {
    //     let output = {}
    // }

    parseRouteParams(url: string) {
        this.routeParameters = {}
        const urlMatches = url.match(this.route.re);
        if (!urlMatches || urlMatches.length <= 1) return;
        for (let i = 0; i < this.route.routeParameterNames.length; i++) {
            this.routeParameters[this.route.routeParameterNames[i]] = urlMatches[i + 1]
        }
    }
}

export class StaticPatch extends Patch {
    readonly response: DefaultResponse;

    constructor(options: {
        route: string,
        response: DefaultResponse
    }) {
        super(options.route);
        this.response = options.response;
    }

    entry(req: PBRequest) {
    }

    exit(): Response {
        return extractResponse(this.response)
    }
}

export class GlobalRedirect extends Patch {
    private readonly to: string;

    constructor(route: string, to: string) {
        super(route);
        this.to = to;
    }

    entry(req: PBRequest) {
    }

    exit(): Response {
        return Response.redirect(this.to)
    }
}

export class LocalRedirect extends Patch {
    private readonly to: string;
    private readonly filter: RegExp;
    private finalTo = "";

    constructor(route: string, to: string) {
        super(route);
        this.filter = new RegExp(route + (route === "/" ? "$" : "/$"))
        this.to = to;
    }

    entry(req: PBRequest) {
        this.finalTo = req.raw().url;
        if (this.finalTo.slice(-1) !== "/") this.finalTo += "/";
        this.finalTo = this.finalTo.replace(this.filter, this.to);
    }

    exit(): Response {
        return Response.redirect(this.finalTo)
    }
}

export abstract class Router implements Patchable {
    readonly route: Route;
    abstract readonly patches: Patchable[];
    abstract readonly defaultResponse?: DefaultResponse;

    constructor(route: string) {
        this.route = new Route(route, "router");
    }

    __send(req: PBRequest): Response {
        let rte = req.url.replace(this.route.re, "");
        if (rte === "") rte = "/";
        for (let p of this.patches) if (p.route.re.test(rte)) {
            try {
                return p.__send(new PBRequest(req, rte));
            } catch (e) {
                if (!(e instanceof RouteNotFound)) throw e;
            }
        }
        if (this.defaultResponse) return extractResponse(this.defaultResponse);
        else throw new RouteNotFound();
    }
}

export class StaticAssetRouter extends Router {
    readonly patches: Patchable[] = [];
    readonly defaultResponse?: DefaultResponse;

    constructor(route: string, directory: string, options: {
        defaultResponse?: DefaultResponse,
        excludeFiles?: string[],
        customPatches?: Patchable[]
    } = {}) {
        super(route);
        this.defaultResponse = options.defaultResponse;

        const excludeFiles = options.excludeFiles || [];
        const dirContents = fs.readdirSync(directory, {withFileTypes: true});
        for (let item of dirContents) {
            if (excludeFiles.includes(item.name)) continue;

            if (item.isDirectory()) {
                this.patches.push(
                    new StaticAssetRouter('/' + item.name, path.join(directory, item.name), {
                        defaultResponse: this.defaultResponse
                }));
                continue;
            }

            const itemExtname = path.extname(item.name)

            this.patches.push(new StaticPatch({
                route: `/${item.name}`,
                response: new Response(Bun.file(path.join(directory, item.name)), {
                    headers: {
                        "Content-Type": itemExtname in mimeTypes ?
                            mimeTypes[itemExtname] : "application/octet-stream"
                    }
                }),
            }));

            if (itemExtname === ".html") this.patches.push(new LocalRedirect(
                '/' + path.basename(item.name, ".html"),
                '/' + item.name
            ));

            if (item.name === "index.html") this.patches.push(new LocalRedirect("/", "/index.html"));
        }

        if (options.customPatches) this.patches.push(...options.customPatches);
    }
}

export class FailedEntry extends Error {

}

export class RouteNotFound extends Error {

}
