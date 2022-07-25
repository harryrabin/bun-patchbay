import {Patch, PBRequest, StaticAssetRouter} from "./lib/patchbay";

class UserPage extends Patch {
    readonly failedEntryResponse = new Response("404 UserPage not found", {status: 404});

    entry(req: PBRequest) {
        this.parseRouteParams(req.url);
    }

    exit(): Response {
        return new Response("User page for " + this.routeParameters.queryString);
    }
}

class CatchallPage extends Patch {
    readonly failedEntryResponse = undefined;

    entry(req: PBRequest) {
        this.parseRouteParams(req.url);
    }

    exit(): Response {
        return new Response("Catchall page for " + this.routeParameters.user)
    }
}

export default {
    baseURL: "http://localhost:3000",
    port: 3000,
    patches: [
        new StaticAssetRouter("/","./static-content"),
        new CatchallPage("/{user}")
    ]
}
