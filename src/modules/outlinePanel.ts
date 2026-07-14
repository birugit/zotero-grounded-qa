/**
 * outlinePanel — the Citavi-style knowledge-organizer UI.
 *
 * Left: the outline tree — build the skeleton of your book/paper by adding,
 * renaming, reordering, indenting and outdenting headings. Right: everything
 * filed under the selected heading (quotes, notes, papers), plus an assign
 * picker to file more. A heading is just a Zotero tag, so you can also file
 * items under it straight from Zotero's reader while reading.
 *
 * "Generate draft" gathers everything under every heading, in outline order,
 * into a Markdown/HTML document or a standalone note — the first draft.
 *
 * Follows the same Zotero-dialog constraints the rest of the plugin learned the
 * hard way: HTML-namespaced buttons with native theming disabled, inline
 * button/keyboard interactions (no window.prompt/confirm, no <select> reliance
 * for actions), and UI built in the dialog load callback.
 */

import {
  FiledItem,
  headingTag,
  indent,
  locate,
  makeNode,
  moveDown,
  moveUp,
  OutlineModel,
  OutlineNode,
  outdent,
  removeNode,
  titleError,
} from "./outlineModel";
import {
  copyDraft,
  gatherAll,
  GatherMap,
  outlineToHtml,
  outlineToMarkdown,
  saveDraftAsNote,
} from "./outlineExport";
import { getTheme, Palette } from "./theme";
import { getString } from "../utils/locale";

const HTML_NS = "http://www.w3.org/1999/xhtml";

function htmlButton(
  doc: Document,
  label: string,
  t: Palette,
): HTMLButtonElement {
  const b = doc.createElementNS(HTML_NS, "button") as HTMLButtonElement;
  b.textContent = label;
  b.style.cssText =
    `appearance:none;-moz-appearance:none;color:${t.text};` +
    `padding:4px 9px;cursor:pointer;border:1px solid ${t.border};` +
    `border-radius:4px;background:${t.btnBg};font-size:12px;`;
  return b;
}

/** Compact square icon button for the per-heading action row. */
function iconButton(
  doc: Document,
  glyph: string,
  title: string,
  t: Palette,
): HTMLButtonElement {
  const b = doc.createElementNS(HTML_NS, "button") as HTMLButtonElement;
  b.textContent = glyph;
  b.title = title;
  b.style.cssText =
    `appearance:none;-moz-appearance:none;color:${t.text};` +
    `width:22px;height:22px;line-height:1;padding:0;cursor:pointer;` +
    `border:1px solid ${t.border};border-radius:4px;background:${t.btnBg};font-size:12px;`;
  return b;
}

interface OutlineState {
  libraryID: number;
  noteID: number | null;
  roots: OutlineNode[];
  counts: Map<string, number>;
  selectedId: string | null;
  assignKeyword: string;
}

