# PatchBay

<img src="PatchBay-logo.png" alt="PatchBay Logo" width="250">

PatchBay is a dead-simple modular + declarative web framework built for Bun. PatchBay is strongly opinionated to make
it as simple and plug-n-play as possible; but generally pretty flexible if you're okay getting your hands dirty.

PatchBay is synchronous. Nothing internal uses promises or callbacks. This may change in the future, but expect to
use promise chaining if you're using async libraries.

Just like Bun itself, PatchBay is in infancy – but as Bun grows, so too will PatchBay.

---

## The Basics

PatchBay is named after the audio patch bays you find in music studios and on stages. Much like connecting cables on
an audio patch bay, to use PatchBay you will be simply declaring how to route requests around, abstracting logic into
individual `Patch`es and using `Router`s for control flow.

**I recommend reading this whole section before reading the docs.**

There are four major concepts you'll need to know to begin:

1. `PBRequest` is a class that wraps a native fetch `Request` and adds in some utilities for PatchBay's internal use.
   You can access the wrapped `Request` with the `.raw()` instance method.
   

2. `Patch` is an abstract class that you will extend to build your logical components.
   

3. `Router` is an abstract class that is essentially a "folder" of `Patchable`s. You will likely not be extending it,
   but rather using the provided utility classes that extend it.
   

4. `Patchable` is an interface defining any route that can be put into a router. A `Patchable` just stores its own
   route and a single function that takes a `PBRequest` and returns a `Response`. `Patch` and `Router` both implement
   `Patchable`... meaning Routers can have recursive Routers inside them (and they commonly will). You probably won't
   be using this interface to build your own components, but you can totally prove me wrong on that!

The starting point for your app is the bay.ts file. This module has a default export which we'll call
the *main bay*. In a new project, your main bay looks like this:

```typescript
export default {
    baseURL: "http://localhost:3000",
    port: 3000,
    patches: [
        new StaticAssetRouter("/", "./dist"),
    ]
}
```

Let's break that down! First we've got the `baseURL` property, a string which lets the main router know where it
lives. This is exposed globally as `PB_baseURL`.

Next we have the `port` property, a number which tells Bun what port
to serve on, exposed globally as `PB_port`.

Then, things get interesting with `patches`. This is an array of any objects implementing `Patchable`, which the main
router will use to route top-level requests. Our only patchable in there right now is a `StaticAssetRouter`, a utility
class that serves the assets inside a given directory (in this case `"./dist"`). Notice how we construct a new
`StaticAssetRouter` anonymously, and it just lives in the array. This is how nearly all patchable components will be
created. The first parameter we pass to the constructor is its route, `"/"`. This means 

The launch.ts file is what you'll use to run your app (`> bun launch.ts`). It sets globals and starts the Bun HTTP
server. We encourage adding to it to customize your environment (making a database instance global, for example) – but
you should leave everything that's already in there intact unless you really know what you're doing.

## Patches

Patches are designed to separate logic between accepting the request and generating the response. The pattern we
recommend is that your `entry` function is in charge of parsing URL parameters and query strings, setting defaults,
etc. and putting all necessary data in one place for your `exit` function to use, so that the `exit` function is
guaranteed to succeed.

In fact, we've included an easy way to guarantee data safety for `exit`. `entry` returns
a generic type, though you may not initially realize it because it defaults to `void`.

//TODO: make examples here

Essentially: abstract your failure points into one function, and do your business logic in another.

## Cookies

PatchBay supports cookies right out of the box... with an important caveat.

A current limitation of the Fetch specification is that only a single `Set-Cookie` header can be set in a `Response`.
While some runtimes have non-standard fixes for this, Bun sticks to the spec – so, to get around this
limitation, PatchBay exposes a home-rolled and easy-to-use cookie API for you, which under the hood maintains a single
cookie called `__PBCookie` containing JSON text of all the cookies you set.

If you bundle your static assets with PatchBay using the `build` script, the included webpack config will inject the
necessary code to keep cookies working on the client completely transparently, whether they are served by PatchBay or
by a dedicated static asset host. See [Building](#building) for more details on webpack config with PatchBay.

<sup>(To make the magic happen, PatchBay uses a little package called [cookie-interceptor](https://github.com/keqingrong/cookie-interceptor),
which only supports a single instance; so, on the off chance you need to use it for your app, the instance is exposed
as `window.CookieInterceptor`)</sup>

For edge cases where bundling with PatchBay is not doable, it's still an easy fix. For a simple solution, just add
the following snippet to the head of your HTML page:

```html
<script type="text/javascript">
    window.updateFromPBCookie = () => {
        let o = document.cookie.split("; ")
                .find(o => o.startsWith("__PBCookie="));
        if (!o) return;
        o = o.replace("__PBCookie=", "");
        const e = JSON.parse(o);
        for (const k in e) document.cookie = k + "=" + e[k];
    }
    updateFromPBCookie();
</script>
```

This will parse `__PBCookie` on initial page load, and exposes a global function `updateFromPBCookie()` that you can
call at any time to parse it again if you have reason to believe it was updated (e.g. in the `.then()` of a fetch that
may set cookies).

While all of the above should work without a hitch, there are potential "real" fixes in the works. You may be interested
in [this thread](https://github.com/whatwg/fetch/pull/1346), a proposal for a sensible long-term solution, and also the
experimental [CookieChangeEvent](https://developer.mozilla.org/en-US/docs/Web/API/CookieChangeEvent) API which would at
allow us to stop depending on cookie-interceptor.

With that out of the way, here's a reference on our cookie API:

### setCookie

...

## Building

PatchBay does not require any kind of build phase to run. Bun has a JIT TypeScript compiler. The included build script
is just a convenience script that:
1. Clears out the dist folder
2. Runs webpack for your static assets
3. Runs `bun bun` to bundle your app's dependencies.

We encourage modifying the build script to best suit your project. It won't break anything – we just wanted to include
a sensible default that works for many projects out of the box.

### webpack

As discussed in [cookies](#cookies), the default webpack configuration injects some code into your static JS to keep
cookies working transparently. This is its main purpose, and why we recommend always bundling your assets with the
included webpack config.

It will also copy all files that aren't .js files from `/static` to `/dist` – that way, you'll never have to touch the
`/dist` folder, you just build it and leave it alone. This is obviously not disk-efficient for certain larger projects,
but it keeps things pretty and simple for projects without many static assets where the extra disk space is negligible.

Although we recommend keeping the InjectPlugin config as-is (for obvious reasons), the rest of the config is yours to
do with as you please.

### bun bun

Bun has a built-in dependency bundler that works similarly to webpack, but stores the bundled dependencies in an
extremely efficient binary file called `node_modules.bun` that it will read from on launch instead of the
`node_modules` directory. This has some obvious speed perks for your app, so we included it in the default build script.
