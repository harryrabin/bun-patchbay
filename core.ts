/* Copyright (C) 2022 Harrison Rabin

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>. */

import * as fs from "fs";
import * as path from "path";
import {Mutex} from "async-mutex";
import mimeTypes from "./mime-types";
import {RedisClient} from "bun-redis-bindings";
import {v4 as uuid} from "uuid";
import {PBApp} from "./index";

export type ParameterStore = Record<string, string | undefined>

export type DefaultResponse = Response | (() => Response);

export function extractResponse(res: DefaultResponse): Response {
    return res instanceof Response ? res.clone() : res();
}

export interface PBRequestOptions {
    url?: string,
    app?: PBApp
}

export class PBRequest extends Request {
    // @ts-ignore
    readonly PBurl: string = null;
    // @ts-ignore
    readonly app: PBApp = null;

    static ify(req: Request, options: PBRequestOptions = {}): PBRequest {
        const base = req.clone();
        Object.defineProperty(base, "PBurl", {
            value: options.url || req.url,
            writable: false
        });
        Object.defineProperty(base, "app", {
            value: options.app || PatchBay,
            writable: false
        });
        return base as PBRequest;
    }
}

export class Route {
    private static readonly paramRegExp = /\{([^}]+)}/gi;

    readonly str: string;
    readonly re: RegExp;
    readonly parameterNames: string[] = [];

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
                for (const match of paramMatches) this.parameterNames.push(match[1]);
            }

            const formattedRoute = route
                .replace("{queryString}", "(?:\\?(.+))?")
                .replace(Route.paramRegExp, "([^?/]+)");
            this.re = new RegExp("^" + formattedRoute + "/$", "i");
        }
    }
}

export interface Patchable {
    readonly route: Route;

    fetch(req: PBRequest): Promise<Response>;
}

export interface SessionHandlerOptions {
    url?: string;
    init?: boolean;
}

export class SessionHandler {
    // @ts-ignore
    private redis: RedisClient = null;
    private readonly redisURL: string;

    constructor(options: SessionHandlerOptions = {}) {
        this.redisURL = options.url || "";
        if (options.init !== false) this.connect();
    }

    connect() {
        if (this.redis) {
            this.redis.reconnect();
            return;
        }
        this.redis = new RedisClient(this.redisURL);
    }

    getSession(req: Request, initField: string, initValue: string): Session {
        let id: string = CookieHandler.parse(req)?.["session"] || uuid();

        // the switch fallthrough is intentional!!
        const redisType = this.redis.cmdTYPE(id);
        switch (redisType) {
            case "none":
                this.redis.cmdHSET(id, initField, initValue);
            case "hash":
                return new Session(this.redis.cmdHGETALL(id) as ParameterStore, id, this.redis);
            default:
                throw new SessionError(`PatchBay: session key exists, but under wrong type {${redisType}}`)
        }
    }
}

export class Session {
    private cache: ParameterStore;

    constructor(source: ParameterStore,
                public readonly id: string,
                private readonly redis: RedisClient) {
        this.cache = {...source};
    }

    set(key: string, value: string) {
        this.cache[key] = value;
    }

    get(key: string): string | undefined {
        return this.cache[key]
    }

    save() {
        for (const key in this.cache) {
            this.redis.cmdHSET(this.id, key, this.cache[key] as string)
        }
    }
}

export class SessionError extends Error {
    constructor(msg: string) {
        super(msg);
    }
}

export interface CookieAttributes {
    expires?: Date | number | string;
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

    static parse(source: Request): ParameterStore | null {
        let out: ParameterStore = {};

        const rawHeader = source.headers.get("cookie");
        if (!rawHeader) return null;

        const cookies = rawHeader.split("; ").map($ => $.split("="));
        for (const cookie of cookies) {
            if (cookie.length !== 2) continue;
            out[cookie[0]] = cookie[1];
        }

        return out;
    }

    init(source: Request) {
        const origin = CookieHandler.parse(source);
        if (!origin) return;

        this.origin = origin;
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

        this.guts[key] = CookieHandler.addAttributes(value, attributes);
    }

    unset(key: string) {
        if (!this.guts[key]) return;
        this.guts[key] = 'undefined; Expires=Sat, 01 Jan 2000 00:00:00 GMT'
    }

    stringify(options: {
        secure?: boolean;
    } = {}): string | undefined {
        let out: ParameterStore | undefined = undefined;

        for (const key in this.guts) {
            if (this.guts[key] !== this.origin[key]) {
                out = {};
            }
        }
        if (!out) return undefined;

        for (const key in this.guts) {
            if (this.guts[key] !== this.origin[key]) {
                out[key] = this.guts[key];
            }
        }
        const secure = options.secure !== undefined ? options.secure : true;
        let outString = JSON.stringify(out);
        if (secure) outString += "; Secure";
        return outString;
    }

    __reset() {
        this.guts = {};
        this.origin = {};
    }

    static strip(cookie: string): string | undefined {
        let matches = cookie.match(/^[^;]+/);
        if (!matches) return;
        if (matches?.length < 1) return;
        return matches[0];
    }

    private static addAttributes(cookie: string, attributes: CookieAttributes): string {
        let out = cookie;

        if (attributes.expires instanceof Date) {
            out += `; Expires=${attributes.expires.toUTCString()}`;
        } else if (typeof attributes.expires == "number") {
            out += `; Expires=${new Date(attributes.expires).toUTCString()}`
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

        return out;
    }
}

export abstract class Patch<Data = void> implements Patchable {
    readonly route: Route;

