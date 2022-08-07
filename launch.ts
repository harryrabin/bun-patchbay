import {PBApp} from "./lib";
import mainBay from "./bay";

/* First, construct the app instance. For most cases, you don't need to assign
 it to anything, the constructor will simply initialize the app on the global object
 as `PatchBay`. Until the app is instantiated, any other globals PatchBay sets will also be
 undefined. */
new PBApp(mainBay);

// Finally, tell the app to start listening for requests
PatchBay.serve();
