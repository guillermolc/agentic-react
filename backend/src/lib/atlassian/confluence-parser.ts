/**
 * Confluence HTML → Markdown converter.
 * Uses Cheerio for DOM preprocessing and Turndown for HTML → Markdown.
 * Body representation priority: body.view → body.storage (NOT export_view).
 */

import * as cheerio from "cheerio";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// Improve table handling
turndown.addRule("table", {
  filter: "table",
  replacement(_content, node) {
    const el = node as unknown as Element;
    // Let turndown handle the default; just ensure we don't lose tables
    return `\n\n${(el as unknown as { outerHTML: string }).outerHTML ? _content : _content}\n\n`;
  },
});

/**
 * Pre-process Confluence HTML using Cheerio:
 * - Remove scripts and styles
 * - Convert Confluence macros (ac:structured-macro) to readable text
 * - Convert status macros to inline labels
 * - Preserve code blocks and panels
 */
function preprocessHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove script and style elements
  $("script, style").remove();

  // Convert Confluence status macros: <ac:structured-macro ac:name="status">
  $('ac\\:structured-macro[ac\\:name="status"]').each((_i, el) => {
    const colour = $(el).find('ac\\:parameter[ac\\:name="colour"]').text() || "";
    const title = $(el).find('ac\\:parameter[ac\\:name="title"]').text() || "";
    $(el).replaceWith(`<strong>[${colour.toUpperCase()}: ${title}]</strong>`);
  });

  // Convert info/note/warning panels
  $('ac\\:structured-macro[ac\\:name="info"], ac\\:structured-macro[ac\\:name="note"], ac\\:structured-macro[ac\\:name="warning"]').each((_i, el) => {
    const macroName = $(el).attr("ac:name") || "info";
    const body = $(el).find("ac\\:rich-text-body").html() || "";
    $(el).replaceWith(`<blockquote><strong>${macroName.toUpperCase()}:</strong> ${body}</blockquote>`);
  });

  // Convert code blocks
  $('ac\\:structured-macro[ac\\:name="code"]').each((_i, el) => {
    const lang = $(el).find('ac\\:parameter[ac\\:name="language"]').text() || "";
    const body = $(el).find("ac\\:plain-text-body").text() || "";
    $(el).replaceWith(`<pre><code class="language-${lang}">${body}</code></pre>`);
  });

  // Convert remaining structured macros to their body text
  $("ac\\:structured-macro").each((_i, el) => {
    const body = $(el).find("ac\\:rich-text-body").html() || $(el).find("ac\\:plain-text-body").text() || "";
    $(el).replaceWith(body);
  });

  // Remove emoticons and other Confluence-specific elements
  $("ac\\:emoticon, ac\\:image, ac\\:link, ac\\:placeholder").each((_i, el) => {
    const text = $(el).text();
    $(el).replaceWith(text);
  });

  return $.html();
}

/**
 * Extract the best HTML body from a Confluence page response.
 * Priority: body.view → body.storage (NOT export_view — unavailable in Confluence 6.x)
 */
export function extractBody(page: {
  body?: {
    view?: { value?: string };
    storage?: { value?: string };
  };
}): string {
  if (page.body?.view?.value) return page.body.view.value;
  if (page.body?.storage?.value) return page.body.storage.value;
  return "";
}

/**
 * Convert Confluence page HTML to Markdown.
 */
export function parseConfluenceHtml(html: string): string {
  if (!html) return "";
  const preprocessed = preprocessHtml(html);
  return turndown.turndown(preprocessed);
}
