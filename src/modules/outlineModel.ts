/**
 * outlineModel — the Citavi-style "knowledge organizer" data layer.
 *
 * The idea layer (ideaLayer) gives you cross-paper thoughts; this goes one step
 * further and lets you build the *structure* of the thing you're writing — an
 * outline of headings for your book/paper — and file quotes and notes under
 * those headings as you read. Gather it all back per heading and you have a
 * first draft.
 *
 * Two pieces of state, both stored natively (no custom DB), consistent with the
 * rest of the plugin:
 *
 *  1. A heading IS a Zotero tag, prefixed with HEADING_PREFIX. Because it's a
 *     real tag, you can file an annotation under a heading straight from
 *     Zotero's own reader tag UI while reading — no special mode required — and
 *     everything so tagged is gathered automatically.
 *
 *  2. The outline *tree* (hierarchy + sibling order — the one thing a flat tag
 *     can't express) lives in a single standalone note tagged OUTLINE_TAG, as
 *     JSON inside a <pre><code> block. The note syncs like any other item and
 *     is the single source of truth for structure.
 *
 * The tree-manipulation functions below are pure (no Zotero calls) so they can
 * be unit-tested outside Zotero; anything that touches the library is on the
 * OutlineModel class.
 */

import {
  AnnotationIndex,
  AnnRecord,
  uriLibraryPrefix,
} from "./annotationIndex";
import { citationFor } from "./annotationExport";

/** Marker tag identifying the standalone note that stores the outline tree. */
export const OUTLINE_TAG = "★outline";

/** Prefix that turns a heading title into its backing Zotero tag. */
export const HEADING_PREFIX = "§";

/** First line of the code block, so we can find our JSON payload reliably. */
const SENTINEL = "LATTICE-OUTLINE-V1";

export interface OutlineNode {
  id: string;
  title: string;
  children: OutlineNode[];
}

/** A quote/note/source filed under a heading, flattened for display + export. */
export interface FiledItem {
  itemID: number;
  kind: "annotation" | "note" | "source";
  /** Source paper title (annotation/source) or note title. */
  title: string;
  /** Highlighted quote (annotation) or note body text. */
  quote: string;
  /** Reader's comment on an annotation. */
  comment: string;
  pageLabel: string;
  /** Formatted citation for the source paper (honours QuickCopy style). */
  citation: string;
  tags: string[];
  /** zotero:// deep link back to the source, when one can be built. */
  link: string;
  key: string;
}

/** The tag a heading files things under. */
export function headingTag(title: string): string {
  return HEADING_PREFIX + title.trim();
}

// ── pure tree operations (no Zotero) ─────────────────────────────────────────

let idCounter = 0;
/** Short, collision-resistant id for a node. */
export function genId(): string {
  idCounter = (idCounter + 1) % 1e6;
  return (
    Date.now().toString(36) +
    idCounter.toString(36) +
    Math.random().toString(36).slice(2, 6)
  );
}

interface Located {
  node: OutlineNode;
  siblings: OutlineNode[];
  index: number;
  parent: OutlineNode | null;
}

/** Depth-first search for a node, returning it with its sibling context. */
export function locate(
  roots: OutlineNode[],
  id: string,
  parent: OutlineNode | null = null,
): Located | null {
  for (let i = 0; i < roots.length; i++) {
    if (roots[i].id === id) {
      return { node: roots[i], siblings: roots, index: i, parent };
    }
    const found = locate(roots[i].children, id, roots[i]);
    if (found) return found;
  }
  return null;
}

/** Every title currently in the tree, lower-cased (for duplicate checks). */
export function allTitlesLower(roots: OutlineNode[]): Set<string> {
  const set = new Set<string>();
  const walk = (nodes: OutlineNode[]) => {
    for (const n of nodes) {
      set.add(n.title.trim().toLowerCase());
      walk(n.children);
    }
  };
  walk(roots);
  return set;
}

