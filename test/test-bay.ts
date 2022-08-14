import * as PB from "..";

const AdminRouter = new PB.QuickRouter("/admin", [
    new PB.StaticPatch({
        route: "/home",
        response: new Response("admin home")
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
