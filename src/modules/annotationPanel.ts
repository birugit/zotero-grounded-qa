/**
 * annotationPanel — the cross-paper browser UI.
 *
 * Opens a single library-wide window listing every annotation, with live
 * filters for colour, tag, type and keyword, and one-click export of the
 * filtered set (clipboard or standalone note). Clicking a row opens the source
 * PDF/EPUB at that annotation, so the "idea" stays linked to its paper.
 *
 * Rendering is windowed (a render cap + "Show more") so libraries with tens of
 * thousands of annotations stay responsive.
 */

import { AnnotationIndex, AnnRecord } from "./annotationIndex";
import { copyToClipboard, exportToStandaloneNote } from "./annotationExport";
import { IdeaLayer } from "./ideaLayer";
import { IdeaPanelFactory } from "./ideaPanel";
import { getTheme, Palette } from "./theme";
import { getString } from "../utils/locale";

const RENDER_CAP = 200; // rows drawn per "page" before "Show more"

const HTML_NS = "http://www.w3.org/1999/xhtml";

/**
 * Create an HTML <button>. In the dialog's XHTML window `createElement("button")`
 * can resolve to a XUL button (the tag exists in both namespaces), which ignores
 * textContent and renders blank — so force the HTML namespace explicitly.
 */
function htmlButton(doc: Document): HTMLButtonElement {
  return doc.createElementNS(HTML_NS, "button") as HTMLButtonElement;
}

/** Themed button with native theming disabled so the label always shows. */
function themedButton(
  doc: Document,
  label: string,
  t: Palette,
): HTMLButtonElement {
  const b = htmlButton(doc);
  b.textContent = label;
  b.style.cssText =
    `appearance:none;-moz-appearance:none;color:${t.text};` +
    `padding:5px 10px;cursor:pointer;border:1px solid ${t.border};` +
    `border-radius:4px;background:${t.btnBg};font-size:12px;`;
  return b;
}

interface PanelState {
  libraryID: number;
  selectedColors: Set<string>;
  selectedTags: Set<string>;
  selectedTypes: Set<string>;
  keyword: string;
  renderLimit: number;
}

