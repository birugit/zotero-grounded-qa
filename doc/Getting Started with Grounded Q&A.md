# Getting Started with Grounded Q&A

Grounded Q&A lets you **ask questions about your papers and get answers grounded in the source** — every claim is cited with a clickable page link that jumps you straight to the spot in the PDF. You can ask about a single paper open in the reader, or across several papers selected in your library.

This guide walks you through installing the plugin, connecting an AI model, and using both Q&A modes.

---

## 1. Install the plugin

1. Download the latest `grounded-q-a.xpi` from the [Releases page](https://github.com/birugit/zotero-grounded-qa/releases).
2. In Zotero, open **Tools → Plugins**.
3. Click the gear icon ⚙ in the top-right → **Install Plugin From File…**
4. Select the downloaded `.xpi` file.
5. **Restart Zotero.**

> **Requirements:** Zotero 7, and each PDF must have indexed text. Open a PDF in the reader once (or right-click the item → **Reindex Item**) so Zotero can extract its text. Scanned/image-only PDFs without OCR have no extractable text.

---

## 2. Connect an AI model

Open **Zotero → Settings (⌘,) → Grounded Q&A** in the left panel.

![Setting up the model connection in Zotero Settings](setting%20up%20Model%20connection.png)

Configure the following:

| Field | What to do |
| --- | --- |
| **AI Provider** | Choose your provider — Anthropic (Claude), OpenAI (GPT), Ollama (local), DeepSeek, or Grok (xAI). |
| **API Key** | Paste your key. The label and placeholder update to match the provider. Click **Show** to reveal what you typed. *(Not required for Ollama.)* |
| **Base URL** | Only appears for Ollama — defaults to `http://localhost:11434`. |
| **Model** | Pick a model from the list for the selected provider. |
| **Test connection** | Click to verify your provider, key, and model. On success you'll see `✓ Connected — model "…" OK`. |

> The screenshot above shows Anthropic selected with the `claude-haiku-4-5-20251001` model. The hint beneath the key field tells you where to get a key for the chosen provider (e.g. *console.anthropic.com → API Keys*).

### Where to get an API key

| Provider | Get a key | Key format |
| --- | --- | --- |
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com) → API Keys | `sk-ant-api03-…` |
| **OpenAI** | [platform.openai.com](https://platform.openai.com) → API Keys | `sk-…` |
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com) → API Keys | `sk-…` |
| **Grok (xAI)** | [console.x.ai](https://console.x.ai) → API Keys | `xai-…` |
| **Ollama** | No key needed — [install Ollama](https://ollama.com) and run a model locally | — |

> **Tip:** Always click **Test connection** after entering your key. It catches a wrong key (HTTP 401) or an unavailable model before you rely on it during real questions.

---

## 3. Ask about a single paper (in the reader)

This is the fastest way to interrogate the paper you're currently reading.

1. Open a PDF in the Zotero reader.
2. In the right-hand item pane, click the **book icon** in the sidenav to open the **Grounded Q&A** section.
3. Type your question in the box and press **Ask** — or use the keyboard shortcut **Ctrl/⌘ + Enter**.
4. Use **Clear** to reset the question and answer.

![Single-paper Grounded Q&A panel in the reader](Single%20Paper%20Grounded%20QA.png)

The answer appears below the box with inline **`[Page N]` citations**. Each citation is a clickable link — click it and the reader **jumps to that page**, so you can verify the source instantly.

> If you haven't set an API key yet, the panel shows a yellow setup card pointing you to **Settings → Grounded Q&A**.

---

## 4. Ask across multiple papers (from the library)

Great for literature comparison — ask one question and have it answered across several papers at once.

1. In your library, **select 2 or more items** that have PDF attachments.
2. **Right-click → "Q&A: Ask across selected papers."**
3. The plugin extracts each paper's text (showing a progress window), automatically **skipping any PDF with no extractable text**, then opens a dialog.

![Multi-paper Grounded Q&A dialog](Multiple%20Paper%20Grounded%20QA.png)

The dialog header lists the papers being queried (e.g. *"Asking across 2 papers"*). Type your question and click **Ask**. The answer cites **`[Paper N, Page M]`** — clicking a citation opens **that specific paper** at the cited page. Click **Close** when you're done.

> **Example questions:**
> - *"How do these papers differ in their experimental setup?"*
> - *"Which paper reports the highest accuracy, and on what dataset?"*
> - *"Summarize the common limitations discussed across these papers."*

> **Note:** The menu item only appears when **at least 2 selected items have a PDF**. If you select two items but only one has a PDF attached, it stays hidden.

---

## 5. How citations work

Every answer is **grounded** — the model is instructed to cite each claim by page:

- **Single paper:** `[Page 5]` → jumps the open reader to page 5.
- **Multiple papers:** `[Paper 2, Page 5]` → opens paper #2 (as listed in the dialog header) to page 5.

This lets you trace any statement back to its exact source in seconds, instead of taking the model's word for it.

> If citations aren't clickable, the model likely didn't follow the citation format. Try a more capable model (e.g. Claude Sonnet/Opus or GPT-5.4 Pro), which adhere to the instructions more reliably.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| **"No text found in this PDF."** | Open the PDF in the reader once, or right-click → **Reindex Item**. Image-only PDFs need OCR first. |
| **"API key not set."** | Add your key in **Settings → Grounded Q&A** and click **Test connection**. (Not needed for Ollama.) |
| **Test connection fails (401)** | Wrong or expired API key. |
| **Test connection fails (404 / model error)** | The selected model isn't available on your account — pick another. |
| **Ollama not responding** | Make sure the server is running (`ollama serve`) and the model is pulled (`ollama pull llama3.2`). |
| **Multi-paper menu missing** | Select **2+ items that each have a PDF** attachment. |

For deeper diagnostics, open **Help → Debug Output Logging → View Output** and look for lines starting with `[GroundedQA]`.

---

Need the full reference (supported models, architecture, development setup)? See the [README](../README.md).
