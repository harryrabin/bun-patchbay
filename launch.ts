import mainBay from "./bay"
import {Router} from "./lib/patchbay";

const baseURL = "http://localhost:3000";

function __pbRoute(req: Request): Response {
    const rte = req.url.replace(baseURL, "");
    for (let p of patches) if (p.route.test(rte)) return p.__send(req);
    return new Response("illegal route", {status: 400});
}

const server = Bun.serve({
    port: 3000,
    fetch(req: Request): Response {
        return __pbRoute(req);
    }
});

console.log(`Server started on port ${server.port}`);
