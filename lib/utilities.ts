export function HTMLResponse(text: string) {
    return new Response(text, {headers: {"content-type": "text/html"}})
}

export function TemplateResponse(templateName: string, context: any, options?: RuntimeOptions) {
    const text = Templates[templateName](context, options);
    return HTMLResponse(text);
}
