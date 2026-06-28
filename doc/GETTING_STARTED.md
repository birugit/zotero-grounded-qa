# Getting Started with Lattice

This guide walks you from install to using every part of Lattice. It takes about
10 minutes. No prior setup is needed for the annotation and idea features; the
AI Q&A features need an API key (or a local Ollama install).

- [What Lattice does](#what-lattice-does)
- [1. Install](#1-install)
- [2. Browse all your annotations](#2-browse-all-your-annotations)
- [3. Filter and export with citations](#3-filter-and-export-with-citations)
- [4. Build your idea layer (the Citavi model)](#4-build-your-idea-layer-the-citavi-model)
- [5. (Optional) Grounded AI Q&A](#5-optional-grounded-ai-qa)
- [Working across multiple libraries](#working-across-multiple-libraries)
- [FAQ & troubleshooting](#faq--troubleshooting)

---

## What Lattice does

In stock Zotero, a highlight or note only exists inside the one PDF it's on. You
can't see all your highlights together, can't filter them across papers, and an
idea is only reachable through the single source it came from. That breaks down
once you have more than a few hundred sources.

Lattice fixes this with three connected pieces:

| Piece                         | What it gives you                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Annotation browser**        | Every highlight/note from your whole library in one window, filterable by colour, tag, keyword, and type, exportable with citations. |
| **Idea layer (Citavi-style)** | Promote the annotations that matter into standalone, taggable, searchable _ideas_ that link to each other and back to their source.  |
| **Grounded Q&A**              | Ask AI questions about your PDFs and get answers with clickable page citations — and save those answers as annotations.              |

Everything is stored as native Zotero items (annotations, notes, tags,
relations), so it all syncs and stays usable even without the plugin.

---

## 1. Install

1. Download the latest `lattice.xpi` from the Releases page.
2. In Zotero: **Tools → Plugins** (or **Add-ons**).
3. Click the gear ⚙ (top-right) → **Install Plugin From File…**
4. Select the `.xpi` and **restart Zotero**.

You'll see a brief "Lattice loaded" message on startup. Requires **Zotero 7+**.

---

## 2. Browse all your annotations

> Goal: see every highlight and note in your library in one place.

1. Open **Tools → All Annotations**.
2. The window opens on the **📑 Annotations** tab and lists every annotation in
   your library — highlights, notes, underlines — each showing its text, the
   source paper's title, the page, and any tags.
3. **Click any row** to open that PDF at the exact annotation.

![The All Annotations window with filters and per-row actions](Annotations.png)

> If the list is empty, your library has no PDF annotations yet. Open a PDF and
> make a highlight first, then reopen the window.

---

## 3. Filter and export with citations

> Goal: narrow to the highlights you care about and export them, cited.

### Filter

In the **📑 Annotations** tab, combine any of:

- **Search box** — matches highlight text, your comments, the paper title, and tags.
- **Colour swatches** — click one or more to show only those colours (click again to deselect).
- **Tag** dropdown — show only annotations carrying a tag.
- **Type** dropdown — Highlights / Notes / Underlines / etc.

Filters combine with AND (multiple colours are OR within colour). The count label
always reflects what's shown.

> **New colours/tags not appearing?** Those rows are built when the window opens.
> Close and reopen **All Annotations** to pick up annotations you just added.

### Export

With your filter applied, use the action row:

- **Copy as Markdown** / **Copy as HTML** — copies the filtered set to the
  clipboard. Each source paper is cited **once** (using your Zotero citation
  style), with its highlights and notes beneath it, plus a link back to each.
- **📝 Save as note** — saves the same digest as a standalone Zotero note you can
  keep, search, and sync.

---

## 4. Build your idea layer (the Citavi model)

> Goal: lift the important annotations into a cross-paper layer of ideas you can
> tag, link, and find on their own.

### Promote annotations into ideas

- On any annotation row, click **★ Promote to idea**, or use **★ Promote all to
  ideas** to promote everything currently filtered.
- Each idea is created as a standalone Zotero note (tagged `★idea`) seeded with
  the highlight + your comment, carrying over the annotation's tags, and linked
  back to the source paper.

### Work with ideas

Switch to the **🧠 Ideas** tab (or open **Tools → Idea Layer (Citavi)**). Each
idea is a card:

![The Ideas tab — an idea card with tags, a linked idea, and actions](Citave.png)

- **➕ New idea** — create a blank idea from scratch.
- **Tags** — type in the small `+ tag` box and press Enter to add; click the **×**
  on a tag chip to remove it.
- **🔗 Link to…** — click it to reveal a list of your other ideas; click one to
  link them. Linked ideas show as green chips (click the **×** to unlink).
- **📄 Open source** — selects the source paper in your library.
- **🗑 Delete** — click once to arm ("Click again to confirm"), then again to
  move the idea note to Trash.
- **Search / Tag** filters at the top narrow the list.

Because ideas are real Zotero notes, you can also find them with Zotero's own
search and see their links in each item's **Related** pane.

---

## 5. (Optional) Grounded AI Q&A

> Goal: ask questions about your PDFs and get cited answers.

### One-time setup

Open **Zotero → Settings (⌘,) → Lattice**:

1. **AI Provider** — Anthropic, OpenAI, Ollama (local, no key), DeepSeek, or Grok.
2. **API Key** — paste your key (skip for Ollama).
3. **Model** — pick one from the list.
4. **Test connection** — confirms it works.

### Ask about one paper

1. Open a PDF in the reader.
2. In the right item pane, open the **Grounded Q&A** section.
3. Type a question → **Ask** (or Ctrl/⌘+Enter).
4. The answer shows clickable `[Page N]` citations — click to jump.
5. **📌 Save to annotations** keeps the answer as a note annotation on the cited
   page, so it flows into your annotation browser and idea layer.

### Ask across several papers

1. In your library, select **2+ items** that have PDFs.
2. **Right-click → "Q&A: Ask across selected papers."**
3. Ask your question. Citations are `[Paper N, Page M]` — click to open that
   paper at the cited page.
4. **📌 Save all to annotations** anchors the answer on each cited paper.

---

## Working across multiple libraries

If you belong to **group libraries**, both the Annotations and Ideas views show a
**Library** dropdown (top of the panel). Pick a library to browse its annotations
or ideas; the view re-indexes for that library. With only **My Library**, the
dropdown is hidden (there's nothing to switch to).

---

## FAQ & troubleshooting

**The annotation list is empty.** Your library has no PDF annotations yet, or
they haven't been read. Make a highlight in any PDF and reopen the window.

**A new colour/tag isn't in the filter row.** Close and reopen **All
Annotations** — those rows are computed when the window opens.

**Q&A says "No text found in this PDF."** Zotero hasn't indexed the PDF's text.
Open it in the reader once, or right-click the item → **Reindex Item**. Scanned
PDFs need OCR.

**Q&A citations aren't clickable.** The model didn't use the expected citation
format. Try a more capable model (Claude Sonnet/Opus, GPT pro tiers).

**Do my ideas/annotations survive uninstalling Lattice?** Yes — they're ordinary
Zotero annotations, notes, tags, and relations. Ideas remain as notes tagged
`★idea`.

**Where is my data sent?** Only the AI Q&A features contact a provider, and only
the provider you choose. Annotation browsing and the idea layer are fully local.
