import type { EmotionCache } from "@emotion/cache";
import createEmotionServer from "@emotion/server/create-instance";

export function injectEmotionCriticalStyleTags(html: string, styleTags: string) {
  if (!styleTags) {
    return html;
  }

  const closingHeadIndex = html.search(/<\/head\s*>/i);
  if (closingHeadIndex >= 0) {
    return `${html.slice(0, closingHeadIndex)}${styleTags}${html.slice(closingHeadIndex)}`;
  }

  const doctypeMatch = html.match(/^<!doctype html>/i);
  if (doctypeMatch) {
    return `${doctypeMatch[0]}${styleTags}${html.slice(doctypeMatch[0].length)}`;
  }

  return `${styleTags}${html}`;
}

export function createEmotionSsrResponseFinalizer(cache: EmotionCache) {
  const { constructStyleTagsFromChunks, extractCriticalToChunks } = createEmotionServer(cache);

  return async function finalizeEmotionSsrResponse(response: Response) {
    const html = await response.text();
    const chunks = extractCriticalToChunks(html);
    const styleTags = constructStyleTagsFromChunks(chunks);
    const renderedHtml = injectEmotionCriticalStyleTags(html, styleTags);
    const headers = new Headers(response.headers);

    headers.delete("content-length");

    return new Response(renderedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };
}
