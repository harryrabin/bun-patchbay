import mainBay from "./bay"
import {Router, PBRequest} from "./lib/patchbay";

declare global {
    const PB_baseURL: string
    const PB_port: number

    // ==============================
    // Declare any custom globals below here

    // ...
}
// Then initialize them here (don't worry, the ts-ignore usage is safe here)
// @ts-ignore
global.PB_baseURL = mainBay.baseURL;
// @ts-ignore
global.PB_port = mainBay.port;

class MainRouter extends Router {
    patches = mainBay.patches
    defaultResponse = new Response("404: not found", {status: 404})
}

const router = new MainRouter(PB_baseURL)
const server = Bun.serve({
    port: PB_port,
    fetch(req: Request): Promise<Response> {
        let overrideURL = req.url;
        if (overrideURL.at(-1) !== '/') overrideURL += '/';
        return router.__send(new PBRequest(req, overrideURL));
    }
});

console.log(`Server started on port ${server.port}`);
