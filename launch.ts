import {PBApp} from "./lib";
import mainBay from "./bay";

/* Construct the app instance. For most cases, you don't need to assign
it to anything, the constructor will simply initialize it on the global object as PatchBay.*/
new PBApp(mainBay);

// Then tell the app to start listening for requests
PatchBay.serve()
