# Zotero 有据问答（Grounded Q&A）

[![Zotero 7](https://img.shields.io/badge/Zotero-7-CC2936?style=flat-square&logo=zotero&logoColor=white)](https://www.zotero.org)
[![Anthropic · OpenAI · Ollama · DeepSeek · Grok](https://img.shields.io/badge/LLM-Anthropic%20·%20OpenAI%20·%20Ollama%20·%20DeepSeek%20·%20Grok-5436DA?style=flat-square)](#-支持的提供商与模型)
[![许可证：AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue?style=flat-square)](../LICENSE)
[![基于 Zotero Plugin Template 构建](https://img.shields.io/badge/Built%20with-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

[English](../README.md) | [Français](README-frFR.md) | [简体中文](README-zhCN.md)

**就你的论文提问，获得有据可依的回答——每一条论断都附带可点击的页码链接，直接跳转到 PDF 中的对应位置。**

Grounded Q&A 读取 PDF 的全文，将你的问题发送给你所选择的 AI 提供商，并在回答中以 `[Page N]` 形式内联标注引用。点击引用，阅读器即跳转到该页。既可针对在阅读器中打开的单篇论文，也可针对在文库中选中的多篇论文同时提问。

---

## ✨ 功能特性

- **📄 单篇论文问答** — 在 Zotero 阅读器的侧边栏中，就你正在阅读的 PDF 提问。
- **📚 多篇论文问答** — 在文库中选择多个条目，一次性就所有这些论文提出同一个问题。
- **🔗 有据可依、可点击的引用** — 回答会标注 `[Page N]`（单篇）或 `[Paper N, Page M]`（多篇）。点击即可跳转到正确 PDF 中的确切页面。
- **🧩 自带模型** — 支持 Anthropic（Claude）、OpenAI（GPT）、Ollama（本地）、DeepSeek 和 Grok（xAI）。
- **🔒 本地密钥存储** — 你的 API 密钥保存在 Zotero 自身的首选项中，除你选择的提供商外不会发送到任何地方。
- **🖥️ 完全离线运行** — 将其指向本地 [Ollama](https://ollama.com) 服务器，即可获得私密、无需密钥、无需云端的回答。
- **✅ 测试连接** — 在设置中点击一下，即可在正式使用前验证你的提供商、密钥和模型。

---

## 🚀 安装

1. 从 [发布页](https://github.com/birugit/zotero-grounded-qa/releases) 下载最新的 `grounded-q-a.xpi`。
2. 在 Zotero 中，打开 **工具 → 插件**（或 **附加组件**）。
3. 点击右上角的齿轮图标 ⚙ → **从文件安装插件……**
4. 选择下载好的 `.xpi` 文件。
5. **重启 Zotero。**

> [!note]
> 需要 **Zotero 7**。插件需要先对每个 PDF 的文本建立索引——在阅读器中打开一次该 PDF，让 Zotero 提取其文本，或使用 **文库 → 右键 → 重新索引条目**。

---

## 🔑 配置

在左侧面板打开 **Zotero → 设置（⌘,）→ Grounded Q&A**。

1. **AI 提供商** — 选择 Anthropic、OpenAI、Ollama、DeepSeek 或 Grok。
2. **API 密钥** — 粘贴你的密钥（Ollama 无需密钥）。输入时可用 **Show** 按钮显示明文。
3. **服务器地址（Base URL）** — 仅在选择 Ollama 时显示；默认为 `http://localhost:11434`。
4. **模型** — 从所选提供商的模型列表中选择。
5. **测试连接** — 点击以确认一切正常。成功时会显示 `✓ Connected — model "…" OK`。

### 在哪里获取 API 密钥

| 提供商 | 获取密钥 | 密钥格式 |
| --- | --- | --- |
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com) → API Keys | `sk-ant-api03-…` |
| **OpenAI** | [platform.openai.com](https://platform.openai.com) → API Keys | `sk-…` |
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com) → API Keys | `sk-…` |
| **Grok (xAI)** | [console.x.ai](https://console.x.ai) → API Keys | `xai-…` |
| **Ollama** | 无需密钥——[安装 Ollama](https://ollama.com) 并在本地运行模型 | — |

---

## 💬 使用方法

### 单篇论文（在阅读器中）

1. 在 Zotero 阅读器中打开一个 PDF。
2. 在右侧条目面板中，打开 **Grounded Q&A** 区块（侧边导航栏中的书本图标）。
3. 输入问题并点击 **Ask**（或按 `Ctrl/⌘ + Enter`）。
4. 回答会以可点击的 `[Page N]` 引用形式出现——点击任意引用即可跳转到该页。

### 多篇论文（在文库中）

1. 在文库中，**选择 2 个或更多** 带有 PDF 附件的条目。
2. **右键 → “Q&A: Ask across selected papers”。**
3. 插件会提取每篇论文的文本（自动跳过无法提取文本的论文），然后打开一个对话框。
4. 提出你的问题。回答会标注 `[Paper N, Page M]`——点击引用即可在被引用的页面打开 **对应** 的那篇论文。

> [!tip]
> 多篇论文提问非常适合做文献对比，例如：*“这些论文在实验设置上有何不同？”* 或 *“哪篇论文报告的准确率最高，使用的是什么数据集？”*

---

## 🧩 支持的提供商与模型

| 提供商 | 接口地址 | 模型 |
| --- | --- | --- |
| **Anthropic (Claude)** | `https://api.anthropic.com` | `claude-haiku-4-5-20251001`、`claude-sonnet-4-6`、`claude-opus-4-8` |
| **OpenAI (GPT)** | `https://api.openai.com` | `gpt-5.3-instant`、`gpt-5.4-pro`、`gpt-5.4-thinking` |
| **Ollama（本地）** | `http://localhost:11434` | `llama3.2`、`llama3.1`、`mistral`、`qwen2.5`、`gemma3` |
| **DeepSeek** | `https://api.deepseek.com` | `deepseek-r1` |
| **Grok (xAI)** | `https://api.x.ai` | `grok-4.3`、`grok-4.20` |

除 Anthropic 使用其原生 `/v1/messages` API 外，所有云端提供商均通过其兼容 OpenAI 的 `/v1/chat/completions` 接口调用。

---

## 🗂️ 工作原理

1. **提取** — 通过 Zotero 的 `PDFWorker` 逐页提取 PDF 文本，失败时回退到 Zotero 的全文索引。系统会跟踪页码，使引用能够映射回具体位置。
2. **构建上下文** — 页面文本以 `[Page N]` 标记拼接，上限约为 8 万字符。对于多篇论文提问，预算会在各论文之间平均分配（按篇封顶），过长的论文会被截断。
3. **提问** — 将问题与上下文连同一段系统提示发送给所选提供商，要求模型按页码标注每一条论断。
4. **渲染** — 解析回答中的引用，并将其转换为可点击的链接，驱动阅读器跳转到被引用的页面。

---

## 🛠️ 开发

基于 [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) 与 [zotero-plugin-scaffold](https://github.com/northword/zotero-plugin-scaffold) 构建。

```bash
# 安装依赖
npm install

# 启动加载了插件的开发版 Zotero，并在每次更改时热重载
npm run start

# 构建生产版 .xpi（输出位于 .scaffold/build/）
npm run build

# lint / 格式化
npm run lint:fix
```

构建产物 `.scaffold/build/grounded-q-a.xpi` 可通过 **工具 → 插件 → ⚙ → 从文件安装插件……** 手动安装。

### 项目结构

```
addon/
  content/preferences.xhtml      # 设置面板界面
  locale/**/preferences.ftl      # 本地化字符串（en-US、zh-CN）
  prefs.js                       # 默认首选项值
src/
  hooks.ts                       # 插件生命周期 + 菜单注册
  modules/
    qaPanel.ts                   # 阅读器面板 + 多篇论文对话框 + 引用
    pdfExtractor.ts              # 逐页 PDF 文本提取
    llmClient.ts                 # 提供商 API 调用 + 上下文构建
    preferenceScript.ts          # 设置面板逻辑（提供商/模型/测试）
```

---

## 🔍 故障排查

**“No text found in this PDF.”**
Zotero 尚未对该 PDF 的文本建立索引。在阅读器中打开一次，或右键该条目 → **重新索引条目**。未经 OCR 的纯图片/扫描版 PDF 没有可提取的文本。

**“API key not set.”**
在 **设置 → Grounded Q&A** 中添加你的密钥，然后点击 **Test connection** 确认。（Ollama 无需密钥。）

**测试连接返回 HTTP 错误。**
- `401` — 密钥错误或已过期。
- `404` / 模型错误 — 所选模型在你的账户下不可用；请换一个。
- 对于 Ollama，请确认服务器正在运行（`ollama serve`）且已拉取模型（`ollama pull llama3.2`）。

**引用无法点击。**
当模型未使用预期的引用格式时会出现这种情况。请尝试能力更强的模型（如 Claude Sonnet/Opus 或 GPT-5.4 Pro），它们能更可靠地遵循引用格式要求。

**需要更多细节？**
打开 **帮助 → 调试输出日志 → 查看输出**，查找以 `[GroundedQA]` 开头的行。

---

## 📄 许可证

以 **AGPL-3.0-or-later** 许可证分发。参见 [LICENSE](../LICENSE)。

不提供任何担保。你需要自行承担在所选 AI 提供商处产生的使用费用。
