/**
 * annotationWriter — create real Zotero annotations programmatically.
 *
 * Grounded Q&A produces answers with [Page N] citations but never wrote
 * anything back into Zotero, so its insights never reached the cross-paper
 * annotation layer. This bridges the two: a Q&A answer can be saved as a
 * page-anchored "note" annotation on the source PDF, which then flows into the
 * All Annotations browser via the Notifier just like a hand-made highlight.
 */

import { findPdfAttachmentID } from "./pdfExtractor";

/**
 * Zotero orders annotations in the sidebar by a `pageIndex|offset|y` string.
 * We anchor to the page and pin to the top, which is enough for a note created
 * from a citation (we don't have a precise glyph offset from the LLM answer).
 */
function makeSortIndex(pageIndex: number): string {
  return [String(pageIndex).padStart(5, "0"), "000000", "00000"].join("|");
}

export interface SaveNoteAnnotationOpts {
  /** The paper (or its PDF attachment) shown in the Q&A panel. */
  item: Zotero.Item;
  /** 1-based page to anchor to; defaults to 1 if not cited. */
  pageNumber?: number;
  /** Note body. */
  comment: string;
  /** Optional tags, e.g. ["grounded-qa"]. */
  tags?: string[];
}

/** Create a page-anchored note annotation on the item's PDF attachment. */
export async function saveNoteAnnotation(
  opts: SaveNoteAnnotationOpts,
): Promise<Zotero.Item> {
  const attachmentID = findPdfAttachmentID(opts.item);
  if (!attachmentID) {
    throw new Error("No PDF attachment found to annotate.");
  }
  const attachment = Zotero.Items.get(attachmentID) as Zotero.Item;

  const page = opts.pageNumber && opts.pageNumber > 0 ? opts.pageNumber : 1;
  const pageIndex = page - 1;

  const json: any = {
    // saveFromJSON requires a key and does not generate one itself.
    key: (Zotero as any).DataObjectUtilities.generateKey(),
    type: "note",
    comment: opts.comment,
    color: (Zotero.Annotations as any).DEFAULT_COLOR || "#ffd400",
    pageLabel: String(page),
    sortIndex: makeSortIndex(pageIndex),
    // Pin near the top-left of the page; the LLM gives us a page, not glyph rects.
    position: { pageIndex, rects: [[24, 750, 48, 774]] },
    tags: (opts.tags || []).map((t) => ({ name: t })),
  };

  return await Zotero.Annotations.saveFromJSON(attachment, json);
}
