As a current limitation of the Fetch specification, only a single `Set-Cookie` header can be set in a `Response`.
While some platforms/environments have non-standard fixes for this, Bun sticks to the spec – so, to get around this
limitation, PatchBay maintains a single cookie called `__PBCookie`, containing JSON text of all cookies.

To automatically parse this and set the individual cookies client-side, you just need to add the following minimized
snippet to your pages (a bundler script that rolls this in to your static assets with WebPack or similar is on the
roadmap).

> `for(;;){let o=document.cookie.split("; ").find(o=>o.startsWith("__PBCookie="));if(!o)break;o=o.replace("__PBCookie=","");const e=JSON.parse(o);for(k in e)document.cookie=k+"="+e[k];break}`
