import {Patch, PBRequest, StaticAssetRouter} from "./lib/patchbay";

class UserPage extends Patch {
    entry(req: PBRequest) {
        this.parseRouteParams(req.url);
        this.parseQueryString();
    }

    exit(): Response {
        return new Response("");
    }
}

export default {
    baseURL: "http://localhost:3000",
    port: 3000,
    patches: [
        new StaticAssetRouter("/","./static-content"),
        new UserPage("/{user}?{queryString}")
    ]
}
