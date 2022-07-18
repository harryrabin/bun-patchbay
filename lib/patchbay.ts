// Local
type RouteInput = string | RegExp;
function parseRoute(route: RouteInput): RegExp {
    if (route instanceof RegExp) return route;

    let temp = route.replace(/\/$/, "/?$");
    return new RegExp("^" + temp)
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

export interface Patchable {
    readonly route: RegExp;
    __send(req: PBRequest): Response;
}

export abstract class Patch implements Patchable {
    readonly route: RegExp;
    abstract failedEntryResponse: Response

    constructor(route: RouteInput) {
        this.route = parseRoute(route)
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

export class StaticPatch extends Patch {
    readonly response: Response
    constructor(options: {
        route: RouteInput,
        response: Response
    }) {
        super(options.route);
        this.response = options.response;
    }

    failedEntryResponse = null;
    entry(req: PBRequest) {}
    exit(): Response {return this.response.clone()}
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

// export class LocalRedirect extends Patch {
//     protected readonly to: string;
//     protected context: string;
//     constructor(route: RouteInput, to: string) {
//         super(route);
//         this.to = to;
//     }
//
//     failedEntryResponse = null;
//     entry(req: PBRequest) {
//         this.context = req.url
//     }
//     exit(): Response {
//         let temp = this.context.replace(/\/?[^\/]*$/, this.to);
//     }
// }

export abstract class Router implements Patchable {
    readonly route: RegExp;
    abstract readonly patches: Patchable[];
    abstract readonly defaultResponse: Response;

    constructor(route: RouteInput) {
        this.route = parseRoute(route)
    }

    __send(req: PBRequest): Response {
        const rte = req.url.replace(this.route, "");
        for (let p of this.patches) if (p.route.test(rte))
            return p.__send(new PBRequest(req, rte));
        return this.defaultResponse.clone();
    }
}

export class FailedEntry extends Error {

}
