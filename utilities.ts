/* Copyright (C) 2022 Harrison Rabin

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>. */

const deepExtend = require("deep-extend");

export function HTMLResponse(text: string, options: ResponseInit = {}): Response {
    let opt = {...options};
    deepExtend(opt, {headers: {"content-type": "text/html"}});
    return new Response(text, opt);
}

export function JSONResponse(json: string | object, options: ResponseInit = {}): Response {
    let opt = {...options};
    deepExtend(opt, {headers: {"content-type": "application/json"}});
    const text = typeof json === "string" ? json : JSON.stringify(json)
    return new Response(text, opt);
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
