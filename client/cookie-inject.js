import __CookieInterceptor from "cookie-interceptor";

const __updateFromPBCookie = (cookieString) => {
    let o = cookieString.split("; ")
        .find(o => o.startsWith("__PBCookie="));
    if (!o) return;
    const e = JSON.parse(o.replace("__PBCookie=", ""));
    for (const k in e) {
        let c = (k + "=" + e[k]).replaceAll("||", ";");
        console.log(c);
        document.cookie = c;
    }
    document.cookie = "__PBCookie=undefined; Expires=Sat, 01 Jan 2000 00:00:00 GMT"
}
__updateFromPBCookie(document.cookie);

__CookieInterceptor.init();
__CookieInterceptor.write.use((cookie) => {
    __updateFromPBCookie(cookie);
    return cookie;
});

window.CookieInterceptor = __CookieInterceptor;
