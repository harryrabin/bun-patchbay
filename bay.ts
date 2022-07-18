import {StaticPatch, Router, GlobalRedirect} from "./lib/patchbay";

class UserRouter extends Router {
    defaultResponse = new Response("illegal route in /user", {status: 404})
    patches = [
        new StaticPatch({
            route: "/login",
            response: new Response(Bun.file("./static-content/login.html"))
        }),
        new GlobalRedirect("/", "/user/login")
        // TODO: make "new LocalRedirect("/", "/login")" work
    ]
}

export default {
    baseURL: "http://localhost:3000",
    port: 3000,
    patches: [
        new UserRouter("/user"),
        new StaticPatch({
            route: "/",
            response: new Response(Bun.file("./static-content/index.html"))
        })
    ]
}
