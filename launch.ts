import {PBApp} from "./lib";
import mainBay from "./bay";

let app = new PBApp({
    mainBay: mainBay
});

app.serve()
