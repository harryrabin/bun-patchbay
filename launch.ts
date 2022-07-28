import mainBay from "./bay"
import {Router, PBRequest} from "./lib/patchbay";

declare global {
    const PB_baseURL: string
    const PB_port: number
}
// @ts-ignore
global.PB_baseURL = mainBay.baseURL;
// @ts-ignore
global.PB_port = mainBay.port;

class MainRouter extends Router {
    patches = mainBay.patches
    defaultResponse = new Response("404: not found", {status: 404})
}

const cookies: Record<string, string | undefined> = {
    sessionKey: "3848493",
    defaultLayout: "tiles"
}

const myHeaders = new Headers();
myHeaders.append("Set-Cookie", `__PBCookie=${JSON.stringify(cookies)}`);

const router = new MainRouter(PB_baseURL)
const server = Bun.serve({
    port: PB_port,
    fetch(req: Request): Response {
        let overrideURL = req.url
        if (overrideURL.at(-1) !== '/') overrideURL += '/';
        let res = router.__send(new PBRequest(req, overrideURL));
        res.headers.append("Set-Cookie", `__PBCookie=${JSON.stringify(cookies)}`);
        return res;
    }
});

console.log(`Server started on port ${server.port}`);
