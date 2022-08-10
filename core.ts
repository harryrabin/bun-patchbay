/* Copyright (C) 2022 Harrison Rabin

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>. */

import * as fs from "fs";
import * as path from "path";
import {Mutex} from "async-mutex";
import mimeTypes from "./mime-types";

export type ParameterStore = Record<string, string | undefined>

export type DefaultResponse = Response | (() => Response);

function extractResponse(res: DefaultResponse): Response {
    return res instanceof Response ? res.clone() : res();
}

export class PBRequest {
    private readonly _raw: Request;
    readonly url: string;

    constructor(req: Request | PBRequest, overrideURL?: string) {
        this._raw = req instanceof PBRequest ? req.raw() : req;
        this.url = overrideURL || req.url;
    }

    raw(): Request {
        return this._raw.clone();
    }
}

export class Route {
    private static readonly paramRegExp = /\{([^}]+)}/gi;

    // readonly str: string;
    readonly re: RegExp;
    readonly parameterNames: string[] = [];

    constructor(route: string, routeType: "patch" | "router") {
        // this.str = route;

        if (routeType === "router") {
            if (route === "/") this.re = new RegExp("^(?=.*/$)", "i");
            else this.re = new RegExp("^" + route + "(?=.*/$)", "i");
            return;
        }

        if (route === "/") this.re = new RegExp("^/$", "i");
        else {
            const paramMatches = route.matchAll(Route.paramRegExp);
            if (paramMatches != null) {
                for (const match of paramMatches) this.parameterNames.push(match[1]);
            }

            const formattedRoute = route
                .replace("{queryString}", "(?:\\?(.+))?")
                .replace(Route.paramRegExp, "([^?]+)");
            this.re = new RegExp("^" + formattedRoute + "/$", "i");
        }
    }
}

export interface Patchable {
    readonly route: Route;

    fetch(req: PBRequest): Promise<Response>;
}

export interface CookieAttributes {
    expires?: Date | string;
    max_age?: number;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "strict" | "lax" | "none";
}

export class CookieHandler {
    private guts: ParameterStore = {};
    private origin: ParameterStore = {};

    init(source: PBRequest) {
        const rawHeader = source.raw().headers.get("cookie");
        if (!rawHeader) return;

        const cookies = rawHeader.split("; ").map($ => $.split("="));
        for (const cookie of cookies) {
            if (cookie.length !== 2) continue;
            this.origin[cookie[0]] = cookie[1];
        }
        this.guts = {...this.origin};
    }

    get(key: string): string | undefined {
        return this.guts[key];
    }

    set(key: string, value: string, attributes?: CookieAttributes) {
        if (!attributes) {
            this.guts[key] = value;
            return;
        }

        let out = value;

        if (attributes.expires instanceof Date) {
            out += `; Expires=${attributes.expires.toUTCString()}`;
        } else if (typeof attributes.expires === "string") {
            out += `; Expires=${attributes.expires}`;
        }

        if (attributes.max_age) out += `; Max-Age=${attributes.max_age}`;

        if (attributes.domain) out += `; Domain=${attributes.domain}`;

        if (attributes.path) out += `; Path=${attributes.path}`;

        let secure = attributes.secure;

        switch (attributes.sameSite) {
            case undefined:
                break;
            case "strict":
                out += "; SameSite=Strict";
                break;
            case "lax":
                out += "; SameSite=Lax";
                break;
            case "none":
                out += "; SameSite=None"
                secure = true;
                break;
        }

        if (secure === true) out += "; Secure";

        if (attributes.httpOnly === true) out += "; HttpOnly";

        this.guts[key] = out;
    }

    unset(key: string) {
        if (!this.guts[key]) return;
        this.guts[key] = '"";Expires=Sat, 01 Jan 2000 00:01:00 GMT'
    }

    stringify(): string | undefined {
        // if (isEqual(this.origin, this.guts)) return undefined;
        let equal = true;
        for (const key in this.guts) {
            if (this.guts[key] !== this.origin[key]){
                equal = false;
                break;
            }
        }
        return equal ? undefined : JSON.stringify(this.guts);
    }

    __reset() {
        this.guts = {};
        this.origin = {};
    }
}

export abstract class Patch<Data = void> implements Patchable {
    readonly route: Route;

    routeParameters: ParameterStore = {};
    queryStringParameters: ParameterStore = {};

    readonly cookies = new CookieHandler();

    private sendMutex = new Mutex();