    routeParameters: ParameterStore = {};
    queryStringParameters: ParameterStore = {};

    // @ts-ignore
    readonly __pbRequest: PBRequest = null;
    readonly cookies = new CookieHandler();

    // @ts-ignore
    readonly app: PBApp = null;

    private sendMutex = new Mutex();

    constructor(route: string) {
        this.route = new Route(route, "patch");
    }

    intercept(req: Request): boolean | Promise<boolean> {
        return false;
    }

    __safe_intercept(req: Request): Promise<boolean> {
        return this.sendMutex.runExclusive(() => {
            this.reset();
            return this.intercept(req)
        });
    }

    abstract entry(req: Request): Data | Promise<Data>;

    abstract exit(data: Data): Response | Promise<Response>;

    fetch(req: PBRequest): Promise<Response> {
        return this.sendMutex.runExclusive(async () => {
            this.reset();
            Object.defineProperty(this, "__pbRequest", {
                value: req,
                writable: false
            });
            Object.defineProperty(this, "app", {
                value: req.app,
                writable: false
            });

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

    parseRouteParams() {
        const urlMatches = this.__pbRequest.PBurl.match(this.route.re);
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

export class StaticPatch implements Patchable {
    readonly route: Route;
    private readonly response: DefaultResponse;

    constructor(options: {
        route: string,
        response: DefaultResponse
    }) {
        this.route = new Route(options.route, "patch");
        this.response = options.response;
    }

    fetch(_: PBRequest): Promise<Response> {
        return Promise.resolve(extractResponse(this.response))
    }
}

export class GlobalRedirect implements Patchable {
    readonly route: Route;

    constructor(route: string, private readonly to: string) {
        this.route = new Route(route, "patch");
    }

    fetch(req: PBRequest): Promise<Response> {
        return Promise.resolve(Response.redirect(this.to))
    }
}

export class LocalRedirect implements Patchable {
    readonly route: Route;
    private readonly filter: RegExp;

    constructor(route: string, private readonly to: string) {
        this.route = new Route(route, "patch");
        this.filter = new RegExp(route + (route === "/" ? "$" : "/$"));
    }

    fetch(req: PBRequest): Promise<Response> {
        let out = req.url;
        if (out.at(-1) !== "/") out += "/";
        out = out.replace(this.filter, this.to);
        return Promise.resolve(Response.redirect(out));
    }
}

export abstract class Router implements Patchable {
    readonly route: Route;
    abstract readonly patches: Patchable[];

    abstract readonly entryModifiers: Modifiers.Entry[];
    abstract readonly exitModifiers: Modifiers.Exit[];

    constructor(route: string) {
        this.route = new Route(route, "router");
    }

    async fetch(req: PBRequest): Promise<Response> {
        let rte = req.PBurl.replace(this.route.re, "");
        if (rte === "") rte = "/";

        const matchedPatchables = this.patches.filter(p => p.route.re.test(rte));
        if (matchedPatchables.length === 0) throw new RouteNotFound();

        let modifiedReq: Request = req;
        for (const mod of this.entryModifiers) {
            try {
                modifiedReq = await mod.fn(modifiedReq);
            } catch (e) {
                if (e instanceof Response) return e;
                throw e;
            }
        }

        let res: Response | undefined;

        for (const patchable of matchedPatchables) {
            if (patchable instanceof Patch
                && await patchable.__safe_intercept(req)) continue;
            try {
                res = await patchable.fetch(PBRequest.ify(modifiedReq, {
                    url: rte,
                    app: req.app,
                }));
                break;
            } catch (e) {
                if (!(e instanceof RouteNotFound)) throw e;
            }
        }
        if (!res) throw new RouteNotFound();

        for (const mod of this.exitModifiers) {
            res = await mod.fn(res);
        }
        return res;
    }
}

export class QuickRouter extends Router {
    readonly patches: Patchable[];
    readonly entryModifiers: Modifiers.Entry[];
    readonly exitModifiers: Modifiers.Exit[];

    constructor(route: string, patches: Patchable[], options: {
        entryModifiers?: Modifiers.Entry[];
        exitModifiers?: Modifiers.Exit[];
    } = {}) {
        super(route);

        this.patches = patches;

        this.entryModifiers = options.entryModifiers || [];
        this.exitModifiers = options.exitModifiers || [];
    }
}

export class StaticAssetRouter extends Router {
    readonly patches: Patchable[] = [];

    readonly entryModifiers;
    readonly exitModifiers;

    constructor(route: string, directory: string, options: {
        customPatches?: Patchable[]
        entryModifiers?: Modifiers.Entry[];
        exitModifiers?: Modifiers.Exit[];
    } = {}) {
        super(route);

        this.entryModifiers = options.entryModifiers || [];
        this.exitModifiers = options.exitModifiers || [];

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
    constructor() {
        super("PatchBay: route not found");
    }
}

export namespace Modifiers {
    export abstract class Entry {
        readonly cookies = new CookieHandler();

        abstract fn(req: Request): Request | Promise<Request>;
    }

    export abstract class Exit {
        abstract fn(res: Response): Response | Promise<Response>
    }
}
