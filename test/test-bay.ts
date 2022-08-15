import * as PB from "..";

class AdminControlAccess extends PB.Modifiers.Entry {
    fn(req: Request): Request {
        throw new Response("403: forbidden", {status: 403});
    }
}

/* this is some tricky edge case testing here. the /controls router could potentially "capture" a request too early
by letting an entry modifier throw a response even though the router contains no matches for the request's route. the
modifiers need to be run ONLY if there is a matched patchable */
const AdminRouter = new PB.QuickRouter("/admin", [
    new PB.QuickRouter("/controls", [
        new PB.StaticPatch({
            route: "/home",
            response: new Response("admin controls home")
        })
    ], {
        entryModifiers: [new AdminControlAccess()]
    }),
    new PB.StaticPatch({
        route: "/login",
        response: new Response("admin login")
    })
]);

interface CatchallData {
    text: string
}
class CatchallPatch extends PB.Patch<CatchallData> {
    entry(req: Request) {
        this.parseRouteParams();
        return {
            text: this.routeParameters.text || "null"
        }
    }

    exit(data: CatchallData): Response {
        return new Response(data.text);
    }
}

const mainBay: PB.MainBay = {
    baseURL: "https://example.com",
    port: 443,
    patches: [
        AdminRouter,
        new CatchallPatch("/{text}")
    ]
}

export default mainBay;
