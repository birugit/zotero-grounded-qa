/**
 * outlineExport — turn the knowledge-organizer outline plus everything filed
 * under each heading into a first draft.
 *
 * We walk the outline tree in order; each heading becomes a heading of the
 * matching depth, and the quotes/notes filed under it are rendered beneath with
 * their citations. The result is a Markdown/HTML document — or a standalone
 * Zotero note — that reads like the skeleton of the chapter, no copy-pasting.
 *
 * These builders are pure: they take the tree and a pre-gathered map of
 * heading-id → filed items, so they can be unit-tested outside Zotero. The
 * library-touching gather + note materialisation live at the bottom.
 */

import { flatten, headingTag, OutlineModel, OutlineNode } from "./outlineModel";
import type { FiledItem } from "./outlineModel";

/** id → the items filed under that heading, in the order they should render. */
export type GatherMap = Map<string, FiledItem[]>;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Compose "citation, p. N" from a filed item, dropping empty parts. */
function sourceLine(item: FiledItem): string {
  const page = item.pageLabel ? `p. ${item.pageLabel}` : "";
  return [item.citation, page].filter(Boolean).join(", ");
}

export interface OutlineExportOptions {
  /** Document title used at the top of the draft. */
  title?: string;
  /** Include headings that currently have nothing filed under them. */
  includeEmpty?: boolean;
}

export function outlineToMarkdown(
  roots: OutlineNode[],
  gathered: GatherMap,
  opts: OutlineExportOptions = {},
): string {
  const out: string[] = [];
  out.push(`# ${opts.title || "Draft"}`, "");

  for (const { node, depth } of flatten(roots)) {
    const items = gathered.get(node.id) || [];
    if (!items.length && !opts.includeEmpty) continue;
    const hashes = "#".repeat(Math.min(depth + 2, 6));
    out.push(`${hashes} ${node.title}`, "");
    if (!items.length) {
      out.push("_(nothing filed here yet)_", "");
      continue;
    }
    for (const item of items) {
      const src = sourceLine(item);
      if (item.kind === "annotation") {
        if (item.quote) out.push(`> ${item.quote.trim()}`);
        if (item.comment) out.push("", item.comment.trim());
        const tail = [src, item.link ? `[open](${item.link})` : ""].filter(
          Boolean,
        );
        if (tail.length) out.push("", `— ${tail.join(" · ")}`);
      } else if (item.kind === "note") {
        if (item.quote) out.push(item.quote.trim());
        if (src) out.push("", `— ${src}`);
      } else {
        out.push(`- ${item.citation}`);
      }
      out.push("");
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function outlineToHtml(
  roots: OutlineNode[],
  gathered: GatherMap,
  opts: OutlineExportOptions = {},
): string {
  const out: string[] = [];
  out.push(`<h1>${escapeHtml(opts.title || "Draft")}</h1>`);

  for (const { node, depth } of flatten(roots)) {
    const items = gathered.get(node.id) || [];
    if (!items.length && !opts.includeEmpty) continue;
    const level = Math.min(depth + 2, 6);
    out.push(`<h${level}>${escapeHtml(node.title)}</h${level}>`);
    if (!items.length) {
      out.push(`<p><em>(nothing filed here yet)</em></p>`);
      continue;
    }
    for (const item of items) {
      const src = sourceLine(item);
      if (item.kind === "annotation") {
        out.push(`<blockquote>`);
        if (item.quote) out.push(`<div>${escapeHtml(item.quote.trim())}</div>`);
        if (item.comment)
          out.push(
            `<div style="color:#555;margin-top:4px;">${escapeHtml(
              item.comment.trim(),
            )}</div>`,
          );
        const tail: string[] = [];
        if (src) tail.push(escapeHtml(src));
        if (item.link) tail.push(`<a href="${item.link}">open</a>`);
        if (tail.length)
          out.push(
            `<div style="font-size:.85em;color:#777;margin-top:4px;">${tail.join(
              " · ",
            )}</div>`,
          );
        out.push(`</blockquote>`);
      } else if (item.kind === "note") {
        if (item.quote)
          out.push(
            `<p>${escapeHtml(item.quote.trim()).replace(/\n/g, "<br/>")}</p>`,
          );
        if (src)
          out.push(
            `<div style="font-size:.85em;color:#777;">— ${escapeHtml(src)}</div>`,
          );
      } else {
        out.push(`<p>${escapeHtml(item.citation)}</p>`);
      }
    }
  }
  return out.join("\n");
}

// ── library-touching helpers ────────────────────────────────────────────────

/** Gather everything filed under every heading in the tree. */
export async function gatherAll(
  libraryID: number,
  roots: OutlineNode[],
): Promise<GatherMap> {
  const map: GatherMap = new Map();
  for (const { node } of flatten(roots)) {
    map.set(
      node.id,
      await OutlineModel.gather(libraryID, headingTag(node.title)),
    );
  }
  return map;
}

/** Copy the generated draft to the clipboard. */
export function copyDraft(
  roots: OutlineNode[],
  gathered: GatherMap,
  format: "markdown" | "html",
  opts: OutlineExportOptions = {},
) {
  const text =
    format === "html"
      ? outlineToHtml(roots, gathered, opts)
      : outlineToMarkdown(roots, gathered, opts);
  new ztoolkit.Clipboard().addText(text, "text/unicode").copy();
}

/** Materialise the draft as a standalone Zotero note and return it. */
export async function saveDraftAsNote(
  roots: OutlineNode[],
  gathered: GatherMap,
  libraryID: number,
  opts: OutlineExportOptions = {},
): Promise<Zotero.Item> {
  const note = new Zotero.Item("note");
  note.libraryID = libraryID;
  note.setNote(outlineToHtml(roots, gathered, opts));
  await note.saveTx();
  return note;
}
