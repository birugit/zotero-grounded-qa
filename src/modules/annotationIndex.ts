/**
 * annotationIndex — the cross-paper data layer.
 *
 * Zotero stores every highlight/note/underline as a first-class item
 * (`itemType === "annotation"`) parented to a PDF/EPUB attachment, which is in
 * turn parented to the paper. The reader UI only ever shows you one attachment's
 * annotations at a time; this module lifts them all into a single in-memory
 * index so they can be browsed, filtered and exported library-wide.
 *
 * The index is built once and then patched incrementally from Notifier events
 * so it stays cheap on libraries with tens of thousands of annotations.
 */

export interface AnnRecord {
  id: number;
  key: string;
  type: string; // "highlight" | "note" | "underline" | "image" | "ink" | "text"
  color: string; // "#ffd400" etc. ("" if none)
  text: string; // annotationText (the highlighted quote)
  comment: string; // annotationComment (the reader's note)
  pageLabel: string; // annotationPageLabel
  tags: string[];
  dateModified: string;
  attachmentID: number; // the PDF/EPUB the annotation lives on
  attachmentKey: string; // used to build deep links back to the source
  parentItemID: number; // the paper — link to source + citation target
  parentTitle: string;
  libraryID: number; // which library this annotation belongs to
  libraryPrefix: string; // "library" or "groups/<id>" for zotero:// deep links
}

/** The path segment a zotero:// URL needs for an item's library. */
export function uriLibraryPrefix(libraryID: number): string {
  try {
    if (libraryID === Zotero.Libraries.userLibraryID) return "library";
    const groupID = (Zotero as any).Groups.getGroupIDFromLibraryID(libraryID);
    return `groups/${groupID}`;
  } catch {
    return "library";
  }
}

export class AnnotationIndex {
  /** id → record. Single source of truth for the UI. */
  private static records = new Map<number, AnnRecord>();
  private static built = false;
  private static observerID: string | null = null;
  /** Library the current index was built for (for incremental-update scoping). */
  static builtLibraryID: number | null = null;

  /** Register the Notifier observer. Safe to call once at startup. */
  static init() {
    if (this.observerID) return;
    const observer = {
      notify: (
        event: string,
        type: string,
        ids: Array<string | number>,
        _extraData: { [key: string]: any },
      ) => {
        if (type !== "item") return;
        // Fire-and-forget; the panel re-reads the index on its own cadence.
        this.handleNotify(event, ids).catch((e) =>
          ztoolkit.log("annotationIndex notify error:", e),
        );
      },
    };
    this.observerID = Zotero.Notifier.registerObserver(
      observer,
      ["item"],
      "annotationIndex",
    );
  }

  static unload() {
    if (this.observerID) {
      Zotero.Notifier.unregisterObserver(this.observerID);
      this.observerID = null;
    }
    this.records.clear();
    this.built = false;
  }

  /** Build (or rebuild) the full index for a library. */
  static async build(libraryID?: number): Promise<void> {
    const lib = libraryID ?? Zotero.Libraries.userLibraryID;
    this.records.clear();
    this.builtLibraryID = lib;

    // Pull every item in the library and keep the annotations. getAll with
    // asIDs=true keeps memory down on large libraries; we hydrate in batches.
    const ids = (await (Zotero.Items as any).getAll(
      lib,
      false, // onlyTopLevel
      false, // includeDeleted
      true, // asIDs
    )) as number[];

    const items = (await Zotero.Items.getAsync(ids)) as Zotero.Item[];
    for (const item of items) {
      if (this.isAnnotation(item)) {
        const rec = this.toRecord(item);
        if (rec) this.records.set(rec.id, rec);
      }
    }
    this.built = true;
  }

  static isBuilt() {
    return this.built;
  }

  /** Return all records, newest-modified first. */
  static all(): AnnRecord[] {
    return Array.from(this.records.values()).sort((a, b) =>
      b.dateModified.localeCompare(a.dateModified),
    );
  }

  /** Distinct colours present in the index (for the filter swatches). */
  static colors(): string[] {
    const set = new Set<string>();
    for (const r of this.records.values()) if (r.color) set.add(r.color);
    return Array.from(set).sort();
  }

  /** Distinct tags present in the index (for the tag picker). */
  static tags(): string[] {
    const set = new Set<string>();
    for (const r of this.records.values()) for (const t of r.tags) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  /** Filter the index. All criteria are AND-ed; empty criteria match all. */
  static filter(opts: {
    colors?: string[];
    tags?: string[];
    keyword?: string;
    types?: string[];
  }): AnnRecord[] {
    const colors =
      opts.colors && opts.colors.length ? new Set(opts.colors) : null;
    const tags = opts.tags && opts.tags.length ? opts.tags : null;
    const types = opts.types && opts.types.length ? new Set(opts.types) : null;
    const kw = opts.keyword?.trim().toLowerCase() || "";

    return this.all().filter((r) => {
      if (colors && !colors.has(r.color)) return false;
      if (types && !types.has(r.type)) return false;
      if (tags && !tags.every((t) => r.tags.includes(t))) return false;
      if (kw) {
        const hay = (
          r.text +
          "\n" +
          r.comment +
          "\n" +
          r.parentTitle +
          "\n" +
          r.tags.join(" ")
        ).toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }

  // ── incremental maintenance ────────────────────────────────────────────────

  private static async handleNotify(
    event: string,
    ids: Array<string | number>,
  ) {
    if (!this.built) return; // nothing to patch yet
    const numIDs = ids.map((i) => Number(i)).filter((n) => !Number.isNaN(n));

    if (event === "delete" || event === "trash") {
      for (const id of numIDs) this.records.delete(id);
      return;
    }
    if (event === "add" || event === "modify") {
      const items = (await Zotero.Items.getAsync(numIDs)) as Zotero.Item[];
      for (const item of items) {
        if (!item) continue;
        if (
          this.isAnnotation(item) &&
          !(item as any).deleted &&
          (this.builtLibraryID == null ||
            item.libraryID === this.builtLibraryID)
        ) {
          const rec = this.toRecord(item);
          if (rec) this.records.set(rec.id, rec);
        } else {
          // e.g. an annotation that was un-annotated / restored from trash
          this.records.delete(item.id);
        }
      }
    }
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private static isAnnotation(item: Zotero.Item): boolean {
    if (!item) return false;
    if (typeof (item as any).isAnnotation === "function") {
      return (item as any).isAnnotation();
    }
    return (item as any).itemType === "annotation";
  }

  private static toRecord(item: Zotero.Item): AnnRecord | null {
    try {
      const attachment = (item as any).parentItem as Zotero.Item | undefined;
      const paper = attachment
        ? ((attachment as any).parentItem as Zotero.Item | undefined)
        : undefined;
      const source = paper ?? attachment;

      return {
        id: item.id,
        key: item.key,
        type: (item as any).annotationType || "",
        color: (item as any).annotationColor || "",
        text: (item as any).annotationText || "",
        comment: (item as any).annotationComment || "",
        pageLabel: (item as any).annotationPageLabel || "",
        tags: item.getTags().map((t) => t.tag),
        dateModified: item.dateModified || "",
        attachmentID: attachment?.id ?? item.id,
        attachmentKey: attachment?.key ?? "",
        parentItemID: source?.id ?? item.id,
        parentTitle: source?.getDisplayTitle?.() ?? "(untitled)",
        libraryID: item.libraryID,
        libraryPrefix: uriLibraryPrefix(item.libraryID),
      };
    } catch (e) {
      ztoolkit.log("annotationIndex toRecord failed:", e);
      return null;
    }
  }
}
