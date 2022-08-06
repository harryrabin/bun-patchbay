import {PBApp} from "./lib";
import mainBay from "./bay";
import * as handlebars from 'handlebars';

const app = new PBApp(mainBay);

Templates.userhomepage = handlebars.compile("")

app.serve()