/**
 * Because a heading is a tag, two headings with the same title would share a
 * tag and gather each other's items. Titles must therefore be unique across the
 * whole tree; this reports why an add/rename would be rejected (or "" if ok).
 * `exceptId` lets a rename keep its own current title.
 */
export function titleError(
  roots: OutlineNode[],
  title: string,
  exceptId?: string,
): string {
  const t = title.trim();
  if (!t) return "Heading can't be empty";
  if (t.includes("\n")) return "Heading can't contain a line break";
  const existing = allTitlesLower(roots);
  if (exceptId) {
    const cur = locate(roots, exceptId)?.node.title.trim().toLowerCase();
    if (cur && cur === t.toLowerCase()) return ""; // unchanged
  }
  if (existing.has(t.toLowerCase())) return "A heading with that title exists";
  return "";
}

export function makeNode(title: string): OutlineNode {
  return { id: genId(), title: title.trim(), children: [] };
}

/** Move a node one slot earlier among its siblings. Returns true if it moved. */
export function moveUp(roots: OutlineNode[], id: string): boolean {
  const loc = locate(roots, id);
  if (!loc || loc.index === 0) return false;
  const s = loc.siblings;
  [s[loc.index - 1], s[loc.index]] = [s[loc.index], s[loc.index - 1]];
  return true;
}

/** Move a node one slot later among its siblings. */
export function moveDown(roots: OutlineNode[], id: string): boolean {
  const loc = locate(roots, id);
  if (!loc || loc.index >= loc.siblings.length - 1) return false;
  const s = loc.siblings;
  [s[loc.index + 1], s[loc.index]] = [s[loc.index], s[loc.index + 1]];
  return true;
}

/** Indent: make a node the last child of its previous sibling. */
export function indent(roots: OutlineNode[], id: string): boolean {
  const loc = locate(roots, id);
  if (!loc || loc.index === 0) return false;
  const prev = loc.siblings[loc.index - 1];
  loc.siblings.splice(loc.index, 1);
  prev.children.push(loc.node);
  return true;
}

/** Outdent: move a node to be the next sibling of its parent. */
export function outdent(roots: OutlineNode[], id: string): boolean {
  const loc = locate(roots, id);
  if (!loc || !loc.parent) return false;
  const parentLoc = locate(roots, loc.parent.id);
  if (!parentLoc) return false;
  loc.siblings.splice(loc.index, 1);
  parentLoc.siblings.splice(parentLoc.index + 1, 0, loc.node);
  return true;
}

/** Remove a node (and its subtree); returns the removed node or null. */
export function removeNode(
  roots: OutlineNode[],
  id: string,
): OutlineNode | null {
  const loc = locate(roots, id);
  if (!loc) return null;
  loc.siblings.splice(loc.index, 1);
  return loc.node;
}

