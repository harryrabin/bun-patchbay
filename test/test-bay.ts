import * as PB from "..";
import {StaticPatch} from "..";

const AdminRouter = new PB.QuickRouter("/admin", [
    new StaticPatch({
        route: "/home",
        response: new Response("admin home")
    }),
    new StaticPatch({
        route: "/login",
        response: new Response("admin login")
    })
]);

const mainBay: PB.MainBay = {
    baseURL: "https://example.com",
    port: 443,
    patches: [
        AdminRouter
    ]
}

export default mainBay;