    constructor(route: string) {
        this.route = new Route(route, "patch");
    }

    // intercept(req: PBRequest): "continue" | "return" {
    //     return "continue";
    // }

    intercept?: ((req: PBRequest) => "continue" | "return") = undefined;

    abstract entry(req: PBRequest): Data | Promise<Data>;

    abstract exit(data: Data): Response | Promise<Response>;

    fetch(req: PBRequest): Promise<Response> {
        return this.sendMutex.runExclusive(async () => {
            this.reset();
            let data: Data;
            try {
                data = await this.entry(req);
            } catch (e) {
                if (e instanceof Response) return e;
                else throw e;
            }
            return this.exit(data);
        });
    }

    parseRouteParams(req: PBRequest) {
        const urlMatches = req.url.match(this.route.re);
        if (!urlMatches || urlMatches.length < 2) return;
        for (let i = 0; i < this.route.parameterNames.length; i++) {
            this.routeParameters[this.route.parameterNames[i]] = urlMatches[i + 1];
        }

        if (!this.routeParameters.queryString) return;
        const entries = this.routeParameters.queryString
            .split("&")
            .map($ => $.split("="));
        for (const e of entries) {
            if (e.length !== 2) continue;
            if (e[0] === "") continue;
            this.queryStringParameters[e[0]] = e[1];
        }
    }

    private reset() {
        this.cookies.__reset();
        this.queryStringParameters = {};
        this.routeParameters = {}
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
        this.filter = new RegExp(route + (route === "/" ? "$" : "/$"));
        this.to = to;
    }

    entry(req: PBRequest) {
        this.finalTo = req.raw().url;
        if (this.finalTo.at(-1) !== "/") this.finalTo += "/";
        this.finalTo = this.finalTo.replace(this.filter, this.to);
    }

    exit(): Response {
        return Response.redirect(this.finalTo);
    }
}

export abstract class Router implements Patchable {
    readonly route: Route;
    abstract readonly patches: Patchable[];

    constructor(route: string) {
        this.route = new Route(route, "router");
    }

    private getFinalPatchable(path: string, req: PBRequest): [Patchable, string] | null {
        let rte = path.replace(this.route.re, "");
        if (rte === "") rte = "/";

        const matchedPatchables = this.patches.filter($ => $.route.re.test(rte));
        if (matchedPatchables.length == 0) return null;

        let out: [Patchable, string] | null = null;

        for (const patchable of matchedPatchables) {
            if (patchable instanceof Router) {
                const final = patchable.getFinalPatchable(rte, req);
                if (final) {
                    out = final;
                    break;
                }
                continue;
            }
            out = [patchable, rte];
            break;
        }

        if (out !== null
            && out[0] instanceof Patch
            && out[0].intercept
            && out[0].intercept(req) === "return")
            out = null;

        return out;
    }

    async fetch(req: PBRequest): Promise<Response> {
        let finalPatchable: [Patchable, string] | null;
        try {
            finalPatchable = this.getFinalPatchable(req.url, req)
        } catch (e) {
            if (e instanceof Response) return e;
            else throw e;
        }

        if (!finalPatchable) throw new RouteNotFound();

        return finalPatchable[0].fetch(new PBRequest(req, finalPatchable[1]));
    }
}

export class StaticAssetRouter extends Router {
    readonly patches: Patchable[] = [];

    constructor(route: string, directory: string, options: {
        customPatches?: Patchable[]
    } = {}) {
        super(route);

        const dirContents = fs.readdirSync(directory, {withFileTypes: true});
        for (const item of dirContents) {
            if (item.isDirectory()) {
                this.patches.push(
                    new StaticAssetRouter("/" + item.name, path.join(directory, item.name)));
                continue;
            }

            const itemExtname = path.extname(item.name);

            this.patches.push(new StaticPatch({
                route: "/" + item.name,
                response: new Response(Bun.file(path.join(directory, item.name)), {
                    headers: {
                        "Content-Type": mimeTypes[itemExtname] || "application/octet-stream"
                    }
                })
            }));

            if (itemExtname === ".html") this.patches.push(new LocalRedirect(
                "/" + path.basename(item.name, ".html"),
                "/" + item.name
            ));

            if (item.name === "index.html") this.patches.push(new LocalRedirect("/", "/index.html"));
        }

        if (options.customPatches) this.patches.push(...options.customPatches);
    }
}

export class RouteNotFound extends Error {

}
