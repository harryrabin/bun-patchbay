import {Patch, PBRequest, StaticAssetRouter, MainBay} from "./lib";

class UserPage extends Patch {
    entry(req: PBRequest) {
        this.parseRouteParams(req);
        this.cookies.init(req);
        console.log("Route parameters: ", this.routeParameters);
        console.log("Query string parameters: ", this.queryStringParameters);
    }

    exit(): Response {
        return new Response("User homepage for " + this.routeParameters.username);
    }
}

const mainBay: MainBay = {
    baseURL: "http://localhost:3000",
    port: 3000,
    patches: [
        new StaticAssetRouter("/", "./dist"),
        new UserPage("/{username}{queryString}")
    ]
}

export default mainBay;
