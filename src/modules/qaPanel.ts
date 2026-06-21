import { getLocaleID } from "../utils/locale";
import { extractPDFPages, findPdfAttachmentID } from "./pdfExtractor";
import {
  askGroundedQuestion,
  askGroundedQuestionMultiple,
  PaperSource,
} from "./llmClient";

// Splitting pattern - capturing group ensures the delimiter is kept in the array
const CITATION_SPLIT_RE = /(\[Page \d+(?:,\s*\d+)*\])/g;
// Non-global version for testing individual parts
const CITATION_TEST_RE = /^\[Page \d+(?:,\s*\d+)*\]$/;

// Multi-paper citations look like [Paper 2, Page 5] or [Paper 1, Page 3, 4]
const MULTI_CITATION_SPLIT_RE = /(\[Paper \d+, Page \d+(?:,\s*\d+)*\])/g;
const MULTI_CITATION_TEST_RE = /^\[Paper \d+, Page \d+(?:,\s*\d+)*\]$/;

export class QAPanelFactory {
  // ── Multi-paper Q&A ────────────────────────────────────────────────────────

  static registerMultiPaperMenuItem() {
    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: "zotero-itemmenu-grounded-qa-multi",
      label: "Q&A: Ask across selected papers",
      icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`,
      getVisibility: () => {
        const items: Zotero.Item[] = ztoolkit
          .getGlobal("ZoteroPane")
          .getSelectedItems();
        // Show only when 2+ selected items have a PDF to reason over
        return (
          items.filter((i) => findPdfAttachmentID(i) !== null).length >= 2
        );
      },
      commandListener: () => {
        QAPanelFactory.openMultiPaperDialog();
      },
    });
  }

  /** Extract pages for each selected PDF-bearing item, in parallel. */
  private static async gatherSelectedPapers(): Promise<{
    papers: PaperSource[];
    warnings: string[];
  }> {
    const items: Zotero.Item[] = ztoolkit
      .getGlobal("ZoteroPane")
      .getSelectedItems()
      .filter((i: Zotero.Item) => findPdfAttachmentID(i) !== null);

    const warnings: string[] = [];
    const papers: PaperSource[] = [];

    for (const item of items) {
      const title = item.getDisplayTitle() || `Item ${item.id}`;
      const attachmentItemID = findPdfAttachmentID(item)!;
      try {
        const pages = await extractPDFPages(item);
        if (pages.length === 0) {
          warnings.push(`"${title.slice(0, 50)}" — no extractable text (skipped)`);
          continue;
        }
        papers.push({
          number: papers.length + 1,
          attachmentItemID,
          title,
          pages,
        });
      } catch (e: any) {
        warnings.push(`"${title.slice(0, 50)}" — ${e.message} (skipped)`);
      }
    }

    return { papers, warnings };
  }

  static async openMultiPaperDialog() {
    const alert = ztoolkit.getGlobal("alert");

    const pw = new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({ text: "Extracting text from papers…", type: "default" })
      .show();

    const { papers, warnings } = await QAPanelFactory.gatherSelectedPapers();
    pw.close();

    if (papers.length === 0) {
      alert(
        "No usable papers.\n\n" +
          (warnings.join("\n") ||
            "None of the selected items have a PDF with extractable text."),
      );
      return;
    }

    const prefsPrefix = addon.data.config.prefsPrefix;
    const hasApiKey = !!(
      Zotero.Prefs.get(`${prefsPrefix}.apiKey`, true) as string
    );

    const headerLines = [
      `Asking across ${papers.length} paper${papers.length > 1 ? "s" : ""}:`,
      ...papers.map((p) => `  • ${p.title.slice(0, 70)}`),
    ];
    if (warnings.length) {
      headerLines.push("", `⚠ Skipped ${warnings.length}: ${warnings.join("; ")}`);
    }
    if (!hasApiKey) {
      headerLines.push(
        "",
        "⚠ No API key set — add one in Settings → Grounded Q&A.",
      );
    }

    new ztoolkit.Dialog(3, 1)
      .addCell(0, 0, {
        tag: "div",
        styles: {
          fontSize: "12px",
          color: "#444",
          whiteSpace: "pre-wrap",
          marginBottom: "6px",
          maxWidth: "520px",
        },
        properties: { textContent: headerLines.join("\n") },
      })
      .addCell(1, 0, {
        tag: "textarea",
        id: "gqa-multi-question",
        attributes: {
          rows: "3",
          placeholder: "Ask a question across these papers… (then click Ask)",
        },
        styles: {
          width: "520px",
          fontSize: "13px",
          fontFamily: "inherit",
          boxSizing: "border-box",
          padding: "6px",
          resize: "vertical",
        },
      })
      .addCell(2, 0, {
        tag: "div",
        id: "gqa-multi-answer",
        styles: {
          fontSize: "13px",
          lineHeight: "1.6",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          marginTop: "8px",
          padding: "6px 0",
          borderTop: "1px solid #eee",
          width: "520px",
          maxHeight: "320px",
          overflowY: "auto",
          minHeight: "40px",
        },
      })
      .addButton("Ask", "gqa-ask", {
        noClose: true,
        callback: (ev: Event) => {
          const ddoc = (ev.target as Element).ownerDocument!;
          QAPanelFactory.runMultiPaperQuery(ddoc, papers);
        },
      })
      .addButton("Close", "gqa-close")
      .open("Grounded Q&A — Multiple Papers");
  }

  private static async runMultiPaperQuery(
    doc: Document,
    papers: PaperSource[],
  ) {
    const textarea = doc.getElementById(
      "gqa-multi-question",
    ) as HTMLTextAreaElement | null;
    const answerEl = doc.getElementById("gqa-multi-answer") as HTMLElement | null;
    if (!textarea || !answerEl) return;

    const question = textarea.value.trim();
    if (!question) return;
    if (answerEl.dataset.busy === "1") return;

    answerEl.dataset.busy = "1";
    answerEl.textContent = "Thinking…";

    try {
      const answer = await askGroundedQuestionMultiple(question, papers);
      QAPanelFactory.renderMultiAnswer(answerEl, answer, papers);
    } catch (e: any) {
      answerEl.textContent =
        e.message?.includes("API key not set")
          ? "⚠ No API key — set one in Settings → Grounded Q&A."
          : `Error: ${e.message}`;
      answerEl.style.color = "#c00";
      ztoolkit.log("Multi-paper Q&A error:", e);
    } finally {
      delete answerEl.dataset.busy;
    }
  }

  private static renderMultiAnswer(
    container: HTMLElement,
    answer: string,
    papers: PaperSource[],
  ) {
    container.textContent = "";
    container.style.color = "";
    const doc = container.ownerDocument!;
    const wrapper = doc.createElement("div");
    wrapper.style.cssText = "white-space:pre-wrap;word-break:break-word;";

    for (const part of answer.split(MULTI_CITATION_SPLIT_RE)) {
      if (MULTI_CITATION_TEST_RE.test(part)) {
        const parsed = QAPanelFactory.parseMultiCitation(part);
        const link = doc.createElement("a");
        link.href = "#";
        link.textContent = part;
        link.style.cssText =
          "color:#0055aa;cursor:pointer;text-decoration:underline;" +
          "font-weight:600;border-radius:2px;padding:0 1px;";
        const paper = papers.find((p) => p.number === parsed.paperNumber);
        link.title = paper ? `Open "${paper.title}"` : part;
        link.addEventListener("click", (e: MouseEvent) => {
          e.preventDefault();
          if (paper && parsed.pages.length > 0) {
            QAPanelFactory.jumpToPaperPage(
              paper.attachmentItemID,
              parsed.pages[0] - 1,
            );
          }
        });
        wrapper.appendChild(link);
      } else {
        wrapper.appendChild(doc.createTextNode(part));
      }
    }

    container.appendChild(wrapper);
  }

  /** Parse "[Paper 2, Page 5, 6]" → { paperNumber: 2, pages: [5, 6] } */
  private static parseMultiCitation(citation: string): {
    paperNumber: number;
    pages: number[];
  } {
    const paperMatch = citation.match(/Paper (\d+)/);
    const pagePart = citation.match(/Page ([\d,\s]+)/);
    const pages = pagePart
      ? (pagePart[1].match(/\d+/g) || []).map(Number)
      : [];
    return {
      paperNumber: paperMatch ? Number(paperMatch[1]) : 0,
      pages,
    };
  }

  private static async jumpToPaperPage(
    attachmentItemID: number,
    pageIndex: number,
  ) {
    try {
      await (Zotero.Reader as any).open(attachmentItemID, { pageIndex });
    } catch (e) {
      ztoolkit.log("Multi-paper page jump failed:", e);
    }
  }

  static registerQASection() {
    Zotero.ItemPaneManager.registerSection({
      paneID: "grounded-qa",
      pluginID: addon.data.config.addonID,
      header: {
        l10nID: getLocaleID("qa-panel-header"),
        icon: "chrome://zotero/skin/16/universal/book.svg",
      },
      sidenav: {
        l10nID: getLocaleID("qa-panel-sidenav-tooltip"),
        icon: "chrome://zotero/skin/20/universal/book.svg",
      },
      onItemChange: ({ item, setEnabled, tabType }) => {
        setEnabled(tabType === "reader");
        return true;
      },
      onRender: ({ body, item }) => {
        const prefsPrefix = addon.data.config.prefsPrefix;
        const hasApiKey = () =>
          !!(Zotero.Prefs.get(`${prefsPrefix}.apiKey`, true) as string);

        // Build DOM once; guard against re-render
        if (body.dataset.qaInit) {
          (body as any)._qaItem = item;
          // Refresh setup-card visibility when item changes (user may have set the key)
          const card = body.querySelector("[data-qa-setup]") as HTMLElement | null;
          if (card) card.hidden = hasApiKey();
          return;
        }
        body.dataset.qaInit = "1";
        (body as any)._qaItem = item;

        const doc = body.ownerDocument!;

        // ── root container ──────────────────────────────────────────────
        const root = doc.createElement("div");
        root.style.cssText =
          "display:flex;flex-direction:column;gap:6px;" +
          "padding:8px;box-sizing:border-box;height:100%;";
        body.appendChild(root);

        // ── API key setup card (shown when key is missing) ───────────────
        const setupCard = doc.createElement("div");
        setupCard.setAttribute("data-qa-setup", "1");
        setupCard.hidden = hasApiKey();
        setupCard.style.cssText =
          "background:#fff8e1;border:1px solid #f9a825;border-radius:4px;" +
          "padding:8px 10px;font-size:12px;line-height:1.6;";
        const titleEl = doc.createElement("b");
        titleEl.textContent = "API key required";
        setupCard.appendChild(titleEl);
        setupCard.appendChild(doc.createElement("br"));
        setupCard.appendChild(
          doc.createTextNode("Add your Anthropic API key in Zotero Settings:"),
        );
        setupCard.appendChild(doc.createElement("br"));
        const step1 = doc.createElement("span");
        step1.style.cssText = "color:#555;";
        step1.textContent =
          "Mac: ⌘,  ·  Windows/Linux: Edit → Settings";
        setupCard.appendChild(step1);
        setupCard.appendChild(doc.createElement("br"));
        const step2 = doc.createElement("b");
        step2.textContent = "→ Click “Grounded Q&A” in the left panel";
        setupCard.appendChild(step2);
        root.appendChild(setupCard);

        // ── question textarea ────────────────────────────────────────────
        const textarea = doc.createElement("textarea");
        textarea.rows = 3;
        textarea.placeholder = "Ask a question... (Ctrl+Enter to submit)";
        textarea.style.cssText =
          "width:100%;resize:vertical;font-size:13px;" +
          "font-family:inherit;border:1px solid #ccc;" +
          "border-radius:4px;padding:6px;box-sizing:border-box;";
        root.appendChild(textarea);

        // ── button row ───────────────────────────────────────────────────
        const btnRow = doc.createElement("div");
        btnRow.style.cssText = "display:flex;gap:6px;";
        root.appendChild(btnRow);

        const askBtn = doc.createElement("button");
        askBtn.textContent = "Ask";
        askBtn.style.cssText =
          "flex:1;padding:5px 10px;cursor:pointer;" +
          "border-radius:4px;border:1px solid #bbb;background:#f0f0f0;font-size:12px;";
        btnRow.appendChild(askBtn);

        const clearBtn = doc.createElement("button");
        clearBtn.textContent = "Clear";
        clearBtn.style.cssText =
          "padding:5px 10px;cursor:pointer;" +
          "border-radius:4px;border:1px solid #bbb;background:#f0f0f0;font-size:12px;";
        btnRow.appendChild(clearBtn);

        // ── status label ─────────────────────────────────────────────────
        const statusEl = doc.createElement("div");
        statusEl.style.cssText =
          "font-size:11px;color:#777;display:none;font-style:italic;";
        root.appendChild(statusEl);

        // ── answer area ──────────────────────────────────────────────────
        const answerEl = doc.createElement("div");
        answerEl.style.cssText =
          "font-size:13px;line-height:1.6;overflow-y:auto;flex:1;" +
          "min-height:80px;border-top:1px solid #eee;padding-top:6px;";
        root.appendChild(answerEl);

        // ── event handlers ───────────────────────────────────────────────
        clearBtn.addEventListener("click", () => {
          textarea.value = "";
          answerEl.innerHTML = "";
          statusEl.style.display = "none";
        });

        const submit = async () => {
          const question = textarea.value.trim();
          if (!question || askBtn.disabled) return;

          const currentItem: Zotero.Item = (body as any)._qaItem;

          askBtn.disabled = true;
          statusEl.style.display = "block";
          statusEl.textContent = "Extracting PDF text...";
          answerEl.innerHTML = "";

          try {
            const pages = await extractPDFPages(currentItem);
            if (pages.length === 0) {
              throw new Error(
                "No text found in this PDF. " +
                  "Open it in the reader once so Zotero can index it.",
              );
            }
            statusEl.textContent = `Found ${pages.length} pages. Asking Claude...`;
            const answer = await askGroundedQuestion(question, pages);
            QAPanelFactory.renderAnswer(answerEl, answer, currentItem);
          } catch (e: any) {
            const errDiv = doc.createElement("div");
            if (e.message.includes("API key not set")) {
              errDiv.style.cssText = "color:#b80;font-size:12px;";
              errDiv.textContent =
                "⚠ No API key — see the setup box above.";
            } else {
              errDiv.style.cssText = "color:#c00;font-size:12px;";
              errDiv.textContent = `Error: ${e.message}`;
            }
            answerEl.appendChild(errDiv);
            ztoolkit.log("Q&A error:", e);
          } finally {
            askBtn.disabled = false;
            statusEl.style.display = "none";
          }
        };

        askBtn.addEventListener("click", submit);
        textarea.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        });
      },
    });
  }

  private static renderAnswer(
    container: HTMLElement,
    answer: string,
    item: Zotero.Item,
  ) {
    container.innerHTML = "";
    const doc = container.ownerDocument!;
    const wrapper = doc.createElement("div");
    wrapper.style.cssText = "white-space:pre-wrap;word-break:break-word;";

    const parts = answer.split(CITATION_SPLIT_RE);

    for (const part of parts) {
      if (CITATION_TEST_RE.test(part)) {
        const pages = QAPanelFactory.parsePageNumbers(part);
        const link = doc.createElement("a");
        link.href = "#";
        link.textContent = part;
        link.style.cssText =
          "color:#0055aa;cursor:pointer;text-decoration:underline;" +
          "font-weight:600;border-radius:2px;padding:0 1px;";
        link.title = `Jump to ${part}`;
        link.addEventListener("click", (e: MouseEvent) => {
          e.preventDefault();
          // Jump to the first page number cited (0-based index)
          if (pages.length > 0) {
            QAPanelFactory.jumpToPage(item, pages[0] - 1);
          }
        });
        wrapper.appendChild(link);
      } else {
        wrapper.appendChild(doc.createTextNode(part));
      }
    }

    container.appendChild(wrapper);
  }

  /** Extract all page numbers from a citation like "[Page 3, 5]" */
  private static parsePageNumbers(citation: string): number[] {
    const nums = citation.match(/\d+/g);
    return nums ? nums.map(Number) : [];
  }

  private static jumpToPage(item: Zotero.Item, pageIndex: number) {
    try {
      const tabID = (ztoolkit.getGlobal("Zotero_Tabs") as any).selectedID as
        | string
        | undefined;
      if (tabID) {
        const reader = (Zotero.Reader as any).getByTabID(tabID);
        if (reader) {
          reader.navigate({ pageIndex });
          return;
        }
      }

      // Fallback: search all open readers for one showing this item or its parent
      const readers: any[] = (Zotero.Reader as any)._readers ?? [];
      for (const r of readers) {
        if (r.itemID === item.id || r.itemID === (item as any).parentID) {
          r.navigate({ pageIndex });
          return;
        }
      }
    } catch (e) {
      ztoolkit.log("Q&A page jump failed:", e);
    }
  }
}
