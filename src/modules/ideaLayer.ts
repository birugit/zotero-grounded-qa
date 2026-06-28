/**
 * ideaLayer — the Citavi-style cross-paper "idea" layer.
 *
 * The annotation browser (annotationIndex/annotationPanel) gets highlights out
 * of the per-paper silo for viewing/filtering/export. This goes a step further:
 * a first-class, editable, taggable "idea" object that lives in its own layer
 * but stays linked to its source(s) and can be linked to other ideas — the
 * Citavi "thought" model.
 *
 * Storage is intentionally native: an idea IS a standalone Zotero note tagged
 * with IDEA_TAG. That means ideas are fully searchable and taggable in Zotero
 * itself, they sync, and links use Zotero's own item-relation system. No custom
 * database, nothing for the rest of the plugin to break against.
 */

import { AnnRecord } from "./annotationIndex";

/** Marker tag that identifies a note as an idea in the Citavi layer. */
export const IDEA_TAG = "★idea";

export interface IdeaRecord {
  id: number;
  key: string;
  libraryID: number;
  title: string;
  text: string; // plain-text rendering of the note
  tags: string[]; // excludes IDEA_TAG
  dateModified: string;
  linkedIdeaIDs: number[]; // related items that are themselves ideas
  sourceItemIDs: number[]; // related items that are regular items (papers)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Best-effort HTML → plain text for previews. */
function htmlToText(html: string): string {
  return (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|blockquote|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isIdea(item: Zotero.Item): boolean {
  return (
    !!item &&
    typeof item.isNote === "function" &&
    item.isNote() &&
    item.getTags().some((t) => t.tag === IDEA_TAG)
  );
}

export class IdeaLayer {
  /** Resolve a related item by key within a library. */
  private static resolve(libraryID: number, key: string): Zotero.Item | null {
    const it = Zotero.Items.getByLibraryAndKey(libraryID, key) as
      | Zotero.Item
      | false;
    return it || null;
  }

  private static toRecord(item: Zotero.Item): IdeaRecord {
    const linkedIdeaIDs: number[] = [];
    const sourceItemIDs: number[] = [];
    for (const key of item.relatedItems || []) {
      const rel = this.resolve(item.libraryID, key);
      if (!rel) continue;
      if (isIdea(rel)) linkedIdeaIDs.push(rel.id);
      else if (rel.isRegularItem?.()) sourceItemIDs.push(rel.id);
    }
    const html = item.getNote();
    return {
      id: item.id,
      key: item.key,
      libraryID: item.libraryID,
      title: item.getNoteTitle() || "(untitled idea)",
      text: htmlToText(html),
      tags: item
        .getTags()
        .map((t) => t.tag)
        .filter((t) => t !== IDEA_TAG),
      dateModified: item.dateModified || "",
      linkedIdeaIDs,
      sourceItemIDs,
    };
  }

  /** All ideas in the library, newest-modified first. */
  static async all(libraryID?: number): Promise<IdeaRecord[]> {
    const lib = libraryID ?? Zotero.Libraries.userLibraryID;
    const ids = (await (Zotero.Items as any).getAll(
      lib,
      false,
      false,
      true,
    )) as number[] | undefined;
    const items = (await Zotero.Items.getAsync(ids || [])) as Zotero.Item[];
    return items
      .filter((i) => isIdea(i))
      .map((i) => this.toRecord(i))
      .sort((a, b) => b.dateModified.localeCompare(a.dateModified));
  }

  /** Distinct tags used across ideas (excludes the marker tag). */
  static async tags(libraryID?: number): Promise<string[]> {
    const set = new Set<string>();
    for (const idea of await this.all(libraryID))
      for (const t of idea.tags) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  /** Create a blank idea note. */
  static async createBlank(
    text = "New idea",
    libraryID?: number,
  ): Promise<Zotero.Item> {
    const note = new Zotero.Item("note");
    note.libraryID = libraryID ?? Zotero.Libraries.userLibraryID;
    note.setNote(`<p>${escapeHtml(text)}</p>`);
    note.addTag(IDEA_TAG);
    await note.saveTx();
    return note;
  }

  /**
   * Promote an annotation into an idea: seed the note with the highlight + the
   * reader's comment, carry over the annotation's tags, and relate the idea to
   * its source paper so it stays linked.
   */
  static async createFromAnnotation(rec: AnnRecord): Promise<Zotero.Item> {
    const source = Zotero.Items.get(rec.parentItemID) as
      | Zotero.Item
      | undefined;
    const libraryID = source?.libraryID ?? Zotero.Libraries.userLibraryID;

    const parts: string[] = [];
    if (rec.text)
      parts.push(`<blockquote>${escapeHtml(rec.text)}</blockquote>`);
    if (rec.comment) parts.push(`<p>${escapeHtml(rec.comment)}</p>`);
    const srcLabel =
      (rec.parentTitle || "source") +
      (rec.pageLabel ? `, p. ${rec.pageLabel}` : "");
    if (rec.attachmentKey) {
      const deep = `zotero://open-pdf/${rec.libraryPrefix}/items/${rec.attachmentKey}?annotation=${rec.key}`;
      parts.push(
        `<p>Source: <a href="${deep}">${escapeHtml(srcLabel)}</a></p>`,
      );
    } else {
      parts.push(`<p>Source: ${escapeHtml(srcLabel)}</p>`);
    }

    const note = new Zotero.Item("note");
    note.libraryID = libraryID;
    note.setNote(parts.join("\n"));
    note.addTag(IDEA_TAG);
    for (const t of rec.tags) note.addTag(t);

    // Relate to the source paper (bidirectional) before the first save where
    // possible; relations require both items to exist, so save the note first.
    await note.saveTx();
    if (source) {
      try {
        note.addRelatedItem(source);
        await note.saveTx();
        source.addRelatedItem(note);
        await source.saveTx();
      } catch (e) {
        ztoolkit.log("ideaLayer: relating to source failed:", e);
      }
    }
    return note;
  }

  static async addTag(ideaID: number, tag: string): Promise<void> {
    const t = tag.trim();
    if (!t) return;
    const item = Zotero.Items.get(ideaID) as Zotero.Item;
    if (!item) return;
    item.addTag(t);
    await item.saveTx();
  }

  static async removeTag(ideaID: number, tag: string): Promise<void> {
    const item = Zotero.Items.get(ideaID) as Zotero.Item;
    if (!item) return;
    item.removeTag(tag);
    await item.saveTx();
  }

  static async setText(ideaID: number, text: string): Promise<void> {
    const item = Zotero.Items.get(ideaID) as Zotero.Item;
    if (!item) return;
    // Preserve as simple paragraphs so the note stays editable in Zotero.
    const html = text
      .split(/\n{2,}/)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
      .join("\n");
    item.setNote(html);
    await item.saveTx();
  }

  /** Link two ideas (bidirectional relation). */
  static async link(aID: number, bID: number): Promise<void> {
    if (aID === bID) return;
    const a = Zotero.Items.get(aID) as Zotero.Item;
    const b = Zotero.Items.get(bID) as Zotero.Item;
    if (!a || !b) {
      throw new Error(`Idea not found (a=${aID} b=${bID})`);
    }
    if (a.libraryID !== b.libraryID) {
      throw new Error("Cannot link ideas across libraries");
    }
    a.addRelatedItem(b);
    b.addRelatedItem(a);
    await a.saveTx();
    await b.saveTx();
  }

  static async unlink(aID: number, bID: number): Promise<void> {
    const a = Zotero.Items.get(aID) as Zotero.Item;
    const b = Zotero.Items.get(bID) as Zotero.Item;
    if (!a || !b) return;
    if (await a.removeRelatedItem(b)) await a.saveTx();
    if (await b.removeRelatedItem(a)) await b.saveTx();
  }

  /** Move an idea to the trash. */
  static async remove(ideaID: number): Promise<void> {
    const item = Zotero.Items.get(ideaID) as Zotero.Item;
    if (!item) return;
    await item.eraseTx();
  }
}
