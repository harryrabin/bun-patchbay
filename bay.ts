import {Patch, PBRequest} from "./lib/patchbay";

class Index extends Patch {
    entry(req: PBRequest) {}
    exit(): Response {
        return new Response(Bun.file("./index.html"))
    }
}

class Login extends Patch {
    entry(req: PBRequest) {}
    exit(): Response {
        return new Response(Bun.file("./login.html"))
    }
}

export default [
    new Index("/"),
    new Login("/login")
]
