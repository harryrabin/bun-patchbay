// Local
type RouteInput = string | RegExp;
enum RouteInputType {
    Patch,
    Router
}

function parseRoute(route: RouteInput, routeType: RouteInputType): RegExp {
    if (route instanceof RegExp) return route;

    let _temp = route.replace(/\/$/, "/?$");
    switch (routeType) {
        case RouteInputType.Patch:
            return new RegExp(_temp)
        default:
            return null
    }
}

// Exports

export class PBRequest {
    private readonly __raw: Request;
    readonly url: string;

    constructor(req: Request, overrideURL?: string) {
        this.__raw = req;
        this.url = overrideURL || req.url
    }

    getRaw(): Request {
        return this.__raw.clone()
    }
}

export interface Patchable {
    readonly route: RegExp;
    __send(req: PBRequest): Response;
}

export abstract class Patch implements Patchable {
    readonly route: RegExp;
    failedEntryResponse: Response = new Response(null, {status: 400})

    constructor(route: RouteInput) {
        this.route = parseRoute(route, RouteInputType.Patch)
    }

    abstract entry(req: PBRequest);
    abstract exit(): Response;
    __send(req: PBRequest): Response {
        try {
            this.entry(req);
        } catch (e) {
            if (e instanceof FailedEntry) return this.failedEntryResponse.clone();
            else throw e;
        }
        return this.exit()
    }
}

export class StaticPatch {

}

export type RedirectOptions = {
    route: RouteInput,
    to: string
}

export abstract class Router implements Patchable {
    readonly route: RegExp;
    abstract readonly patches: Patchable[];
    abstract readonly defaultResponse: Response;

    protected constructor(route: RouteInput) {
        this.route = parseRoute(route, RouteInputType.Router)
    }

    __send(req: PBRequest): Response {
        const rte = req.url.replace(this.route, "");
        for (let p of this.patches) if (p.route.test(rte)) return p.__send(req);
        return this.defaultResponse.clone();
    }
}

export class FailedEntry extends Error {

}
