# Grounded Q&A for Zotero

[![Zotero 7](https://img.shields.io/badge/Zotero-7-CC2936?style=flat-square&logo=zotero&logoColor=white)](https://www.zotero.org)
[![Anthropic · OpenAI · Ollama · DeepSeek · Grok](https://img.shields.io/badge/LLM-Anthropic%20·%20OpenAI%20·%20Ollama%20·%20DeepSeek%20·%20Grok-5436DA?style=flat-square)](#-supported-providers--models)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue?style=flat-square)](LICENSE)
[![Built with Zotero Plugin Template](https://img.shields.io/badge/Built%20with-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

[English](README.md) | [Français](doc/README-frFR.md) | [简体中文](doc/README-zhCN.md)

**Ask questions about your papers and get answers grounded in the source — every claim is cited with a clickable page link that jumps you straight to the spot in the PDF.**

Grounded Q&A reads the full text of your PDFs, sends your question to the AI provider of your choice, and renders the answer with inline `[Page N]` citations. Click a citation and the reader jumps to that page. Works on a single paper open in the reader, or across multiple papers selected in your library.

---

## ✨ Features

- **📄 Single-paper Q&A** — Ask questions about the PDF you're reading from a side panel in the Zotero reader.
- **📚 Multi-paper Q&A** — Select several items in your library and ask one question across all of them at once.
- **🔗 Grounded, clickable citations** — Answers cite `[Page N]` (single paper) or `[Paper N, Page M]` (multi-paper). Click to jump to the exact page in the right PDF.
- **🧩 Bring your own model** — Anthropic (Claude), OpenAI (GPT), Ollama (local), DeepSeek, and Grok (xAI) are all supported.
- **🔒 Local key storage** — Your API key lives in Zotero's own preferences, never sent anywhere except the provider you choose.
- **🖥️ Run fully offline** — Point it at a local [Ollama](https://ollama.com) server for private, no-key, no-cloud answers.
- **✅ Test Connection** — One click in Settings verifies your provider, key, and model before you rely on them.

---

## 🚀 Installation

1. Download the latest `grounded-q-a.xpi` from the [Releases page](https://github.com/birugit/zotero-grounded-qa/releases).
2. In Zotero, open **Tools → Plugins** (or **Add-ons**).
3. Click the gear icon ⚙ in the top-right → **Install Plugin From File…**
4. Select the downloaded `.xpi` file.
5. **Restart Zotero.**

> [!note]
> Requires **Zotero 7**. The plugin needs each PDF's text to be indexed — open a PDF in the reader once so Zotero can extract its text, or run **Library → right-click → Reindex Item**.

---

## 🔑 Configuration

Open **Zotero → Settings (⌘,) → Grounded Q&A** in the left panel.

1. **AI Provider** — pick Anthropic, OpenAI, Ollama, DeepSeek, or Grok.
2. **API Key** — paste your key (not required for Ollama). Use the **Show** button to reveal it while typing.
3. **Base URL** — only shown for Ollama; defaults to `http://localhost:11434`.
4. **Model** — choose from the model list for the selected provider.
5. **Test connection** — click to confirm everything works. You'll see `✓ Connected — model "…" OK` on success.

### Where to get an API key

| Provider       | Get a key                                                                    | Key format       |
| -------------- | ---------------------------------------------------------------------------- | ---------------- |
| **Anthropic**  | [console.anthropic.com](https://console.anthropic.com) → API Keys            | `sk-ant-api03-…` |
| **OpenAI**     | [platform.openai.com](https://platform.openai.com) → API Keys                | `sk-…`           |
| **DeepSeek**   | [platform.deepseek.com](https://platform.deepseek.com) → API Keys            | `sk-…`           |
| **Grok (xAI)** | [console.x.ai](https://console.x.ai) → API Keys                              | `xai-…`          |
| **Ollama**     | No key needed — [install Ollama](https://ollama.com) and run a model locally | —                |

---

## 💬 Usage

### Single paper (in the reader)

1. Open a PDF in the Zotero reader.
2. In the right-hand item pane, open the **Grounded Q&A** section (book icon in the sidenav).
3. Type a question and press **Ask** (or `Ctrl/⌘ + Enter`).
4. The answer appears with clickable `[Page N]` citations — click one to jump to that page.

### Across multiple papers (in the library)

1. In your library, **select 2 or more items** that have PDF attachments.
2. **Right-click → "Q&A: Ask across selected papers."**
3. The plugin extracts each paper's text (skipping any with no extractable text), then opens a dialog.
4. Ask your question. The answer cites `[Paper N, Page M]` — click a citation to open **that** paper at the cited page.

> [!tip]
> Multi-paper questions are great for literature comparison, e.g. _"How do these papers differ in their experimental setup?"_ or _"Which paper reports the highest accuracy, and on what dataset?"_

---

## 🧩 Supported Providers & Models

| Provider               | Endpoint                    | Models                                                              |
| ---------------------- | --------------------------- | ------------------------------------------------------------------- |
| **Anthropic (Claude)** | `https://api.anthropic.com` | `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-8` |
| **OpenAI (GPT)**       | `https://api.openai.com`    | `gpt-5.3-instant`, `gpt-5.4-pro`, `gpt-5.4-thinking`                |
| **Ollama (local)**     | `http://localhost:11434`    | `llama3.2`, `llama3.1`, `mistral`, `qwen2.5`, `gemma3`              |
| **DeepSeek**           | `https://api.deepseek.com`  | `deepseek-r1`                                                       |
| **Grok (xAI)**         | `https://api.x.ai`          | `grok-4.3`, `grok-4.20`                                             |

All cloud providers are called through their OpenAI-compatible `/v1/chat/completions` endpoint, except Anthropic, which uses its native `/v1/messages` API.

---

## 🗂️ How it works

1. **Extract** — PDF text is pulled per page via Zotero's `PDFWorker`, falling back to Zotero's full-text index. Pages are tracked so citations can map back to a location.
2. **Build context** — Page text is assembled with `[Page N]` markers, capped at ~80k characters. For multi-paper questions, the budget is split evenly across papers (cap-per-paper), and long papers are truncated.
3. **Ask** — The question and context go to your chosen provider with a system prompt instructing the model to cite every claim by page.
4. **Render** — Citations in the response are parsed and turned into clickable links that drive the reader to the cited page.

---

## 🛠️ Development

Built on the [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) and [zotero-plugin-scaffold](https://github.com/northword/zotero-plugin-scaffold).

```bash
# install dependencies
npm install

# launch a dev Zotero with the plugin loaded + hot reload on every change
npm run start

# build a production .xpi (output in .scaffold/build/)
npm run build

# lint / format
npm run lint:fix
```

The build output `.scaffold/build/grounded-q-a.xpi` can be installed manually via **Tools → Plugins → ⚙ → Install Plugin From File…**

### Project layout

```
addon/
  content/preferences.xhtml      # Settings pane UI
  locale/**/preferences.ftl      # Localized strings (en-US, zh-CN)
  prefs.js                       # Default preference values
src/
  hooks.ts                       # Plugin lifecycle + menu registration
  modules/
    qaPanel.ts                   # Reader panel + multi-paper dialog + citations
    pdfExtractor.ts              # Per-page PDF text extraction
    llmClient.ts                 # Provider API calls + context building
    preferenceScript.ts          # Settings pane logic (provider/model/test)
```

---

## 🔍 Troubleshooting

**"No text found in this PDF."**
Zotero hasn't indexed the PDF's text. Open it in the reader once, or right-click the item → **Reindex Item**. Image-only/scanned PDFs without OCR have no extractable text.

**"API key not set."**
Add your key in **Settings → Grounded Q&A**, then click **Test connection** to confirm. (Not required for Ollama.)

**Test connection fails with an HTTP error.**

- `401` — wrong or expired API key.
- `404` / model error — the selected model isn't available on your account; pick another.
- For Ollama, make sure the server is running (`ollama serve`) and the model is pulled (`ollama pull llama3.2`).

**Citations aren't clickable.**
This happens if the model didn't use the expected citation format. Try a more capable model (e.g. Claude Sonnet/Opus or GPT-5.4 Pro), which follow the citation instructions more reliably.

**Need more detail?**
Open **Help → Debug Output Logging → View Output** and look for lines starting with `[GroundedQA]`.

---

## 📄 License

Distributed under the **AGPL-3.0-or-later** license. See [LICENSE](LICENSE).

No warranties are provided. You are responsible for any usage costs incurred with your chosen AI provider.
