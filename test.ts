import * as PB from ".";

class Test {
    private readonly name: string;
    private readonly func: () => boolean | Promise<boolean>;

    constructor(name: string, fn: () => boolean | Promise<boolean>) {
        this.name = name;
        this.func = fn;
    }

    async run() {
        let err: any = false;
        try {
            if (await this.func() === true) {
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

        if (ch.stringify() !== '{"cookieOne":"one","cookieTwo":"two","cookieThree":"three"}')
            throw "returned json from stringify() was incorrect"

        return true;
    })
]

await Promise.all(tests.map(t => t.run()));
process.exit(0);
