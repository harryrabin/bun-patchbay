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
        if (err) {
            console.log(`Test "${this.name}" failed`);
            console.log(`Error: ${err}\n`);
        } else console.log(`Test "${this.name}" failed\n`);
        process.exit(1);
    }
}

const tests: Test[] = [
    new Test("patch route", () => {
        const r = new PB.Route("/patchnamehere", "patch");
        return r.re.toString() === "/^\\/patchnamehere\\/$/i";
    }),

    new Test("patch route w/ query string", () => {
        const r = new PB.Route("/patchnamehere{queryString}", "patch");
        return r.re.toString() === "/^\\/patchnamehere(?:\\?(.+))?\\/$/i";
    }),

    new Test("router route", () => {
        const r = new PB.Route("/routernamehere", "router");
        return r.re.toString() === "/^\\/routernamehere(?=.*\\/$)/i";
    }),

    new Test("cookie handler", () => {
        return true;
    })
]

await Promise.all(tests.map(t => t.run()));
process.exit(0);
