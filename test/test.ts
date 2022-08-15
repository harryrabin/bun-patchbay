import * as PB from "..";
import testBay from "./test-bay";
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

        const r3 = new PB.Route("/{username}/{pagetype}", "patch");
        if (r3.re.toString() !== "/^\\/([^?/]+)\\/([^?/]+)\\/$/i")
            throw "patch route w/ capture groups was incorrect";

        const r4 = new PB.Route("/routernamehere", "router");
        if (r4.re.toString() !== "/^\\/routernamehere(?=.*\\/$)/i")
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

        if (ch.stringify() !== '{"cookieThree":"three"}; Secure')
            throw "returned json from stringify() was incorrect"

        ch.set("cookieFour", "four", {
            expires: Date.UTC(2000, 0, 1, 0, 0),
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

        ch.unset("cookieOne");
        if (ch.get("cookieOne") !== "undefined; Expires=Sat, 01 Jan 2000 00:00:00 GMT")
            throw "unset() did not set the cookie to expire correctly"

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
    }),

    new Test("request/response", async () => {
        const app = new PB.PBApp(testBay, {
            noHandlebars: true,
            skipGlobal: true,
        });

        const adminHomeRequest = new Request("https://example.com/admin/controls/home")
        const adminHomeResponse = await app.__fetch(adminHomeRequest);
        if (await adminHomeResponse.text() !== "403: forbidden")
            throw "/admin/controls/home response was incorrect\n" +
            "(entry modifier is not working)";

        const adminNotFoundRequest = new Request("https://example.com/admin/controls/null");
        const adminNotFoundResponse = await app.__fetch(adminNotFoundRequest);
        if (await adminNotFoundResponse.text() !== "404: not found")
            throw "/admin/controls/null response was incorrect\n" +
            "(router is not checking for route matches before running entry modifier)";

        const adminLoginRequest = new Request("https://example.com/admin/login")
        const adminLoginResponse = await app.__fetch(adminLoginRequest);
        if (await adminLoginResponse.text() !== "admin login")
            throw "/admin/login response was incorrect";

        const catchallRequest = new Request("https://example.com/miscellaneous");
        const catchallResponse = await app.__fetch(catchallRequest);

        const t = await catchallResponse.text();
        if (t !== "miscellaneous")
            throw "/{catchall} response was incorrect";

        return true;
    })
]

for (const test of tests) {
    await test.run()
}
process.exit(0);
