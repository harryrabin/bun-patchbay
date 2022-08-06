export function HTMLResponse(text: string) {
    return new Response(text, {headers: {"content-type": "text/html"}})
}

export function TemplateResponse(templateName: string, context: any, options?: RuntimeOptions) {
    return HTMLResponse(Templates[templateName](context, options));
}
