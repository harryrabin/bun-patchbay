import {StaticAssetRouter} from "./lib/patchbay";

export default {
    baseURL: "http://localhost:3000",
    port: 3000,
    patches: [
        new StaticAssetRouter({
            route: "",
            directory: "./static-content",
            defaultResponse: new Response("404 not found in static", {status: 404})
        })
    ]
}
