/**
 * ideaPanel — the Citavi-style Idea Layer browser.
 *
 * A dedicated window over the idea notes managed by ideaLayer: list every idea,
 * filter by tag/keyword, edit tags in place, open the linked source, and link
 * ideas to one another. This is the cross-paper "thought" layer — ideas are
 * reachable on their own, not only through the paper they came from.
 */

import { IdeaLayer, IdeaRecord } from "./ideaLayer";
import { getTheme, Palette } from "./theme";
import { getString } from "../utils/locale";

const HTML_NS = "http://www.w3.org/1999/xhtml";

/** Create an HTML <button> with native theming disabled so the label shows. */
function htmlButton(doc: Document, label: string, t: Palette): HTMLButtonElement {
  const b = doc.createElementNS(HTML_NS, "button") as HTMLButtonElement;
  b.textContent = label;
  b.style.cssText =
    `appearance:none;-moz-appearance:none;color:${t.text};` +
    `padding:4px 9px;cursor:pointer;border:1px solid ${t.border};` +
    `border-radius:4px;background:${t.btnBg};font-size:12px;`;
  return b;
}

interface IdeaPanelState {
  libraryID: number;
  keyword: string;
  tag: string;
}

export class IdeaPanelFactory {
  static registerMenu() {
    ztoolkit.Menu.register("menuTools", {
      tag: "menuitem",
      id: "zotero-tools-idea-layer",
      label: getString("idea-menu-label"),
      icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`,
      commandListener: () => {
        IdeaPanelFactory.open().catch((e) =>
          ztoolkit.log("idea layer open failed:", e),
        );
      },
    });
  }

  static async open() {
    const state: IdeaPanelState = {
      libraryID: Zotero.Libraries.userLibraryID,
      keyword: "",
      tag: "",
    };

    const dialog = new ztoolkit.Dialog(1, 1).addCell(0, 0, {
      tag: "div",
      id: "idea-root",
      styles: {
        width: "780px",
        height: "560px",
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
          const root = doc.getElementById("idea-root") as HTMLElement | null;
          if (root) this.buildUI(doc, root, state);
        } catch (e) {
          ztoolkit.log("idea layer buildUI failed:", e);
        }
      },
    });
    dialog.open(getString("idea-window-title"), {
      width: 820,
      height: 640,
      resizable: true,
    });
  }

  /**
   * Render the Idea Layer UI into an existing container (e.g. a tab pane in the
   * All Annotations window) rather than its own dialog.
   */
  static renderInto(doc: Document, container: HTMLElement) {
    const state: IdeaPanelState = {
      libraryID: Zotero.Libraries.userLibraryID,
      keyword: "",
      tag: "",
    };
    void this.buildUI(doc, container, state);
  }

  private static async buildUI(
    doc: Document,
    root: HTMLElement,
    state: IdeaPanelState,
  ) {
    root.textContent = "";
    const t = getTheme(doc);
    (root.style as any).colorScheme = t.colorScheme;
    root.style.background = t.bg;
    root.style.color = t.text;

    // ── toolbar ──────────────────────────────────────────────────────────
    const bar = doc.createElement("div");
    bar.style.cssText =
      "display:flex;gap:6px;align-items:center;" +
      `border-bottom:1px solid ${t.border};padding-bottom:8px;`;
    root.appendChild(bar);

    const newBtn = htmlButton(doc, "➕ New idea", t);
    newBtn.addEventListener("click", async () => {
      await IdeaLayer.createBlank(undefined, state.libraryID);
      await refresh();
    });
    bar.appendChild(newBtn);

    // library selector (only when more than one library exists)
    const libraries = Zotero.Libraries.getAll();
    if (libraries.length > 1) {
      const libSel = doc.createElement("select");
      libSel.style.cssText =
        `padding:5px 6px;border:1px solid ${t.border};border-radius:4px;font-size:13px;background:${t.inputBg};color:${t.text};`;
      for (const lib of libraries) {
        const o = doc.createElement("option");
        o.value = String(lib.libraryID);
        o.textContent = lib.name + (lib.isGroup ? " (group)" : "");
        if (lib.libraryID === state.libraryID) o.selected = true;
        libSel.appendChild(o);
      }
      libSel.addEventListener("change", async () => {
        state.libraryID = Number(libSel.value);
        state.tag = "";
        await refresh();
      });
      bar.appendChild(libSel);
    }

    const search = doc.createElement("input");
    search.type = "search";
    search.placeholder = "Search ideas…";
    search.value = state.keyword;
    search.style.cssText =
      `flex:1;padding:5px 8px;border:1px solid ${t.border};border-radius:4px;font-size:13px;background:${t.inputBg};color:${t.text};`;
    search.addEventListener("input", () => {
      state.keyword = search.value;
      void renderList();
    });
    bar.appendChild(search);

    const tagSel = doc.createElement("select");
    tagSel.style.cssText =
      `padding:5px 6px;border:1px solid ${t.border};border-radius:4px;font-size:13px;background:${t.inputBg};color:${t.text};`;
    tagSel.addEventListener("change", () => {
      state.tag = tagSel.value;
      void renderList();
    });
    bar.appendChild(tagSel);

    const count = doc.createElement("div");
    count.style.cssText = `color:${t.sub};min-width:64px;text-align:right;`;
    bar.appendChild(count);

    // ── list container ───────────────────────────────────────────────────
    const list = doc.createElement("div");
    list.style.cssText =
      `flex:1;overflow-y:auto;border:1px solid ${t.border};border-radius:4px;padding:4px;`;
    root.appendChild(list);

    // ── data + rendering ─────────────────────────────────────────────────
    let ideas: IdeaRecord[] = [];

    const matches = (idea: IdeaRecord): boolean => {
      if (state.tag && !idea.tags.includes(state.tag)) return false;
      const kw = state.keyword.trim().toLowerCase();
      if (kw) {
        const hay = (
          idea.title +
          "\n" +
          idea.text +
          "\n" +
          idea.tags.join(" ")
        ).toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    };

    const renderList = async () => {
      const shown = ideas.filter(matches);
      count.textContent = `${shown.length} idea${shown.length === 1 ? "" : "s"}`;
      list.textContent = "";
      if (!ideas.length) {
        const empty = doc.createElement("div");
        empty.style.cssText = `padding:24px;color:${t.sub};text-align:center;`;
        empty.textContent =
          'No ideas yet. Create one with "New idea", or promote an annotation from the All Annotations browser.';
        list.appendChild(empty);
        return;
      }
      for (const idea of shown) {
        list.appendChild(this.renderCard(doc, idea, ideas, refresh, t));
      }
    };

    // Rebuild tag dropdown + reload data, then re-render.
    const refresh = async () => {
      ideas = await IdeaLayer.all(state.libraryID);
      const allTags = await IdeaLayer.tags(state.libraryID);
      const prev = state.tag;
      tagSel.textContent = "";
      const optAll = doc.createElement("option");
      optAll.value = "";
      optAll.textContent = `All tags (${allTags.length})`;
      tagSel.appendChild(optAll);
      for (const t of allTags) {
        const o = doc.createElement("option");
        o.value = t;
        o.textContent = t;
        if (t === prev) o.selected = true;
        tagSel.appendChild(o);
      }
      await renderList();
    };

    await refresh();
  }

  private static renderCard(
    doc: Document,
    idea: IdeaRecord,
    allIdeas: IdeaRecord[],
    refresh: () => Promise<void>,
    pal: Palette,
  ): HTMLElement {
    const card = doc.createElement("div");
    card.style.cssText =
      `border:1px solid ${pal.border};border-radius:6px;padding:10px;margin:6px 4px;` +
      `background:${pal.panel};color:${pal.text};`;

    // title + snippet
    const title = doc.createElement("div");
    title.textContent = idea.title;
    title.style.cssText = "font-weight:600;margin-bottom:4px;";
    card.appendChild(title);

    const snippet = doc.createElement("div");
    snippet.textContent =
      idea.text.length > 240 ? idea.text.slice(0, 240) + "…" : idea.text;
    snippet.style.cssText =
      `color:${pal.sub};white-space:pre-wrap;word-break:break-word;margin-bottom:6px;`;
    card.appendChild(snippet);

    // tag chips (removable) + add-tag input
    const tagRow = doc.createElement("div");
    tagRow.style.cssText =
      "display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:6px;";
    for (const t of idea.tags) {
      const chip = doc.createElement("span");
      chip.style.cssText =
        `background:${pal.chipBg};border:1px solid ${pal.chipBorder};border-radius:10px;color:${pal.text};` +
        "padding:1px 8px;font-size:11px;display:inline-flex;gap:4px;align-items:center;";
      const txt = doc.createElement("span");
      txt.textContent = t;
      chip.appendChild(txt);
      const x = doc.createElement("span");
      x.textContent = "×";
      x.style.cssText = "cursor:pointer;color:#a00;font-weight:700;";
      x.title = "Remove tag";
      x.addEventListener("click", async () => {
        await IdeaLayer.removeTag(idea.id, t);
        await refresh();
      });
      chip.appendChild(x);
      tagRow.appendChild(chip);
    }
    const tagInput = doc.createElement("input");
    tagInput.type = "text";
    tagInput.placeholder = "+ tag";
    tagInput.style.cssText =
      `width:70px;padding:2px 6px;border:1px solid ${pal.border};border-radius:10px;font-size:11px;background:${pal.inputBg};color:${pal.text};`;
    tagInput.addEventListener("keydown", async (e: KeyboardEvent) => {
      if (e.key === "Enter" && tagInput.value.trim()) {
        e.preventDefault();
        await IdeaLayer.addTag(idea.id, tagInput.value.trim());
        await refresh();
      }
    });
    tagRow.appendChild(tagInput);
    card.appendChild(tagRow);

    // linked ideas
    if (idea.linkedIdeaIDs.length) {
      const linked = doc.createElement("div");
      linked.style.cssText = `font-size:11px;color:${pal.sub};margin-bottom:6px;`;
      const lbl = doc.createElement("span");
      lbl.textContent = "Linked ideas: ";
      linked.appendChild(lbl);
      for (const lid of idea.linkedIdeaIDs) {
        const other = allIdeas.find((i) => i.id === lid);
        if (!other) continue;
        const chip = doc.createElement("span");
        chip.style.cssText =
          `background:${pal.linkChipBg};border:1px solid ${pal.linkChipBorder};border-radius:10px;color:${pal.text};` +
          "padding:1px 8px;margin:0 3px;display:inline-flex;gap:4px;align-items:center;";
        const t = doc.createElement("span");
        t.textContent =
          other.title.length > 36
            ? other.title.slice(0, 36) + "…"
            : other.title;
        chip.appendChild(t);
        const x = doc.createElement("span");
        x.textContent = "×";
        x.style.cssText = "cursor:pointer;color:#a00;font-weight:700;";
        x.title = "Unlink";
        x.addEventListener("click", async () => {
          await IdeaLayer.unlink(idea.id, lid);
          await refresh();
        });
        chip.appendChild(x);
        linked.appendChild(chip);
      }
      card.appendChild(linked);
    }

    // action row
    const actions = doc.createElement("div");
    actions.style.cssText =
      "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";

    // inline status / error feedback for this card's actions
    const status = doc.createElement("span");
    status.style.cssText = "font-size:11px;color:#c00;margin-left:4px;";
    const fail = (label: string, e: any) => {
      status.textContent = `${label}: ${e?.message || e}`;
      ztoolkit.log(`ideaPanel ${label} error:`, e);
    };

    if (idea.sourceItemIDs.length) {
      const openSrc = htmlButton(doc, "📄 Open source", pal);
      openSrc.addEventListener("click", async () => {
        try {
          const pane = ztoolkit.getGlobal("ZoteroPane") as any;
          await pane.selectItem(idea.sourceItemIDs[0]);
          // Bring the main Zotero window forward so the selection is visible.
          (pane.document?.defaultView || pane.window)?.focus?.();
        } catch (e) {
          fail("open source", e);
        }
      });
      actions.appendChild(openSrc);
    }

    // link-to picker — an inline list of clickable candidate ideas. Native
    // <select> change events and window.prompt are both unreliable in Zotero
    // dialog windows, but button clicks work, so build the picker from buttons.
    const others = allIdeas.filter(
      (i) => i.id !== idea.id && !idea.linkedIdeaIDs.includes(i.id),
    );
    const picker = doc.createElement("div");
    picker.style.cssText =
      "display:none;flex-direction:column;gap:3px;width:100%;margin-top:4px;" +
      `border:1px solid ${pal.border};border-radius:4px;padding:4px;background:${pal.bg};`;
    if (others.length) {
      const linkBtn = htmlButton(doc, "🔗 Link to…", pal);
      linkBtn.addEventListener("click", () => {
        picker.style.display =
          picker.style.display === "none" ? "flex" : "none";
      });
      actions.appendChild(linkBtn);

      const hint = doc.createElement("div");
      hint.textContent = "Pick an idea to link:";
      hint.style.cssText = `font-size:11px;color:${pal.sub};margin-bottom:2px;`;
      picker.appendChild(hint);

      for (const o of others) {
        const choice = htmlButton(
          doc,
          o.title.length > 60 ? o.title.slice(0, 60) + "…" : o.title,
          pal,
        );
        choice.style.cssText =
          `appearance:none;-moz-appearance:none;color:${pal.text};text-align:left;` +
          `padding:4px 8px;cursor:pointer;border:1px solid ${pal.border};` +
          `border-radius:4px;background:${pal.panel};font-size:12px;`;
        choice.addEventListener("click", async () => {
          try {
            picker.style.display = "none";
            await IdeaLayer.link(idea.id, o.id);
            await refresh();
          } catch (e) {
            fail("link", e);
          }
        });
        picker.appendChild(choice);
      }
    }

    // Two-step inline delete (native confirm() is unreliable in this window).
    const del = htmlButton(doc, "🗑 Delete", pal);
    del.style.borderColor = "#e0b4b4";
    let armed = false;
    del.addEventListener("click", async () => {
      if (!armed) {
        armed = true;
        del.textContent = "🗑 Click again to confirm";
        del.style.color = "#c00";
        del.style.borderColor = "#c00";
        return;
      }
      try {
        await IdeaLayer.remove(idea.id);
        await refresh();
      } catch (e) {
        fail("delete", e);
      }
    });
    actions.appendChild(del);
    actions.appendChild(status);

    card.appendChild(actions);
    card.appendChild(picker);
    return card;
  }
}
