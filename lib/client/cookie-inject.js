import __CookieInterceptor from "cookie-interceptor";

const __updateFromPBCookie = (cookieString) => {
    let o = cookieString.split("; ")
        .find(o => o.startsWith("__PBCookie="));
    if (!o) return;
    const e = JSON.parse(o.replace("__PBCookie=", ""));
    for (const k in e) document.cookie = k + "=" + e[k];
}
__updateFromPBCookie(document.cookie);

__CookieInterceptor.init();
__CookieInterceptor.write.use((cookie) => {
    __updateFromPBCookie(cookie);
    return cookie;
});