export class OutlinePanelFactory {
  static registerMenu() {
    ztoolkit.Menu.register("menuTools", {
      tag: "menuitem",
      id: "zotero-tools-knowledge-organizer",
      label: getString("outline-menu-label"),
      icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`,
      commandListener: () => {
        OutlinePanelFactory.open().catch((e) =>
          ztoolkit.log("knowledge organizer open failed:", e),
        );
      },
    });
  }

  static async open() {
    const dialog = new ztoolkit.Dialog(1, 1).addCell(0, 0, {
      tag: "div",
      id: "outline-root",
      styles: {
        width: "860px",
        height: "580px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        fontSize: "13px",
      },
    });
    dialog.setDialogData({
      loadCallback: () => {
        try {
          const doc = dialog.window.document;
          const root = doc.getElementById("outline-root") as HTMLElement | null;
          if (root) void this.mount(doc, root, Zotero.Libraries.userLibraryID);
        } catch (e) {
          ztoolkit.log("knowledge organizer buildUI failed:", e);
        }
      },
    });
    dialog.open(getString("outline-window-title"), {
      width: 900,
      height: 660,
      resizable: true,
    });
  }

  /** Render into an existing container (the Organizer tab of the browser). */
  static renderInto(doc: Document, container: HTMLElement) {
    void this.mount(doc, container, Zotero.Libraries.userLibraryID);
  }

  // ── mounting / data ────────────────────────────────────────────────────────

  private static async mount(
    doc: Document,
    root: HTMLElement,
    libraryID: number,
  ) {
    const t = getTheme(doc);
    root.textContent = "";
    (root.style as any).colorScheme = t.colorScheme;
    root.style.background = t.bg;
    root.style.color = t.text;

    const loading = doc.createElement("div");
    loading.textContent = "Loading outline…";
    loading.style.cssText = `padding:20px;color:${t.sub};`;
    root.appendChild(loading);

    const loaded = await OutlineModel.load(libraryID);
    const counts = await OutlineModel.buildCountMap(libraryID);
    const state: OutlineState = {
      libraryID,
      noteID: loaded.noteID,
      roots: loaded.roots,
      counts,
      selectedId: loaded.roots[0]?.id ?? null,
      assignKeyword: "",
    };
    root.removeChild(loading);
    this.buildUI(doc, root, state);
  }

  private static async persist(state: OutlineState) {
    state.noteID = await OutlineModel.save(
      state.libraryID,
      state.noteID,
      state.roots,
    );
  }

  private static async refreshCounts(state: OutlineState) {
    state.counts = await OutlineModel.buildCountMap(state.libraryID);
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  private static buildUI(
    doc: Document,
    root: HTMLElement,
    state: OutlineState,
  ) {
    const t = getTheme(doc);
    root.textContent = "";

    // toolbar ---------------------------------------------------------------
    const bar = doc.createElement("div");
    bar.style.cssText =
      "display:flex;gap:6px;align-items:center;flex:0 0 auto;" +
      `border-bottom:1px solid ${t.border};padding-bottom:8px;`;
    root.appendChild(bar);

    const addBtn = htmlButton(doc, "➕ Add heading", t);
    bar.appendChild(addBtn);

    const libraries = Zotero.Libraries.getAll();
    if (libraries.length > 1) {
      const libSel = doc.createElement("select");
      libSel.style.cssText = `padding:5px 6px;border:1px solid ${t.border};border-radius:4px;font-size:13px;background:${t.inputBg};color:${t.text};`;
      for (const lib of libraries) {
        const o = doc.createElement("option");
        o.value = String(lib.libraryID);
        o.textContent = lib.name + (lib.isGroup ? " (group)" : "");
        if (lib.libraryID === state.libraryID) o.selected = true;
        libSel.appendChild(o);
      }
      libSel.addEventListener("change", () => {
        void this.mount(doc, root, Number(libSel.value));
      });
      bar.appendChild(libSel);
    }

    const spacer = doc.createElement("div");
    spacer.style.flex = "1";
    bar.appendChild(spacer);

    const status = doc.createElement("span");
    status.style.cssText = `color:${t.sub};font-size:11px;margin-right:4px;`;
    bar.appendChild(status);
    const toast = (msg: string) => {
      status.textContent = msg;
      status.style.color = t.sub;
    };

    // The payoff action: gather everything under the outline into a draft.
    const genBtn = htmlButton(doc, "📄 Generate draft", t);
    genBtn.style.borderColor = t.accent;
    genBtn.style.color = t.accent;
    genBtn.style.fontWeight = "600";
    bar.appendChild(genBtn);

    // body: tree | detail ---------------------------------------------------
    const body = doc.createElement("div");
    body.style.cssText = "display:flex;gap:8px;flex:1;min-height:0;";
    root.appendChild(body);

    const treePane = doc.createElement("div");
    treePane.style.cssText =
      `flex:0 0 320px;overflow:auto;border:1px solid ${t.border};` +
      "border-radius:4px;padding:4px;";
    body.appendChild(treePane);

    const detailPane = doc.createElement("div");
    detailPane.style.cssText =
      `flex:1;min-width:0;overflow:auto;border:1px solid ${t.border};` +
      "border-radius:4px;padding:8px;";
    body.appendChild(detailPane);

    // ── rendering ---------------------------------------------------------
    const selectedNode = () =>
      state.selectedId
        ? (locate(state.roots, state.selectedId)?.node ?? null)
        : null;

    const renderTree = () => {
      treePane.textContent = "";
      if (!state.roots.length) {
        const empty = doc.createElement("div");
        empty.style.cssText = `padding:16px;color:${t.sub};text-align:center;`;
        empty.textContent =
          'No headings yet. Click "Add heading" to start your outline.';
        treePane.appendChild(empty);
        return;
      }
      const walk = (nodes: OutlineNode[], depth: number) => {
        for (const node of nodes) {
          treePane.appendChild(
            this.renderTreeRow(doc, node, depth, state, t, {
              select: (id) => {
                state.selectedId = id;
                state.assignKeyword = "";
                renderTree();
                void renderDetail();
              },
              mutate: async (fn) => {
                fn();
                await this.persist(state);
                await this.refreshCounts(state);
                renderTree();
                void renderDetail();
              },
              renameCommit: async (id, newTitle) => {
                const loc = locate(state.roots, id);
                if (!loc) return;
                const err = titleError(state.roots, newTitle, id);
                if (err) {
                  toast(err);
                  return;
                }
                const oldTitle = loc.node.title;
                if (oldTitle.trim() === newTitle.trim()) return;
                const oldTag = headingTag(oldTitle);
                const newTag = headingTag(newTitle);
                loc.node.title = newTitle.trim();
                await this.persist(state);
                await OutlineModel.renameTag(state.libraryID, oldTag, newTag);
                await this.refreshCounts(state);
                renderTree();
                void renderDetail();
              },
            }),
          );
          if (node.children.length) walk(node.children, depth + 1);
        }
      };
      walk(state.roots, 0);
    };

    const renderDetail = async () => {
      detailPane.textContent = "";
      const node = selectedNode();
      if (!node) {
        const hint = doc.createElement("div");
        hint.style.cssText = `padding:16px;color:${t.sub};`;
        hint.textContent =
          "Select a heading to see and assign what's filed under it.";
        detailPane.appendChild(hint);
        return;
      }
      await this.renderDetail(doc, detailPane, node, state, t, {
        refresh: async () => {
          await this.refreshCounts(state);
          renderTree();
          await renderDetail();
        },
      });
    };

    // ── toolbar actions ---------------------------------------------------
    addBtn.addEventListener("click", async () => {
      const title = this.uniqueDefaultTitle(state.roots);
      const node = makeNode(title);
      state.roots.push(node);
      state.selectedId = node.id;
      await this.persist(state);
      renderTree();
      void renderDetail();
    });

    genBtn.addEventListener("click", async () => {
      if (!state.roots.length) {
        toast("Add some headings first");
        return;
      }
      genBtn.disabled = true;
      toast("Gathering…");
      try {
        const g = await gatherAll(state.libraryID, state.roots);
        toast("");
        this.openDraftPreview(doc, root, state, state.roots, g, t, toast);
      } catch (e) {
        toast("Draft failed — see log");
        ztoolkit.log("generate draft failed:", e);
      } finally {
        genBtn.disabled = false;
      }
    });

    renderTree();
    void renderDetail();
  }

  /**
   * In-window draft preview overlay. The draft is gathered once by the caller;
   * here you toggle Markdown/HTML, optionally include empty headings, and copy
   * it or save it as a standalone note. Built as an overlay (not a nested
   * dialog) since nested dialogs are unreliable in Zotero.
   */
  private static openDraftPreview(
    doc: Document,
    root: HTMLElement,
    state: OutlineState,
    roots: OutlineNode[],
    gathered: GatherMap,
    t: Palette,
    toast: (msg: string) => void,
  ) {
    let format: "markdown" | "html" = "markdown";
    let includeEmpty = false;
    const currentOpts = () => ({ title: "Draft", includeEmpty });

    const prevPosition = root.style.position;
    root.style.position = "relative";

    const overlay = doc.createElement("div");
    overlay.style.cssText =
      `position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;` +
      `gap:8px;padding:10px;background:${t.bg};color:${t.text};`;
    root.appendChild(overlay);
    const close = () => {
      if (overlay.parentNode === root) root.removeChild(overlay);
      root.style.position = prevPosition;
    };

    // header ----------------------------------------------------------------
    const header = doc.createElement("div");
    header.style.cssText =
      "display:flex;align-items:center;gap:8px;flex:0 0 auto;";
    const title = doc.createElement("div");
    title.textContent = "📄 Draft preview";
    title.style.cssText = "font-size:15px;font-weight:600;flex:1;";
    header.appendChild(title);
    const closeX = htmlButton(doc, "✕ Close", t);
    closeX.addEventListener("click", close);
    header.appendChild(closeX);
    overlay.appendChild(header);

    // options ---------------------------------------------------------------
    const opts = doc.createElement("div");
    opts.style.cssText =
      `display:flex;align-items:center;gap:12px;flex:0 0 auto;` +
      `border-bottom:1px solid ${t.border};padding-bottom:8px;`;
    overlay.appendChild(opts);

    const fmtMd = htmlButton(doc, "Markdown", t);
    const fmtHtml = htmlButton(doc, "HTML", t);
    const fmtWrap = doc.createElement("div");
    fmtWrap.style.cssText = "display:flex;gap:2px;";
    fmtWrap.appendChild(fmtMd);
    fmtWrap.appendChild(fmtHtml);
    opts.appendChild(fmtWrap);

    const emptyLabel = doc.createElement("label");
    emptyLabel.style.cssText =
      "display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;";
    const emptyChk = doc.createElement("input");
    emptyChk.type = "checkbox";
    const emptyTxt = doc.createElement("span");
    emptyTxt.textContent = "Include empty headings";
    emptyLabel.appendChild(emptyChk);
    emptyLabel.appendChild(emptyTxt);
    opts.appendChild(emptyLabel);

    const spacer = doc.createElement("div");
    spacer.style.flex = "1";
    opts.appendChild(spacer);
    const count = doc.createElement("span");
    count.style.cssText = `font-size:11px;color:${t.sub};`;
    const total = Array.from(gathered.values()).reduce(
      (a, v) => a + v.length,
      0,
    );
    count.textContent =
      `${total} item${total === 1 ? "" : "s"} across ` +
      `${gathered.size} heading${gathered.size === 1 ? "" : "s"}`;
    opts.appendChild(count);

    // preview ---------------------------------------------------------------
    const preview = doc.createElement("div");
    preview.style.cssText =
      `flex:1;min-height:0;overflow:auto;border:1px solid ${t.border};` +
      `border-radius:4px;background:${t.panel};`;
    overlay.appendChild(preview);

    // actions ---------------------------------------------------------------
    const actions = doc.createElement("div");
    actions.style.cssText =
      "display:flex;gap:6px;align-items:center;flex:0 0 auto;";
    const copyBtn = htmlButton(doc, "📋 Copy", t);
    const saveBtn = htmlButton(doc, "📝 Save as note", t);
    const actStatus = doc.createElement("span");
    actStatus.style.cssText = `font-size:11px;color:${t.sub};`;
    actions.appendChild(copyBtn);
    actions.appendChild(saveBtn);
    actions.appendChild(actStatus);
    overlay.appendChild(actions);

    const render = () => {
      const active = (b: HTMLButtonElement, on: boolean) => {
        b.style.background = on ? t.accent : t.btnBg;
        b.style.color = on ? "#ffffff" : t.text;
        b.style.fontWeight = on ? "600" : "400";
      };
      active(fmtMd, format === "markdown");
      active(fmtHtml, format === "html");

      preview.textContent = "";
      if (format === "markdown") {
        const ta = doc.createElementNS(
          HTML_NS,
          "textarea",
        ) as HTMLTextAreaElement;
        ta.readOnly = true;
        ta.value = outlineToMarkdown(roots, gathered, currentOpts());
        ta.style.cssText =
          `width:100%;height:100%;box-sizing:border-box;border:none;resize:none;` +
          `padding:10px;font-family:monospace;font-size:12px;` +
          `background:${t.panel};color:${t.text};white-space:pre;`;
        preview.appendChild(ta);
      } else {
        const rendered = doc.createElement("div");
        rendered.style.cssText =
          "padding:12px;word-break:break-word;line-height:1.4;";
        // Generated HTML escapes all user content, so it's safe to render here.
        rendered.innerHTML = outlineToHtml(roots, gathered, currentOpts());
        preview.appendChild(rendered);
      }
    };

    fmtMd.addEventListener("click", () => {
      format = "markdown";
      render();
    });
    fmtHtml.addEventListener("click", () => {
      format = "html";
      render();
    });
    emptyChk.addEventListener("change", () => {
      includeEmpty = emptyChk.checked;
      render();
    });

    copyBtn.addEventListener("click", () => {
      copyDraft(roots, gathered, format, currentOpts());
      actStatus.textContent = `Copied as ${format === "html" ? "HTML" : "Markdown"}`;
    });
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      try {
        await saveDraftAsNote(roots, gathered, state.libraryID, currentOpts());
        actStatus.textContent = "Saved as a standalone note";
        toast("Draft saved as a standalone note");
      } catch (e: any) {
        actStatus.textContent = `Save failed: ${e?.message || e}`;
        ztoolkit.log("save draft as note failed:", e);
      } finally {
        saveBtn.disabled = false;
      }
    });

    render();
  }

  /** A unique "New heading" / "New heading 2" title. */
  private static uniqueDefaultTitle(roots: OutlineNode[]): string {
    const base = "New heading";
    if (!titleError(roots, base)) return base;
    for (let i = 2; i < 999; i++) {
      const t = `${base} ${i}`;
      if (!titleError(roots, t)) return t;
    }
    return `${base} ${Date.now()}`;
  }

  private static renderTreeRow(
    doc: Document,
    node: OutlineNode,
    depth: number,
    state: OutlineState,
    t: Palette,
    cb: {
      select: (id: string) => void;
      mutate: (fn: () => void) => Promise<void>;
      renameCommit: (id: string, title: string) => Promise<void>;
    },
  ): HTMLElement {
    const row = doc.createElement("div");
    const selected = state.selectedId === node.id;
    row.style.cssText =
      `display:flex;align-items:center;gap:4px;padding:3px 4px;border-radius:4px;` +
      `padding-left:${6 + depth * 16}px;cursor:pointer;` +
      (selected ? `background:${t.hover};` : "");
    row.addEventListener("mouseenter", () => {
      actions.style.visibility = "visible";
      if (!selected) row.style.background = t.hover;
    });
    row.addEventListener("mouseleave", () => {
      actions.style.visibility = "hidden";
      if (!selected) row.style.background = "";
    });

    // title (click to select) — swaps to an input on rename
    const titleEl = doc.createElement("span");
    titleEl.textContent = node.title;
    titleEl.style.cssText =
      "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" +
      (selected ? "font-weight:600;" : "");
    titleEl.addEventListener("click", () => cb.select(node.id));
    row.appendChild(titleEl);

    const count = state.counts.get(headingTag(node.title)) || 0;
    const badge = doc.createElement("span");
    badge.textContent = String(count);
    badge.title = `${count} item${count === 1 ? "" : "s"} filed here`;
    badge.style.cssText =
      `flex:0 0 auto;font-size:10px;min-width:16px;text-align:center;` +
      `padding:1px 5px;border-radius:8px;background:${t.chipBg};` +
      `border:1px solid ${t.chipBorder};color:${t.sub};` +
      (count ? "" : "opacity:.45;");
    row.appendChild(badge);

    // hover action row
    const actions = doc.createElement("span");
    actions.style.cssText =
      "flex:0 0 auto;display:flex;gap:2px;visibility:hidden;";
    const add = (glyph: string, title: string, fn: () => void) => {
      const b = iconButton(doc, glyph, title, t);
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        fn();
      });
      actions.appendChild(b);
      return b;
    };

    add("＋", "Add sub-heading", async () => {
      const loc = locate(state.roots, node.id);
      if (!loc) return;
      const child = makeNode(this.uniqueDefaultTitle(state.roots));
      loc.node.children.push(child);
      state.selectedId = child.id;
      await cb.mutate(() => {});
    });
    add("✎", "Rename", () => {
      const input = doc.createElement("input");
      input.type = "text";
      input.value = node.title;
      input.style.cssText =
        `flex:1;min-width:0;padding:1px 4px;border:1px solid ${t.accent};` +
        `border-radius:3px;background:${t.inputBg};color:${t.text};font-size:12px;`;
      row.replaceChild(input, titleEl);
      input.focus();
      input.select();
      let done = false;
      const commit = async () => {
        if (done) return;
        done = true;
        await cb.renameCommit(node.id, input.value);
      };
      input.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void commit();
        } else if (e.key === "Escape") {
          done = true;
          if (input.parentNode === row) row.replaceChild(titleEl, input);
        }
      });
      input.addEventListener("blur", () => void commit());
    });
    add("▲", "Move up", () => cb.mutate(() => moveUp(state.roots, node.id)));
    add("▼", "Move down", () =>
      cb.mutate(() => moveDown(state.roots, node.id)),
    );
    add("⭰", "Outdent", () => cb.mutate(() => outdent(state.roots, node.id)));
    add("⭲", "Indent", () => cb.mutate(() => indent(state.roots, node.id)));

    // two-step delete (confirm() is unreliable in dialog windows)
    const del = iconButton(doc, "🗑", "Delete heading", t);
    del.style.borderColor = "#e0b4b4";
    let armed = false;
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!armed) {
        armed = true;
        del.textContent = "✓?";
        del.title = "Click again to delete (filed items keep their tags)";
        del.style.color = "#c00";
        del.style.borderColor = "#c00";
        return;
      }
      await cb.mutate(() => {
        removeNode(state.roots, node.id);
        if (state.selectedId === node.id)
          state.selectedId = state.roots[0]?.id ?? null;
      });
    });
    actions.appendChild(del);

    row.appendChild(actions);
    return row;
  }

  // ── detail pane ─────────────────────────────────────────────────────────────

  private static async renderDetail(
    doc: Document,
    pane: HTMLElement,
    node: OutlineNode,
    state: OutlineState,
    t: Palette,
    cb: { refresh: () => Promise<void> },
  ) {
    const tag = headingTag(node.title);

    // header
    const header = doc.createElement("div");
    header.style.cssText = `border-bottom:1px solid ${t.border};padding-bottom:6px;margin-bottom:8px;`;
    const h = doc.createElement("div");
    h.textContent = node.title;
    h.style.cssText = "font-size:15px;font-weight:600;";
    header.appendChild(h);
    const sub = doc.createElement("div");
    sub.textContent = `Files under tag ${tag} — add this tag to any annotation while reading to file it here.`;
    sub.style.cssText = `font-size:11px;color:${t.sub};margin-top:2px;`;
    header.appendChild(sub);
    pane.appendChild(header);

    // filed items
    const filed = await OutlineModel.gather(state.libraryID, tag);
    const filedHead = doc.createElement("div");
    filedHead.textContent = `Filed here (${filed.length})`;
    filedHead.style.cssText = "font-weight:600;margin-bottom:4px;";
    pane.appendChild(filedHead);

    if (!filed.length) {
      const none = doc.createElement("div");
      none.style.cssText = `color:${t.sub};font-size:12px;margin-bottom:8px;`;
      none.textContent =
        "Nothing yet. Use the picker below, or tag annotations in the reader.";
      pane.appendChild(none);
    } else {
      for (const item of filed) {
        pane.appendChild(this.renderFiledItem(doc, item, tag, t, cb));
      }
    }

    // assign picker
    const picker = doc.createElement("div");
    picker.style.cssText = `margin-top:10px;border-top:1px solid ${t.border};padding-top:8px;`;
    pane.appendChild(picker);

    const pHead = doc.createElement("div");
    pHead.textContent = "File a quote or note here";
    pHead.style.cssText = "font-weight:600;margin-bottom:4px;";
    picker.appendChild(pHead);

    const search = doc.createElement("input");
    search.type = "search";
    search.placeholder = "Search your annotations…";
    search.value = state.assignKeyword;
    search.style.cssText =
      `width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid ${t.border};` +
      `border-radius:4px;font-size:13px;background:${t.inputBg};color:${t.text};margin-bottom:6px;`;
    picker.appendChild(search);

    const results = doc.createElement("div");
    picker.appendChild(results);

    const renderResults = async () => {
      results.textContent = "";
      const cands = await OutlineModel.assignCandidates(
        state.libraryID,
        tag,
        state.assignKeyword,
        30,
      );
      if (!cands.length) {
        const none = doc.createElement("div");
        none.style.cssText = `color:${t.sub};font-size:12px;padding:4px;`;
        none.textContent = state.assignKeyword
          ? "No matching unfiled annotations."
          : "Start typing to find annotations to file here.";
        results.appendChild(none);
        return;
      }
      for (const c of cands) {
        const rowEl = doc.createElement("div");
        rowEl.style.cssText = `display:flex;gap:6px;align-items:center;padding:5px 4px;border-bottom:1px solid ${t.border};`;
        const text = doc.createElement("div");
        text.style.cssText = "flex:1;min-width:0;";
        const q = doc.createElement("div");
        q.textContent =
          c.quote.length > 140
            ? c.quote.slice(0, 140) + "…"
            : c.quote || "(no text)";
        q.style.cssText = "white-space:pre-wrap;word-break:break-word;";
        text.appendChild(q);
        const meta = doc.createElement("div");
        meta.textContent = [c.title, c.pageLabel ? `p. ${c.pageLabel}` : ""]
          .filter(Boolean)
          .join(" · ");
        meta.style.cssText = `font-size:11px;color:${t.sub};`;
        text.appendChild(meta);
        rowEl.appendChild(text);

        const file = htmlButton(doc, "File here", t);
        file.addEventListener("click", async () => {
          file.disabled = true;
          file.textContent = "Filed ✓";
          await OutlineModel.fileUnder(c.itemID, tag);
          await cb.refresh();
        });
        rowEl.appendChild(file);
        results.appendChild(rowEl);
      }
    };

    let debounce: ReturnType<typeof setTimeout> | null = null;
    search.addEventListener("input", () => {
      state.assignKeyword = search.value;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void renderResults(), 150);
    });
    await renderResults();
  }

  private static renderFiledItem(
    doc: Document,
    item: FiledItem,
    tag: string,
    t: Palette,
    cb: { refresh: () => Promise<void> },
  ): HTMLElement {
    const card = doc.createElement("div");
    card.style.cssText =
      `border:1px solid ${t.border};border-radius:6px;padding:8px;margin-bottom:6px;` +
      `background:${t.panel};`;

    const kindLabel =
      item.kind === "annotation"
        ? "❝ Quote"
        : item.kind === "note"
          ? "🗒 Note"
          : "📄 Source";
    const top = doc.createElement("div");
    top.style.cssText = `font-size:11px;color:${t.sub};margin-bottom:2px;`;
    top.textContent = kindLabel;
    card.appendChild(top);

    if (item.quote) {
      const q = doc.createElement("div");
      q.textContent =
        item.quote.length > 300 ? item.quote.slice(0, 300) + "…" : item.quote;
      q.style.cssText =
        "white-space:pre-wrap;word-break:break-word;margin-bottom:3px;";
      card.appendChild(q);
    }
    if (item.comment) {
      const c = doc.createElement("div");
      c.textContent = item.comment;
      c.style.cssText = `color:${t.sub};font-style:italic;margin-bottom:3px;`;
      card.appendChild(c);
    }

    const meta = doc.createElement("div");
    meta.style.cssText = `font-size:11px;color:${t.sub};margin-bottom:4px;`;
    meta.textContent = [
      item.citation || item.title,
      item.pageLabel ? `p. ${item.pageLabel}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    card.appendChild(meta);

    const actions = doc.createElement("div");
    actions.style.cssText = "display:flex;gap:6px;";
    const open = htmlButton(doc, "Open", t);
    open.addEventListener("click", () => this.openFiled(item));
    actions.appendChild(open);
    const remove = htmlButton(doc, "Remove", t);
    remove.style.borderColor = "#e0b4b4";
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      await OutlineModel.unfile(item.itemID, tag);
      await cb.refresh();
    });
    actions.appendChild(remove);
    card.appendChild(actions);
    return card;
  }

  private static async openFiled(item: FiledItem) {
    try {
      if (item.link) {
        Zotero.launchURL(item.link);
        return;
      }
      const pane = ztoolkit.getGlobal("ZoteroPane") as any;
      await pane.selectItem(item.itemID);
    } catch (e) {
      ztoolkit.log("outlinePanel openFiled failed:", e);
    }
  }
}
