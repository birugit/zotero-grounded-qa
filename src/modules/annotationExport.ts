/**
 * annotationExport — turn a filtered set of annotations into something the user
 * can keep: a Markdown/HTML digest, the clipboard, or a standalone Zotero note.
 *
 * Annotations are grouped by their source paper so each citation is rendered
 * once, with its highlights/notes beneath it. This is the "export the filtered
 * set with citations" half of the request, and the standalone-note target is a
 * first step toward the Citavi-style searchable layer (the note itself becomes
 * a taggable, searchable item that links back to every source).
 */

import { AnnRecord } from "./annotationIndex";

export type ExportFormat = "markdown" | "html" | "note";

const TYPE_LABEL: Record<string, string> = {
  highlight: "Highlight",
  underline: "Underline",
  note: "Note",
  image: "Image",
  ink: "Ink",
  text: "Text",
};

/** Resolve a citation string for an item, honouring the user's QuickCopy style. */
function citationFor(item: Zotero.Item): string {
  try {
    const format = Zotero.QuickCopy.getFormatFromURL(
      (Zotero.QuickCopy as any).lastActiveURL || "",
    );
    const content = (Zotero.QuickCopy as any).getContentFromItems(
      [item],
      format,
    );
    const text = (content?.text || "").trim();
    if (text) return text;
  } catch (e) {
    ztoolkit.log("annotationExport citation failed, using fallback:", e);
  }
  return fallbackCitation(item);
}

/** Author (Year). Title. — used when the citation engine is unavailable. */
function fallbackCitation(item: Zotero.Item): string {
  try {
    const creator = item.getField("firstCreator") as string;
    const date = (item.getField("date") as string) || "";
    const year = (date.match(/\d{4}/) || [""])[0];
    const title = item.getDisplayTitle();
    const parts = [creator, year ? `(${year})` : "", title].filter(Boolean);
    return parts.join(" ").replace(/\s+/g, " ").trim() || title;
  } catch {
    return item.getDisplayTitle?.() || "(untitled source)";
  }
}

/** Deep link that opens the PDF/EPUB at the annotation. */
function deepLink(rec: AnnRecord): string {
  if (!rec.attachmentKey) return "";
  return `zotero://open-pdf/${rec.libraryPrefix}/items/${rec.attachmentKey}?annotation=${rec.key}`;
}

interface Grouped {
  paperID: number;
  citation: string;
  records: AnnRecord[];
}

function groupBySource(records: AnnRecord[]): Grouped[] {
  const byPaper = new Map<number, AnnRecord[]>();
  for (const r of records) {
    const arr = byPaper.get(r.parentItemID);
    if (arr) arr.push(r);
    else byPaper.set(r.parentItemID, [r]);
  }
  const groups: Grouped[] = [];
  for (const [paperID, recs] of byPaper) {
    const item = Zotero.Items.get(paperID) as Zotero.Item | undefined;
    groups.push({
      paperID,
      citation: item ? citationFor(item) : recs[0].parentTitle,
      records: recs,
    });
  }
  // Stable, human-friendly ordering by citation text.
  return groups.sort((a, b) => a.citation.localeCompare(b.citation));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function lineFor(rec: AnnRecord): {
  quote: string;
  meta: string;
  note: string;
} {
  const typeLabel = TYPE_LABEL[rec.type] || rec.type || "Annotation";
  const page = rec.pageLabel ? `p. ${rec.pageLabel}` : "";
  const meta = [typeLabel, page].filter(Boolean).join(", ");
  return {
    quote: rec.text.trim(),
    meta,
    note: rec.comment.trim(),
  };
}

export function toMarkdown(records: AnnRecord[]): string {
  const groups = groupBySource(records);
  const out: string[] = [];
  out.push(`# Annotations (${records.length})`, "");
  for (const g of groups) {
    out.push(`## ${g.citation}`, "");
    for (const rec of g.records) {
      const { quote, meta, note } = lineFor(rec);
      const link = deepLink(rec);
      const bullet = quote ? `> ${quote}` : `> _(${meta})_`;
      out.push(bullet);
      const tail: string[] = [];
      if (meta && quote) tail.push(`_${meta}_`);
      if (rec.tags.length) tail.push(rec.tags.map((t) => `#${t}`).join(" "));
      if (link) tail.push(`[open](${link})`);
      if (tail.length) out.push(tail.join(" · "));
      if (note) out.push("", note);
      out.push("");
    }
  }
  return out.join("\n");
}

export function toHtml(records: AnnRecord[]): string {
  const groups = groupBySource(records);
  const out: string[] = [];
  out.push(`<h1>Annotations (${records.length})</h1>`);
  for (const g of groups) {
    out.push(`<h2>${escapeHtml(g.citation)}</h2>`);
    for (const rec of g.records) {
      const { quote, meta, note } = lineFor(rec);
      const link = deepLink(rec);
      const color = rec.color || "#999";
      const metaBits: string[] = [];
      if (meta) metaBits.push(escapeHtml(meta));
      if (rec.tags.length)
        metaBits.push(
          rec.tags.map((t) => `<i>#${escapeHtml(t)}</i>`).join(" "),
        );
      if (link) metaBits.push(`<a href="${link}">open</a>`);
      out.push(
        `<blockquote style="border-left:3px solid ${color};margin:6px 0;padding:2px 10px;">`,
      );
      if (quote) out.push(`<div>${escapeHtml(quote)}</div>`);
      if (note)
        out.push(
          `<div style="color:#555;margin-top:4px;">${escapeHtml(note)}</div>`,
        );
      if (metaBits.length)
        out.push(
          `<div style="font-size:.85em;color:#777;margin-top:4px;">${metaBits.join(" · ")}</div>`,
        );
      out.push(`</blockquote>`);
    }
  }
  return out.join("\n");
}

/** Copy a digest of the filtered annotations to the clipboard. */
export function copyToClipboard(
  records: AnnRecord[],
  format: "markdown" | "html",
) {
  const text = format === "html" ? toHtml(records) : toMarkdown(records);
  new ztoolkit.Clipboard().addText(text, "text/unicode").copy();
}

/**
 * Materialise the filtered set as a standalone Zotero note — the seed of the
 * cross-paper, taggable layer. The note is searchable in Zotero and every
 * annotation keeps a deep link back to its source.
 */
export async function exportToStandaloneNote(
  records: AnnRecord[],
  libraryID?: number,
): Promise<Zotero.Item> {
  const note = new Zotero.Item("note");
  note.libraryID = libraryID ?? Zotero.Libraries.userLibraryID;
  note.setNote(toHtml(records));
  await note.saveTx();
  return note;
}
