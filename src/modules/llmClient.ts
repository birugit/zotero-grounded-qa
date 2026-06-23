import { PageChunk } from "./pdfExtractor";

const MAX_CONTEXT_CHARS = 80000;

const PROVIDER_DEFAULTS: Record<string, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-5.3-instant",
  ollama: "llama3.2",
  deepseek: "deepseek-r1",
  grok: "grok-4.3",
};

const PROVIDER_BASE_URLS: Record<string, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
  ollama: "http://localhost:11434",
  deepseek: "https://api.deepseek.com",
  grok: "https://api.x.ai",
};

function getPref(key: string): string {
  return (
    (Zotero.Prefs.get(
      `${addon.data.config.prefsPrefix}.${key}`,
      true,
    ) as string) ?? ""
  );
}

function getProvider(): string {
  return getPref("provider") || "anthropic";
}

function getApiKey(): string {
  return getPref("apiKey");
}

function getModel(): string {
  const provider = getProvider();
  return getPref("model") || PROVIDER_DEFAULTS[provider] || "gpt-4o-mini";
}

function getBaseUrl(): string {
  const provider = getProvider();
  const customUrl = getPref("baseUrl").replace(/\/$/, "");
  if (provider === "ollama" && customUrl) return customUrl;
  return PROVIDER_BASE_URLS[provider] || "";
}

export async function askGroundedQuestion(
  question: string,
  pages: PageChunk[],
): Promise<string> {
  const provider = getProvider();
  const apiKey = getApiKey();

  if (provider !== "ollama" && !apiKey) {
    throw new Error("API key not set. Please add it in plugin preferences.");
  }

  const context = buildContext(pages);
  const model = getModel();
  const baseUrl = getBaseUrl();

  const systemPrompt = `You are a research assistant answering questions about a document.
The document text is provided below with page markers like [Page N].
When referencing specific information, always cite the page number inline using the format [Page N].
If a fact spans multiple pages, cite each one. Be concise and accurate.
If the answer is not found in the document, say so clearly.

Document:
${context}`;

  if (provider === "anthropic") {
    return callAnthropicAPI(apiKey, model, baseUrl, systemPrompt, question);
  }
  return callOpenAICompatibleAPI(
    apiKey,
    model,
    baseUrl,
    systemPrompt,
    question,
    ollamaKeepAlive(provider),
  );
}

export interface PaperSource {
  /** Index used in citations, 1-based. */
  number: number;
  /** Zotero attachment item ID of the PDF (for jump-to-page). */
  attachmentItemID: number;
  title: string;
  pages: PageChunk[];
}

export async function askGroundedQuestionMultiple(
  question: string,
  papers: PaperSource[],
): Promise<string> {
  const provider = getProvider();
  const apiKey = getApiKey();

  if (provider !== "ollama" && !apiKey) {
    throw new Error("API key not set. Please add it in plugin preferences.");
  }

  const context = buildMultiContext(papers);
  const model = getModel();
  const baseUrl = getBaseUrl();

  const systemPrompt = `You are a research assistant answering a question across multiple documents.
Each document is labeled like [Paper N: "Title"], and its text is divided into pages marked [Page M].
When you reference information, you MUST cite it inline using the exact format [Paper N, Page M] (for example [Paper 2, Page 5]).
If a fact spans several pages of the same paper, cite each page like [Paper 1, Page 3, 4].
Cite every claim you make. Compare and contrast the papers where relevant.
If the answer is not found in the provided documents, say so clearly.

Documents:
${context}`;

  if (provider === "anthropic") {
    return callAnthropicAPI(apiKey, model, baseUrl, systemPrompt, question);
  }
  return callOpenAICompatibleAPI(
    apiKey,
    model,
    baseUrl,
    systemPrompt,
    question,
    ollamaKeepAlive(provider),
  );
}

/**
 * Extra request-body fields for Ollama: keep the model resident in memory so
 * follow-up questions don't pay the cold-load cost. The window is configurable
 * via the `keepAlive` preference (e.g. "30m", "1h", "-1" for indefinite).
 * Other providers ignore unknown fields, so we only add it for Ollama.
 */
function ollamaKeepAlive(provider: string): Record<string, unknown> {
  if (provider !== "ollama") return {};
  const keepAlive = getPref("keepAlive").trim() || "30m";
  return { keep_alive: keepAlive };
}

/** Cap-per-paper context builder: each paper gets an equal share of the budget. */
function buildMultiContext(papers: PaperSource[]): string {
  const perPaperBudget = Math.floor(
    MAX_CONTEXT_CHARS / Math.max(papers.length, 1),
  );
  const blocks: string[] = [];

  for (const paper of papers) {
    const header = `[Paper ${paper.number}: "${paper.title}"]`;
    const parts: string[] = [header];
    let used = header.length;

    for (const page of paper.pages) {
      const entry = `[Page ${page.pageNumber}]\n${page.text}`;
      if (used + entry.length > perPaperBudget) {
        // Include a truncated slice of this page if meaningful room remains
        const remaining = perPaperBudget - used - 60;
        if (remaining > 200) {
          parts.push(
            `[Page ${page.pageNumber}]\n${page.text.slice(0, remaining)}…[truncated]`,
          );
        }
        break;
      }
      parts.push(entry);
      used += entry.length + 2;
    }

    blocks.push(parts.join("\n\n"));
  }

  return blocks.join("\n\n----------\n\n");
}

function buildContext(pages: PageChunk[]): string {
  const parts: string[] = [];
  let totalChars = 0;

  for (const page of pages) {
    const entry = `[Page ${page.pageNumber}]\n${page.text}`;
    if (totalChars + entry.length > MAX_CONTEXT_CHARS) break;
    parts.push(entry);
    totalChars += entry.length + 2;
  }

  return parts.join("\n\n");
}

async function callAnthropicAPI(
  apiKey: string,
  model: string,
  baseUrl: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  return zoteroLLMRequest(
    `${baseUrl}/v1/messages`,
    {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
    (data) => data.content[0].text as string,
  );
}

async function callOpenAICompatibleAPI(
  apiKey: string,
  model: string,
  baseUrl: string,
  systemPrompt: string,
  userMessage: string,
  extraBody: Record<string, unknown> = {},
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return zoteroLLMRequest(
    `${baseUrl}/v1/chat/completions`,
    headers,
    JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      ...extraBody,
    }),
    (data) => data.choices[0].message.content as string,
  );
}

async function zoteroLLMRequest(
  url: string,
  headers: Record<string, string>,
  body: string,
  extract: (data: any) => string,
): Promise<string> {
  let xhr: any;
  try {
    xhr = await (Zotero.HTTP as any).request("POST", url, {
      headers,
      body,
      timeout: 60000,
      successCodes: false,
    });
  } catch (e: any) {
    throw new Error(e.message ?? "Network error");
  }

  if (xhr.status === 200) {
    try {
      return extract(JSON.parse(xhr.responseText));
    } catch {
      throw new Error("Failed to parse API response");
    }
  }

  let message = `API error ${xhr.status}`;
  try {
    const err = JSON.parse(xhr.responseText);
    message = err.error?.message ?? message;
  } catch {
    /* keep default */
  }
  throw new Error(message);
}