/** Every title in a subtree (the node itself + all descendants). */
export function subtreeTitles(node: OutlineNode): string[] {
  const out: string[] = [];
  const walk = (n: OutlineNode) => {
    out.push(n.title);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

export interface FlatNode {
  node: OutlineNode;
  depth: number;
}

/** Depth-first flatten in outline order, carrying each node's depth. */
export function flatten(roots: OutlineNode[]): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (nodes: OutlineNode[], depth: number) => {
    for (const n of nodes) {
      out.push({ node: n, depth });
      walk(n.children, depth + 1);
    }
  };
  walk(roots, 0);
  return out;
}

// ── serialization ────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unescapeHtml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

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

/** Render the outline note's HTML: a human-readable list + the JSON payload. */
export function serializeOutline(roots: OutlineNode[]): string {
  const json = JSON.stringify({ v: 1, roots });
  const readable = renderReadable(roots);
  // The <pre><code> block is the source of truth on read; the list above it is
  // just so the note is glanceable inside Zotero itself.
  return (
    `<h1>📚 Lattice — Knowledge Organizer outline</h1>` +
    readable +
    `<pre><code>${SENTINEL}\n${escapeHtml(json)}</code></pre>`
  );
}

function renderReadable(roots: OutlineNode[]): string {
  if (!roots.length) return "<p><em>(empty outline)</em></p>";
  const walk = (nodes: OutlineNode[]): string =>
    "<ul>" +
    nodes
      .map(
        (n) =>
          `<li>${escapeHtml(n.title)}${
            n.children.length ? walk(n.children) : ""
          }</li>`,
      )
      .join("") +
    "</ul>";
  return walk(roots);
}

/** Parse the tree back out of a stored outline note's HTML. */
export function parseOutline(noteHtml: string): OutlineNode[] {
  const m = noteHtml.match(new RegExp(SENTINEL + "\\s*([\\s\\S]*?)</code>"));
  if (!m) return [];
  try {
    const parsed = JSON.parse(unescapeHtml(m[1].trim()));
    const roots = parsed?.roots;
    return Array.isArray(roots) ? sanitizeTree(roots) : [];
  } catch {
    return [];
  }
}

/** Defensively coerce parsed JSON into well-formed OutlineNodes. */
function sanitizeTree(nodes: any[]): OutlineNode[] {
  const out: OutlineNode[] = [];
  for (const n of nodes) {
    if (!n || typeof n.title !== "string") continue;
    out.push({
      id: typeof n.id === "string" && n.id ? n.id : genId(),
      title: n.title,
      children: Array.isArray(n.children) ? sanitizeTree(n.children) : [],
    });
  }
  return out;
}

// ── library-touching layer ───────────────────────────────────────────────────

function isAnnotation(item: Zotero.Item): boolean {
  return (
    !!item &&
    typeof (item as any).isAnnotation === "function" &&
    (item as any).isAnnotation()
  );
}

export class OutlineModel {
  /** Locate the outline-storage note for a library (newest wins), or null. */
  private static async findNote(
    libraryID: number,
  ): Promise<Zotero.Item | null> {
    const ids = (await (Zotero.Items as any).getAll(
      libraryID,
      false,
      false,
      true,
    )) as number[] | undefined;
    const items = (await Zotero.Items.getAsync(ids || [])) as Zotero.Item[];
    const notes = items.filter(
      (i) =>
        typeof i.isNote === "function" &&
        i.isNote() &&
        i.getTags().some((t) => t.tag === OUTLINE_TAG),
    );
    notes.sort((a, b) =>
      (b.dateModified || "").localeCompare(a.dateModified || ""),
    );
    return notes[0] || null;
  }

  /** Load the outline tree for a library (empty tree if none exists yet). */
  static async load(
    libraryID: number,
  ): Promise<{ noteID: number | null; roots: OutlineNode[] }> {
    const note = await this.findNote(libraryID);
    if (!note) return { noteID: null, roots: [] };
    return { noteID: note.id, roots: parseOutline(note.getNote()) };
  }

  /**
   * Persist the tree. Creates the storage note on first save, updates it after.
   * Returns the note id so the caller can keep saving to the same note.
   */
  static async save(
    libraryID: number,
    noteID: number | null,
    roots: OutlineNode[],
  ): Promise<number> {
    const html = serializeOutline(roots);
    let note = noteID ? (Zotero.Items.get(noteID) as Zotero.Item) : null;
    if (!note || !note.isNote?.()) {
      note = new Zotero.Item("note");
      note.libraryID = libraryID;
      note.setNote(html);
      note.addTag(OUTLINE_TAG);
      await note.saveTx();
      return note.id;
    }
    note.setNote(html);
    if (!note.getTags().some((t) => t.tag === OUTLINE_TAG))
      note.addTag(OUTLINE_TAG);
    await note.saveTx();
    return note.id;
  }

  /** Item ids in a library carrying a given tag (annotations included). */
  private static async itemsWithTag(
    libraryID: number,
    tag: string,
  ): Promise<number[]> {
    try {
      const search = new Zotero.Search();
      (search as any).libraryID = libraryID;
      search.addCondition("tag", "is", tag);
      return (await search.search()) as number[];
    } catch (e) {
      ztoolkit.log("outlineModel itemsWithTag search failed:", e);
      return [];
    }
  }

  /** File an item (annotation, note or paper) under a heading. */
  static async fileUnder(itemID: number, tag: string): Promise<void> {
    const item = Zotero.Items.get(itemID) as Zotero.Item;
    if (!item) return;
    if (item.getTags().some((t) => t.tag === tag)) return;
    item.addTag(tag);
    await item.saveTx();
  }

  /** Remove an item from a heading. */
  static async unfile(itemID: number, tag: string): Promise<void> {
    const item = Zotero.Items.get(itemID) as Zotero.Item;
    if (!item) return;
    item.removeTag(tag);
    await item.saveTx();
  }

  /**
   * Rename a heading's tag across every item that carries it, so filed quotes
   * and notes follow the rename. Search covers annotations, notes and papers.
   */
  static async renameTag(
    libraryID: number,
    oldTag: string,
    newTag: string,
  ): Promise<void> {
    if (oldTag === newTag) return;
    const ids = await this.itemsWithTag(libraryID, oldTag);
    const items = (await Zotero.Items.getAsync(ids)) as Zotero.Item[];
    for (const item of items) {
      try {
        item.removeTag(oldTag);
        if (!item.getTags().some((t) => t.tag === newTag)) item.addTag(newTag);
        await item.saveTx();
      } catch (e) {
        ztoolkit.log("outlineModel renameTag: one item failed:", e);
      }
    }
  }

  /** Strip a heading's tag from every item (used when deleting a heading). */
  static async purgeTag(libraryID: number, tag: string): Promise<void> {
    const ids = await this.itemsWithTag(libraryID, tag);
    const items = (await Zotero.Items.getAsync(ids)) as Zotero.Item[];
    for (const item of items) {
      try {
        item.removeTag(tag);
        await item.saveTx();
      } catch (e) {
        ztoolkit.log("outlineModel purgeTag: one item failed:", e);
      }
    }
  }

  private static annotationToFiled(rec: AnnRecord): FiledItem {
    const paper = Zotero.Items.get(rec.parentItemID) as Zotero.Item | undefined;
    const link = rec.attachmentKey
      ? `zotero://open-pdf/${rec.libraryPrefix}/items/${rec.attachmentKey}?annotation=${rec.key}`
      : "";
    return {
      itemID: rec.id,
      kind: "annotation",
      title: rec.parentTitle,
      quote: rec.text,
      comment: rec.comment,
      pageLabel: rec.pageLabel,
      citation: paper ? citationFor(paper) : rec.parentTitle,
      tags: rec.tags,
      link,
      key: rec.key,
    };
  }

  private static noteToFiled(item: Zotero.Item): FiledItem {
    // A note filed under a heading (e.g. a promoted idea). Cite its first
    // related regular item, if any, so the draft still points at a source.
    let citation = "";
    for (const key of item.relatedItems || []) {
      const rel = Zotero.Items.getByLibraryAndKey(item.libraryID, key) as
        | Zotero.Item
        | false;
      if (rel && rel.isRegularItem?.()) {
        citation = citationFor(rel);
        break;
      }
    }
    const prefix = uriLibraryPrefix(item.libraryID);
    return {
      itemID: item.id,
      kind: "note",
      title: item.getNoteTitle?.() || "(note)",
      quote: htmlToText(item.getNote()),
      comment: "",
      pageLabel: "",
      citation,
      tags: item.getTags().map((t) => t.tag),
      link: `zotero://select/${prefix}/items/${item.key}`,
      key: item.key,
    };
  }

  private static sourceToFiled(item: Zotero.Item): FiledItem {
    const prefix = uriLibraryPrefix(item.libraryID);
    return {
      itemID: item.id,
      kind: "source",
      title: item.getDisplayTitle?.() || "(item)",
      quote: "",
      comment: "",
      pageLabel: "",
      citation: citationFor(item),
      tags: item.getTags().map((t) => t.tag),
      link: `zotero://select/${prefix}/items/${item.key}`,
      key: item.key,
    };
  }

  /** Everything filed under a heading: quotes, notes and whole papers. */
  static async gather(libraryID: number, tag: string): Promise<FiledItem[]> {
    const out: FiledItem[] = [];
    const seen = new Set<number>();

    // Quotes come from the in-memory annotation index (fast, deep-linkable).
    await AnnotationIndex.ensureBuilt(libraryID);
    for (const rec of AnnotationIndex.filter({ tags: [tag] })) {
      if (rec.libraryID !== libraryID) continue;
      if (seen.has(rec.id)) continue;
      seen.add(rec.id);
      out.push(this.annotationToFiled(rec));
    }

    // Notes and whole papers come from a tag search (annotations may be omitted
    // from search results, which is why they're handled via the index above).
    const ids = await this.itemsWithTag(libraryID, tag);
    const items = (await Zotero.Items.getAsync(ids)) as Zotero.Item[];
    for (const item of items) {
      if (!item || seen.has(item.id)) continue;
      if (isAnnotation(item)) continue;
      seen.add(item.id);
      if (item.isNote?.()) out.push(this.noteToFiled(item));
      else if (item.isRegularItem?.()) out.push(this.sourceToFiled(item));
    }
    return out;
  }

  /**
   * Tag → count of items filed under it, for every heading-prefixed tag in the
   * library. One index pass + one tag search, so the tree can show live badges
   * without gathering each heading separately.
   */
  static async buildCountMap(libraryID: number): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    const bump = (tag: string) => counts.set(tag, (counts.get(tag) || 0) + 1);

    await AnnotationIndex.ensureBuilt(libraryID);
    for (const rec of AnnotationIndex.all()) {
      if (rec.libraryID !== libraryID) continue;
      for (const t of rec.tags) if (t.startsWith(HEADING_PREFIX)) bump(t);
    }

    // Notes/papers carrying a heading tag (annotations already counted above).
    try {
      const search = new Zotero.Search();
      (search as any).libraryID = libraryID;
      search.addCondition("tag", "contains", HEADING_PREFIX);
      const ids = (await search.search()) as number[];
      const items = (await Zotero.Items.getAsync(ids)) as Zotero.Item[];
      for (const item of items) {
        if (!item || isAnnotation(item)) continue;
        for (const t of item.getTags())
          if (t.tag.startsWith(HEADING_PREFIX)) bump(t.tag);
      }
    } catch (e) {
      ztoolkit.log("outlineModel buildCountMap search failed:", e);
    }
    return counts;
  }

  /**
   * Candidate quotes/notes for the assign picker: annotations and ideas
   * matching a keyword that are NOT already filed under `tag`.
   */
  static async assignCandidates(
    libraryID: number,
    tag: string,
    keyword: string,
    limit = 40,
  ): Promise<FiledItem[]> {
    await AnnotationIndex.ensureBuilt(libraryID);
    const kw = keyword.trim().toLowerCase();
    const out: FiledItem[] = [];
    for (const rec of AnnotationIndex.all()) {
      if (rec.libraryID !== libraryID) continue;
      if (rec.tags.includes(tag)) continue;
      if (kw) {
        const hay = (
          rec.text +
          "\n" +
          rec.comment +
          "\n" +
          rec.parentTitle
        ).toLowerCase();
        if (!hay.includes(kw)) continue;
      }
      out.push(this.annotationToFiled(rec));
      if (out.length >= limit) break;
    }
    return out;
  }
}
