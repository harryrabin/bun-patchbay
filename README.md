# PatchBay

---

<img src="PatchBay-logo.png" alt="PatchBay Logo" width="250">

PatchBay is a dead-simple modular + declarative web framework built for Bun. Just like Bun itself, PatchBay is in
infancy – but as Bun grows, so too will PatchBay.

---

## The Basics

PatchBay is named after the audio patch bays you find in music studios and on stages. Much like connecting cables on
an audio patch bay, to use PatchBay you will be simply declaring how to route requests around, abstracting logic into
individual `Patch`es and using `Router`s for control flow.

**I recommend reading this whole section before reading the docs.**

There are four major concepts you'll need to know to begin:

1. `PBRequest` is a class that wraps a native fetch `Request` and adds on our home-rolled APIs (such as cookies).
   

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

## Cookies

PatchBay supports cookies right out of the box... with an important caveat.

As a current limitation of the Fetch specification, only a single `Set-Cookie` header can be set in a `Response`.
While some platforms/environments have non-standard fixes for this, Bun sticks to the spec – so, to get around this
limitation, PatchBay exposes a home-rolled and easy-to-use cookie API for you, which under the hood maintains a single
cookie called `__PBCookie` containing JSON text of all the cookies you set.

To parse this and set the individual cookies client-side, you just need to add the following snippet to the head of
your HTML page (a bundler script that rolls this into your static assets with WebPack is on the roadmap).

```html
<script type="text/javascript">
    window.updateFromPBCookie = () => {
        let o = document.cookie.split("; ")
                .find(o => o.startsWith("__PBCookie="));
        if (!o) return;
        o = o.replace("__PBCookie=", "");
        const e = JSON.parse(o);
        for (k in e) document.cookie = k + "=" + e[k];
    }
    updateFromPBCookie();
</script>
```

This will parse `__PBCookie` on initial page load, and exposes a global function `updateFromPBCookie()` that you can
call at any time to parse it again if you have reason to believe it was updated (e.g. in the `.then()` of a fetch that
may set cookies).

Yeah... it's not ideal, but it's a simple enough fix and there are potential "real" fixes in the works. You may be
interested in [this thread](https://github.com/whatwg/fetch/pull/1346), a proposal for a sensible long-term solution,
and also the experimental [CookieChangeEvent](https://developer.mozilla.org/en-US/docs/Web/API/CookieChangeEvent),
which would at least allow the above snippet to work hands-free in the background.

With that out of the way, here's a reference on our cookie API:

### setCookie

...
