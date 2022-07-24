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

export default {
    baseURL: "http://localhost:3000",
    port: 3000,
    patches: [
        new UserPage("/pages{queryString}"),
        new StaticAssetRouter({
            route: "/",
            directory: "./static-content",
            defaultResponse: new Response("404 not found in static", {status: 404})
        })
    ]
}
