import mainBay from "./bay"
import {Router, PBRequest} from "./lib/patchbay";

declare global {
    const PB_baseURL: string
    const PB_port: number
}
export const PB_baseURL = mainBay.baseURL;
export const PB_port = mainBay.port;

class MainRouter extends Router {
    patches = mainBay.patches
    defaultResponse = new Response("404 not found", {status: 404})
}
const router = new MainRouter(PB_baseURL)
const server = Bun.serve({
    port: PB_port,
    fetch(req: Request): Response {
        return router.__send(new PBRequest(req));
    }
});

console.log(`Server started on port ${server.port}`);
