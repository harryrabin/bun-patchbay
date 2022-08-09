/* Copyright (C) 2022 Harrison Rabin

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>. */

import {merge as ldMerge} from "lodash";

export function HTMLResponse(text: string, options: ResponseInit = {}): Response {
    let opt = {...options};
    ldMerge(opt, {
        headers: {"content-type": "text/html"}
    });
    return new Response(text, opt);
}

export function JSONResponse(json: string, options: ResponseInit = {}): Response {
    let opt = {...options};
    ldMerge(opt, {
        headers: {"content-type": "application/json"}
    });
    return new Response(json, opt);
}

export function TemplateResponse(templateName: string, context: any, options: {
    responseOptions?: ResponseInit;
    handlebarsOptions?: RuntimeOptions;
    templates?: Record<string, HandlebarsTemplateDelegate>;
} = {}): Response {
    const templates = options.templates || PatchBay.templates;
    return HTMLResponse(templates[templateName]
        (context, options.handlebarsOptions),
        options.responseOptions);
}
