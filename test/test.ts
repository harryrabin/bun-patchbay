import * as PB from "..";
import {compile as hbCompile} from "handlebars";

class Test {
    private readonly name: string;
    private readonly fn: () => boolean | Promise<boolean>;

    constructor(name: string, fn: () => boolean | Promise<boolean>) {
        this.name = name;
        this.fn = fn;
    }

    async run(): Promise<void> {
        let err: any = false;
        try {
            if (await this.fn() === true) {
                console.log(`Test "${this.name}" passed\n`);
                return;
            }
        } catch (e) {
            err = e;
        }
        if (err) console.log(`Test "${this.name}" failed\nError: ${err}\n`);
        else console.log(`Test "${this.name}" failed\n`);
        process.exit(1);
    }
}

const tests: Test[] = [

    new Test("route creation", () => {
        const r1 = new PB.Route("/patchnamehere", "patch");
        if (r1.re.toString() !== "/^\\/patchnamehere\\/$/i")
            throw "plain patch route was incorrect";

        const r2 = new PB.Route("/patchnamehere{queryString}", "patch");
        if (r2.re.toString() !== "/^\\/patchnamehere(?:\\?(.+))?\\/$/i")
            throw "patch route w/ query string was incorrect";

        const r3 = new PB.Route("/routernamehere", "router");
        if (r3.re.toString() !== "/^\\/routernamehere(?=.*\\/$)/i")
            throw "router route was incorrect";

        return true;
    }),

    new Test("cookie handler", () => {
        const req = new Request("");
        req.headers.append("cookie", "cookieOne=one; cookieTwo=two");

        const ch = new PB.CookieHandler();
        ch.init(new PB.PBRequest(req));

        if (ch.get("cookieOne") !== "one") throw "get() error";
        if (ch.get("cookieTwo") !== "two") throw "get() error";

        if (ch.stringify() !== undefined) throw "stringify() should have returned undefined";

        ch.set("cookieThree", "three");

        if (ch.stringify() !== '{"cookieOne":"one","cookieTwo":"two","cookieThree":"three"}; Secure')
            throw "returned json from stringify() was incorrect"

        ch.set("cookieFour", "four", {
            expires: new Date(Date.UTC(2000, 0, 1, 0, 0)),
            max_age: 3000,
            domain: "http://localhost:3000",
            path: "/",
            httpOnly: true,
            sameSite: "none"
        });

        const cookieFour = ch.get("cookieFour");
        if (cookieFour !== "four; Expires=Sat, 01 Jan 2000 00:00:00 GMT; Max-Age=3000; " +
            "Domain=http://localhost:3000; Path=/; SameSite=None; Secure; HttpOnly")
            throw "set() did not set attributes correctly";

        if (PB.CookieHandler.strip(cookieFour) !== "four")
            throw "static strip() did not strip the cookie correctly";

        return true;
    }),

    new Test("PBUtils", async () => {
        // HTMLResponse
        const htmlResponse = PB.PBUtils.HTMLResponse("<h1>Hello</h1>")
        if (await htmlResponse.text() !== "<h1>Hello</h1>")
            throw "HTMLResponse did not accept text correctly";

        // JSONResponse
        const testObject = {
            keyOne: "one",
            keyTwo: "two"
        }

        const jsonResponse = PB.PBUtils.JSONResponse(testObject)
        if (await jsonResponse.text() !== '{"keyOne":"one","keyTwo":"two"}')
            throw "JSONResponse didn't parse testObject correctly";

        const jsonResponseString = PB.PBUtils.JSONResponse(JSON.stringify(testObject));
        if (await jsonResponseString.text() !== '{"keyOne":"one","keyTwo":"two"}')
            throw "JSONResponse didn't accept JSON text correctly";

        // TemplateResponse
        const templateResponse = PB.PBUtils.TemplateResponse('user-page', {user: "John"}, {
            templates: {
                "user-page": hbCompile("<p>Hello {{user}}</p>")
            }
        });

        if (await templateResponse.text() !== "<p>Hello John</p>")
            throw "TemplateResponse did not use the template correctly";

        return true;
    })

]

await Promise.all(tests.map(t => t.run()));
process.exit(0);
