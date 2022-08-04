import {Router, PBApp} from "./lib";
import mainBay from "./bay";

class MainRouter extends Router {
    patches = mainBay.patches
    defaultResponse = mainBay.defaultResponse
        || new Response("404: not found", {status: 404})
}

let app = new PBApp({
    mainRouter: new MainRouter(mainBay.baseURL),
    baseURL: mainBay.baseURL,
    port: mainBay.port
});

app.serve()
