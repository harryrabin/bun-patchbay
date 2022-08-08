# PatchBay

<img src="PatchBay-logo.png" alt="PatchBay Logo" width="250">

PatchBay is a dead-simple modular + declarative web framework built for Bun. PatchBay is somewhat opinionated to make
it as simple and plug-n-play as possible; but generally pretty flexible if you're okay getting your hands dirty.

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

The `launch.ts` file is the entrypoint for a PatchBay app. Its only required functionality is to instantiate the `PBApp`
and tell it to start serving. That's all it needs to do, and out of the box that's all it *will* do. We've kept it
simple on purpose, so you have an easy and clean place to do things like declare a global database instance, set
options for the Bun server, and so on.

## Patches

Patches are designed to separate logic between accepting the request and generating the response. The pattern we
recommend is that your `entry` function is in charge of parsing URL parameters and query strings, setting defaults,
etc. and putting all necessary data in one place for your `exit` function to use, so that the `exit` function is
guaranteed to succeed.

In fact, we've included an easy way to guarantee data safety for `exit`. `entry` returns
a generic type, though you may not initially realize it because it defaults to `void`.

//TODO: make examples here

Essentially: abstract your failure points into one function, and do your business logic in another.

<a id="sec-templates"></a>
## Templates

PatchBay includes [Handlebars](https://handlebarsjs.com), a fast and powerful templating engine. And, we made it
even easier to use. Any `.hbs` files in the `views` directory will be compiled and made global via an object called
`templates`. Accessing and using the templates looks like this:

```typescript
// To use ./views/user-homepage.hbs, you would write:
const templateText: string = PatchBay.templates["user-homepage"]({user: "johnsmith"});

// Nested directories work too. To access ./views/emails/login-attempt.hbs, you would write:
PatchBay.templates["emails/login-attempt"]
```

We even made an easy way to return a template as an HTML response:
```typescript
import {Patch, PBUtils} from "patchbay";

class UserHomepage extends Patch {
    // ...
   
   exit(): Response {
       return PBUtils.TemplateResponse("user-homepage", {user: "johnsmith"});
   }
}
```

### Advanced usage
The default search directory is `./views`, but you can change this with the `viewDirectory` option when instantiating
your PBApp. If you want more control over Handlebars' behavior, you have a couple options when instantiating your
PBApp.

1. You can pass in a `Handlebars.CompileOptions` instance to change how Handlebars compiles your views.
2. You can pass in `noHandlebars: true` to prevent PatchBay from reading the view directory. The `templates` global
   will be defined as empty, and you can add to it as you please.

```typescript
new PBApp({
   viewDirectory: "./customviewdirectory",
   handlebarsOptions: {
       noEscape: true
      //...
   },
   
   // Or, disable the automatic loading
   noHandlebars: true,
});
```

<a id="sec-cookies"></a>
## Cookies

PatchBay supports cookies right out of the box... with an important caveat.

A current limitation of the Fetch specification is that only a single `Set-Cookie` header can be set in a `Response`.
While some runtimes have non-standard fixes for this, Bun sticks to the spec – so, to get around this
limitation, PatchBay exposes a home-rolled and easy-to-use cookie API for you, which under the hood maintains a single
cookie called `__PBCookie` containing JSON text of all the cookies you set.

If you bundle your static assets with PatchBay using the `build` script, the included webpack config will inject the
necessary code to keep cookies working on the client completely transparently, whether they are served by PatchBay or
by a dedicated static asset host. See [Building](#sec-building) for more details on webpack config with PatchBay.

<sup>(To make the magic happen, PatchBay uses a little package called [cookie-interceptor](https://github.com/keqingrong/cookie-interceptor),
which only supports a single instance; so, on the off chance you need to use it for your app, the instance is exposed
as `window.CookieInterceptor`)</sup>

For edge cases where bundling with PatchBay is not doable, this problem still has an easy fix. For a simple solution,
just add the following snippet to the head of your HTML page:

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
may set cookies). For a more "advanced" solution, you could implement cookie-interceptor yourself (it's pretty easy).

While all of the above should work without a hitch, there are potential "real" fixes in the works. You may be interested
in [this thread](https://github.com/whatwg/fetch/pull/1346), a proposal for a sensible long-term solution, and also the
experimental [CookieChangeEvent](https://developer.mozilla.org/en-US/docs/Web/API/CookieChangeEvent) API which would at
least allow us to stop depending on cookie-interceptor.

With that out of the way, here's a reference on our cookie API:

### set(key: string, value: string, attributes?: CookieAttributes)

...

<a id="sec-building"></a>
## Building

PatchBay does not *require* any kind of build phase to run. All environment setup, including TypeScript compilation, is
performed on launch. The included build script is just a convenience script that:

1. Clears out the dist folder
2. Runs webpack for your static assets
3. Runs `bun bun` to bundle your app's dependencies.

We encourage modifying the build script to best suit your project. It won't break anything – we just wanted to include
a sensible default that works for many projects out of the box.

### webpack

As discussed in [cookies](#sec-cookies), the default webpack configuration injects some code into your static JS to keep
cookies working transparently. This is its main purpose, and why we recommend always bundling your assets with the
included webpack config.

It will also copy all files that aren't .js files from `/static` to `/dist` – that way, you'll never have to touch the
`/dist` folder, you just build it and leave it alone. This is obviously not disk-efficient for certain larger projects,
but it keeps things pretty and simple for projects without many static assets where the extra disk space is negligible.

Although we recommend keeping the InjectPlugin config as-is (for obvious reasons), the rest of the config is yours to
do with as you please.

### bun bun

Bun has a built-in dependency bundler for your server-side dependencies that works similarly to webpack, but stores
the bundled JavaScript in an extremely efficient binary file called `node_modules.bun` that it will read from on launch
instead of the`node_modules` directory. This has some obvious speed perks for your app, so we included it in the
default build script.

## Programmatic Usage (Advanced)

While the default project does a lot of heavy lifting, PatchBay can be used programmatically with just a few things to
keep in mind to avoid unexpected or undefined behavior.

### Global `PatchBay`

The global `PatchBay` will always be set to the latest-created instance of PBApp. This is why `launch.ts` in the
default project doesn't bother assigning the `PBApp` to anything. However, the constructor does return the instance,
so you can assign it to be used programmatically if you want multiple `PBApp` instances running. Just remember to avoid
using the global `PatchBay`, or you may get some unexpected behavior.

Nothing in the core library uses the global `PatchBay`, but some `PBUtils` helpers do. However, they have workarounds:

```typescript
PBUtils.TemplateResponse("my-template", {data: "data"}, {
    /* Pass in a template record like below to override
    the use of the global one */
   
    templates: customPBInstance.templates
});
```

### Templates

Unless you have a views folder in the root directory you'd like to use, you should disable the automatic loading of
Handlebars templates to avoid an error on launch. See advanced usage in [templates](#sec-templates) for details.
