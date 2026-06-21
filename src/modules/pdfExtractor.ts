export interface PageChunk {
  pageIndex: number;
  pageNumber: number;
  text: string;
}

function splitIntoPages(text: string): PageChunk[] {
  const parts = text
    .split("\x0C")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (parts.length > 1) {
    return parts.map((pageText, index) => ({
      pageIndex: index,
      pageNumber: index + 1,
      text: pageText,
    }));
  }
  // No form-feed separators — return as single page
  return [{ pageIndex: 0, pageNumber: 1, text: text.trim() }];
}

/** Resolve the first PDF attachment ID for an item (or the item itself if it is one). */
export function findPdfAttachmentID(item: Zotero.Item): number | null {
  if (item.isAttachment()) {
    return (item as any).attachmentContentType === "application/pdf"
      ? item.id
      : null;
  }
  if (item.isRegularItem()) {
    for (const id of item.getAttachments()) {
      const att = Zotero.Items.get(id) as Zotero.Item;
      if (
        att?.isAttachment() &&
        (att as any).attachmentContentType === "application/pdf"
      ) {
        return id;
      }
    }
  }
  return null;
}

export async function extractPDFPages(item: Zotero.Item): Promise<PageChunk[]> {
  const attachmentID = findPdfAttachmentID(item);

  if (!attachmentID) return [];

  try {
    const result = await (Zotero.PDFWorker as any).getFullText(
      attachmentID,
      0,
      true,
    );

    // 1. Structured per-page data (ideal)
    if (result?.pages?.length > 0) {
      return (result.pages as any[])
        .map((page, index) => ({
          pageIndex: index,
          pageNumber: index + 1,
          text: (page.text || "").trim(),
        }))
        .filter((chunk) => chunk.text.length > 0);
    }

    // 2. Flat text — split on form-feed (PDF standard page break)
    const fullText: string = result?.text ?? "";
    if (fullText.trim()) {
      return splitIntoPages(fullText);
    }
  } catch (e) {
    ztoolkit.log("PDFWorker.getFullText failed, trying fulltext index:", e);
  }

  // 3. Zotero's own fulltext index as last resort
  try {
    const attachment = Zotero.Items.get(attachmentID) as Zotero.Item;
    const indexed = await (Zotero.Fulltext as any).getItemContent(attachment);
    const text: string = indexed?.content ?? "";
    if (text.trim()) return splitIntoPages(text);
  } catch (e) {
    ztoolkit.log("Fulltext index fallback failed:", e);
  }

  return [];
}