export class AnnotationPanelFactory {
  /** Add a Tools-menu entry that opens the cross-paper browser. */
  static registerMenu() {
    ztoolkit.Menu.register("menuTools", {
      tag: "menuitem",
      id: "zotero-tools-annotation-browser",
      label: getString("annotations-menu-label"),
      icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`,
      commandListener: () => {
        AnnotationPanelFactory.open().catch((e) =>
          ztoolkit.log("annotation browser open failed:", e),
        );
      },
    });
  }

  static async open() {
    const libraryID = Zotero.Libraries.userLibraryID;
    const pw = new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({ text: "Indexing annotations…", type: "default" })
      .show();
    try {
      await AnnotationIndex.build(libraryID);
    } finally {
      pw.close();
    }

    const state: PanelState = {
      libraryID,
      selectedColors: new Set(),
      selectedTags: new Set(),
      selectedTypes: new Set(),
      keyword: "",
      renderLimit: RENDER_CAP,
    };

    const dialog = new ztoolkit.Dialog(1, 1).addCell(0, 0, {
      tag: "div",
      id: "ann-root",
      styles: {
        width: "760px",
        height: "560px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        fontSize: "13px",
      },
    });

    // The cell DOM only exists after the window has loaded, so build the UI in
    // the load callback rather than synchronously after open().
    dialog.setDialogData({
      loadCallback: () => {
        try {
          const doc = dialog.window.document;
          const root = doc.getElementById("ann-root") as HTMLElement | null;
          if (!root) {
            ztoolkit.log("annotation browser: ann-root cell missing");
            return;
          }
          this.buildTabbedUI(doc, root, state);
        } catch (e) {
          ztoolkit.log("annotation browser buildUI failed:", e);
        }
      },
    });
    dialog.open(getString("annotations-window-title"), {
      width: 800,
      height: 640,
      resizable: true,
    });
  }

  // ── UI construction ──────────────────────────────────────────────────────

  /**
   * Two tabs in one window: "Annotations" (the cross-paper highlight browser)
   * and "Ideas" (the Citavi idea layer). The Ideas pane is rendered lazily on
   * first activation.
   */
  private static buildTabbedUI(
    doc: Document,
    root: HTMLElement,
    state: PanelState,
  ) {
    root.textContent = "";
    const t = getTheme(doc);
    (root.style as any).colorScheme = t.colorScheme;
    root.style.background = t.bg;
    root.style.color = t.text;

    const tabBar = doc.createElement("div");
    tabBar.style.cssText =
      `display:flex;gap:4px;border-bottom:2px solid ${t.border};flex:0 0 auto;`;
    root.appendChild(tabBar);

    const annPane = doc.createElement("div");
    annPane.style.cssText =
      "display:flex;flex-direction:column;gap:8px;flex:1;min-height:0;";
    const ideaPane = doc.createElement("div");
    ideaPane.style.cssText =
      "display:none;flex-direction:column;gap:8px;flex:1;min-height:0;";
    root.appendChild(annPane);
    root.appendChild(ideaPane);

    const mkTab = (label: string) => {
      const el = doc.createElement("div");
      el.textContent = label;
      tabBar.appendChild(el);
      return el;
    };
    const annTab = mkTab("📑 Annotations");
    const ideaTab = mkTab("🧠 Ideas");

    const setActive = (which: "ann" | "idea") => {
      const active = `background:${t.panel};border-color:${t.border};color:${t.text};font-weight:600;`;
      const inactive = `border-color:transparent;color:${t.sub};font-weight:400;background:transparent;`;
      const base =
        "padding:6px 14px;cursor:pointer;font-size:13px;" +
        "border:1px solid transparent;border-bottom:none;" +
        "border-radius:6px 6px 0 0;margin-bottom:-2px;";
      annTab.style.cssText = base + (which === "ann" ? active : inactive);
      ideaTab.style.cssText = base + (which === "idea" ? active : inactive);
      annPane.style.display = which === "ann" ? "flex" : "none";
      ideaPane.style.display = which === "idea" ? "flex" : "none";
      // Re-render the Ideas pane on each activation so newly promoted ideas
      // always show (and to pick up edits made in Zotero).
      if (which === "idea") {
        ideaPane.textContent = "";
        IdeaPanelFactory.renderInto(doc, ideaPane);
      }
    };
    annTab.addEventListener("click", () => setActive("ann"));
    ideaTab.addEventListener("click", () => setActive("idea"));

    this.buildUI(doc, annPane, state);
    setActive("ann");
  }

  private static buildUI(doc: Document, root: HTMLElement, state: PanelState) {
    const all = AnnotationIndex.all();
    const t = getTheme(doc);
    (root.style as any).colorScheme = t.colorScheme;
    root.style.background = t.bg;
    root.style.color = t.text;

    // Filter bar ------------------------------------------------------------
    const bar = doc.createElement("div");
    bar.style.cssText =
      "display:flex;flex-direction:column;gap:6px;" +
      `border-bottom:1px solid ${t.border};padding-bottom:8px;`;
    root.appendChild(bar);

    // library selector row (shown only when there's more than one library)
    const libraries = Zotero.Libraries.getAll();
    if (libraries.length > 1) {
      const libRow = doc.createElement("div");
      libRow.style.cssText = "display:flex;gap:6px;align-items:center;";
      const lbl = doc.createElement("span");
      lbl.textContent = "Library:";
      lbl.style.cssText = `color:${t.sub};`;
      libRow.appendChild(lbl);
      const libSel = doc.createElement("select");
      libSel.style.cssText =
        `flex:1;padding:5px 6px;border:1px solid ${t.border};border-radius:4px;font-size:13px;background:${t.inputBg};color:${t.text};`;
      for (const lib of libraries) {
        const o = doc.createElement("option");
        o.value = String(lib.libraryID);
        o.textContent = lib.name + (lib.isGroup ? " (group)" : "");
        if (lib.libraryID === state.libraryID) o.selected = true;
        libSel.appendChild(o);
      }
      libSel.addEventListener("change", async () => {
        state.libraryID = Number(libSel.value);
        const pw = new ztoolkit.ProgressWindow(addon.data.config.addonName)
          .createLine({ text: "Indexing annotations…", type: "default" })
          .show();
        try {
          await AnnotationIndex.build(state.libraryID);
        } finally {
          pw.close();
        }
        // Reset filters (different library, different data) and rebuild pane.
        state.selectedColors.clear();
        state.selectedTags.clear();
        state.selectedTypes.clear();
        state.keyword = "";
        state.renderLimit = RENDER_CAP;
        root.textContent = "";
        this.buildUI(doc, root, state);
      });
      libRow.appendChild(libSel);
      bar.appendChild(libRow);
    }

    // keyword + type row
    const row1 = doc.createElement("div");
    row1.style.cssText = "display:flex;gap:6px;align-items:center;";
    bar.appendChild(row1);

    const search = doc.createElement("input");
    search.type = "search";
    search.placeholder = "Search text, comments, title, tags…";
    search.style.cssText =
      `flex:1;padding:5px 8px;border:1px solid ${t.border};border-radius:4px;font-size:13px;background:${t.inputBg};color:${t.text};`;
    search.addEventListener("input", () => {
      state.keyword = search.value;
      state.renderLimit = RENDER_CAP;
      rerender();
    });
    row1.appendChild(search);

    const typeSel = doc.createElement("select");
    typeSel.style.cssText =
      `padding:5px 6px;border:1px solid ${t.border};border-radius:4px;font-size:13px;background:${t.inputBg};color:${t.text};`;
    for (const [val, label] of [
      ["", "All types"],
      ["highlight", "Highlights"],
      ["underline", "Underlines"],
      ["note", "Notes"],
      ["image", "Images"],
      ["ink", "Ink"],
    ]) {
      const o = doc.createElement("option");
      o.value = val;
      o.textContent = label;
      typeSel.appendChild(o);
    }
    typeSel.addEventListener("change", () => {
      state.selectedTypes = typeSel.value
        ? new Set([typeSel.value])
        : new Set();
      state.renderLimit = RENDER_CAP;
      rerender();
    });
    row1.appendChild(typeSel);

    // colour swatches row
    const colors = AnnotationIndex.colors();
    if (colors.length) {
      const row2 = doc.createElement("div");
      row2.style.cssText =
        "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";
      const lbl = doc.createElement("span");
      lbl.textContent = "Colour:";
      lbl.style.cssText = `color:${t.sub};`;
      row2.appendChild(lbl);
      for (const c of colors) {
        const sw = htmlButton(doc);
        sw.title = c;
        sw.style.cssText =
          `width:20px;height:20px;border-radius:50%;cursor:pointer;` +
          `background:${c};border:2px solid transparent;`;
        sw.addEventListener("click", () => {
          if (state.selectedColors.has(c)) {
            state.selectedColors.delete(c);
            sw.style.borderColor = "transparent";
          } else {
            state.selectedColors.add(c);
            sw.style.borderColor = t.text;
          }
          state.renderLimit = RENDER_CAP;
          rerender();
        });
        row2.appendChild(sw);
      }
      bar.appendChild(row2);
    }

    // tag picker row
    const tags = AnnotationIndex.tags();
    if (tags.length) {
      const row3 = doc.createElement("div");
      row3.style.cssText = "display:flex;gap:6px;align-items:center;";
      const lbl = doc.createElement("span");
      lbl.textContent = "Tag:";
      lbl.style.cssText = `color:${t.sub};`;
      row3.appendChild(lbl);
      const tagSel = doc.createElement("select");
      tagSel.style.cssText =
        `flex:1;padding:5px 6px;border:1px solid ${t.border};border-radius:4px;background:${t.inputBg};color:${t.text};`;
      const none = doc.createElement("option");
      none.value = "";
      none.textContent = `All tags (${tags.length})`;
      tagSel.appendChild(none);
      for (const tag of tags) {
        const o = doc.createElement("option");
        o.value = tag;
        o.textContent = tag;
        tagSel.appendChild(o);
      }
      tagSel.addEventListener("change", () => {
        state.selectedTags = tagSel.value ? new Set([tagSel.value]) : new Set();
        state.renderLimit = RENDER_CAP;
        rerender();
      });
      row3.appendChild(tagSel);
      bar.appendChild(row3);
    }

    // Count + export row ----------------------------------------------------
    const actions = doc.createElement("div");
    actions.style.cssText = "display:flex;gap:6px;align-items:center;";
    const count = doc.createElement("span");
    count.style.cssText = `flex:1;color:${t.sub};`;
    actions.appendChild(count);

    const mkBtn = (label: string, cb: () => void) => {
      const b = themedButton(doc, label, t);
      b.addEventListener("click", cb);
      return b;
    };
    actions.appendChild(
      mkBtn("Copy as Markdown", () => {
        copyToClipboard(current(), "markdown");
        this.toast("Copied filtered annotations as Markdown");
      }),
    );
    actions.appendChild(
      mkBtn("Copy as HTML", () => {
        copyToClipboard(current(), "html");
        this.toast("Copied filtered annotations as HTML");
      }),
    );
    actions.appendChild(
      mkBtn("📝 Save as note", async () => {
        const recs = current();
        if (!recs.length) return;
        await exportToStandaloneNote(recs);
        this.toast(`Saved ${recs.length} annotations to a standalone note`);
      }),
    );
    actions.appendChild(
      mkBtn("★ Promote all to ideas", async () => {
        const recs = current();
        if (!recs.length) return;
        let n = 0;
        for (const rec of recs) {
          try {
            await IdeaLayer.createFromAnnotation(rec);
            n++;
          } catch (e) {
            ztoolkit.log("promote all: one failed:", e);
          }
        }
        this.toast(
          `Promoted ${n} annotation${n === 1 ? "" : "s"} to ideas — see the Ideas tab`,
        );
      }),
    );
    root.appendChild(actions);

    // List ------------------------------------------------------------------
    const list = doc.createElement("div");
    list.style.cssText =
      `flex:1;overflow-y:auto;border:1px solid ${t.border};border-radius:4px;`;
    root.appendChild(list);

    const empty = doc.createElement("div");
    empty.style.cssText = `padding:20px;color:${t.sub};text-align:center;`;
    empty.textContent = all.length
      ? "No annotations match the current filters."
      : "No annotations found in this library.";

    const current = (): AnnRecord[] =>
      AnnotationIndex.filter({
        colors: Array.from(state.selectedColors),
        tags: Array.from(state.selectedTags),
        types: Array.from(state.selectedTypes),
        keyword: state.keyword,
      });

    const rerender = () => {
      const recs = current();
      count.textContent = `${recs.length} annotation${recs.length === 1 ? "" : "s"}`;
      list.textContent = "";
      if (!recs.length) {
        list.appendChild(empty);
        return;
      }
      const shown = recs.slice(0, state.renderLimit);
      for (const rec of shown) list.appendChild(this.renderRow(doc, rec, t));
      if (recs.length > state.renderLimit) {
        const more = htmlButton(doc);
        more.textContent = `Show more (${recs.length - state.renderLimit} hidden)`;
        more.style.cssText =
          `appearance:none;-moz-appearance:none;color:${t.text};` +
          "display:block;width:100%;padding:8px;cursor:pointer;" +
          `border:none;border-top:1px solid ${t.border};background:${t.btnBg};`;
        more.addEventListener("click", () => {
          state.renderLimit += RENDER_CAP;
          rerender();
        });
        list.appendChild(more);
      }
    };

    rerender();
  }

  private static renderRow(
    doc: Document,
    rec: AnnRecord,
    t: Palette,
  ): HTMLElement {
    const row = doc.createElement("div");
    row.style.cssText =
      `display:flex;gap:8px;padding:8px 10px;border-bottom:1px solid ${t.border};` +
      "cursor:pointer;";
    row.addEventListener(
      "mouseenter",
      () => (row.style.background = t.hover),
    );
    row.addEventListener("mouseleave", () => (row.style.background = ""));
    row.addEventListener("click", () => this.jumpTo(rec));

    // colour bar
    const bar = doc.createElement("div");
    bar.style.cssText = `flex:0 0 4px;border-radius:2px;background:${rec.color || t.border};`;
    row.appendChild(bar);

    const body = doc.createElement("div");
    body.style.cssText = "flex:1;min-width:0;";
    row.appendChild(body);

    if (rec.text) {
      const quote = doc.createElement("div");
      quote.textContent = rec.text;
      quote.style.cssText =
        "white-space:pre-wrap;word-break:break-word;margin-bottom:2px;";
      body.appendChild(quote);
    }
    if (rec.comment) {
      const note = doc.createElement("div");
      note.textContent = rec.comment;
      note.style.cssText =
        `color:${t.sub};font-style:italic;white-space:pre-wrap;margin-bottom:2px;`;
      body.appendChild(note);
    }

    const meta = doc.createElement("div");
    meta.style.cssText = `font-size:11px;color:${t.sub};`;
    const bits = [
      rec.parentTitle,
      rec.pageLabel ? `p. ${rec.pageLabel}` : "",
      rec.tags.length ? rec.tags.map((tag) => `#${tag}`).join(" ") : "",
    ].filter(Boolean);
    meta.textContent = bits.join("  ·  ");
    body.appendChild(meta);

    // "Promote to idea" — additive: stopPropagation so it doesn't trigger the
    // row's jump-to-source click handler.
    const promote = htmlButton(doc);
    promote.textContent = "★ Promote to idea";
    promote.style.cssText =
      `appearance:none;-moz-appearance:none;color:${t.text};margin-top:4px;` +
      `padding:2px 8px;cursor:pointer;border:1px solid ${t.chipBorder};border-radius:4px;` +
      `background:${t.chipBg};font-size:11px;`;
    promote.addEventListener("click", async (e: MouseEvent) => {
      e.stopPropagation();
      promote.disabled = true;
      try {
        await IdeaLayer.createFromAnnotation(rec);
        promote.textContent = "★ Promoted to idea";
        promote.style.color = "#2a7a2a";
        promote.style.borderColor = "#3a3";
      } catch (err: any) {
        promote.disabled = false;
        promote.textContent = `★ Promote failed: ${err.message}`;
        promote.style.color = "#c00";
        ztoolkit.log("promote to idea failed:", err);
      }
    });
    body.appendChild(promote);

    return row;
  }

  // ── navigation ───────────────────────────────────────────────────────────

  private static async jumpTo(rec: AnnRecord) {
    try {
      // Try to reuse an already-open reader for this attachment.
      const readers: any[] = (Zotero.Reader as any)._readers ?? [];
      for (const r of readers) {
        if (r.itemID === rec.attachmentID) {
          r.navigate({ annotationKey: rec.key });
          return;
        }
      }
      await (Zotero.Reader as any).open(rec.attachmentID, {
        annotationKey: rec.key,
      });
    } catch (e) {
      ztoolkit.log("annotation jump failed:", e);
    }
  }

  private static toast(text: string) {
    new ztoolkit.ProgressWindow(addon.data.config.addonName, {
      closeOnClick: true,
      closeTime: 2500,
    })
      .createLine({ text, type: "success", progress: 100 })
      .show();
  }
}
