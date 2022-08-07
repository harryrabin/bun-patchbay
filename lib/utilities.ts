import {merge as ldMerge} from "lodash";

export function HTMLResponse(text: string, options: ResponseInit = {}): Response {
    let opt = {...options}
    ldMerge(opt, {
        headers: {"content-type": "text/html"}
    });
    return new Response(text, opt)
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
