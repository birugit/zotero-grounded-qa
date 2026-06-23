import { config } from "../../package.json";

const PREFS_PREFIX = config.prefsPrefix;

interface ProviderConfig {
  name: string;
  defaultModel: string;
  models: Array<{ value: string; label: string }>;
  requiresKey: boolean;
  keyPlaceholder: string;
  keyHint: string;
  hasBaseUrl: boolean;
  defaultBaseUrl: string;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  anthropic: {
    name: "Anthropic",
    defaultModel: "claude-haiku-4-5-20251001",
    models: [
      {
        value: "claude-haiku-4-5-20251001",
        label: "claude-haiku-4-5-20251001",
      },
      { value: "claude-sonnet-4-6", label: "claude-sonnet-4-6" },
      { value: "claude-opus-4-8", label: "claude-opus-4-8" },
    ],
    requiresKey: true,
    keyPlaceholder: "sk-ant-api03-...",
    keyHint: "Get your key at console.anthropic.com → API Keys",
    hasBaseUrl: false,
    defaultBaseUrl: "https://api.anthropic.com",
  },
  openai: {
    name: "OpenAI",
    defaultModel: "gpt-5.3-instant",
    models: [
      { value: "gpt-5.3-instant", label: "GPT-5.3 Instant" },
      { value: "gpt-5.4-pro", label: "GPT-5.4 Pro" },
      { value: "gpt-5.4-thinking", label: "GPT-5.4 Thinking" },
    ],
    requiresKey: true,
    keyPlaceholder: "sk-...",
    keyHint: "Get your key at platform.openai.com → API Keys",
    hasBaseUrl: false,
    defaultBaseUrl: "https://api.openai.com",
  },
  ollama: {
    name: "Ollama",
    defaultModel: "llama3.2",
    models: [
      { value: "llama3.2", label: "Llama 3.2" },
      { value: "llama3.1", label: "Llama 3.1" },
      { value: "mistral", label: "Mistral 7B" },
      { value: "qwen2.5", label: "Qwen 2.5" },
      { value: "gemma3", label: "Gemma 3" },
    ],
    requiresKey: false,
    keyPlaceholder: "(not required for Ollama)",
    keyHint: "No API key needed — Ollama runs locally on your machine",
    hasBaseUrl: true,
    defaultBaseUrl: "http://localhost:11434",
  },
  deepseek: {
    name: "DeepSeek",
    defaultModel: "deepseek-r1",
    models: [{ value: "deepseek-r1", label: "DeepSeek-R1" }],
    requiresKey: true,
    keyPlaceholder: "sk-...",
    keyHint: "Get your key at platform.deepseek.com → API Keys",
    hasBaseUrl: false,
    defaultBaseUrl: "https://api.deepseek.com",
  },
  grok: {
    name: "Grok (xAI)",
    defaultModel: "grok-4.3",
    models: [
      { value: "grok-4.3", label: "Grok 4.3" },
      { value: "grok-4.20", label: "Grok 4.20" },
    ],
    requiresKey: true,
    keyPlaceholder: "xai-...",
    keyHint: "Get your key at console.x.ai → API Keys",
    hasBaseUrl: false,
    defaultBaseUrl: "https://api.x.ai",
  },
};

function getPref(key: string): string {
  return (Zotero.Prefs.get(`${PREFS_PREFIX}.${key}`, true) as string) ?? "";
}

function setPref(key: string, value: string) {
  Zotero.Prefs.set(`${PREFS_PREFIX}.${key}`, value, true);
}

export async function registerPrefsScripts(window: Window) {
  const doc = window.document;
  const ref = config.addonRef;

  // menulist is a XUL element — cast to any since we have no XUL typings
  const providerSelect = doc.getElementById(
    `zotero-prefpane-${ref}-provider`,
  ) as any;
  const keyRow = doc.getElementById(
    `zotero-prefpane-${ref}-apikey-row`,
  ) as HTMLElement | null;
  const keyLabel = doc.getElementById(
    `zotero-prefpane-${ref}-apikey-label`,
  ) as HTMLElement | null;
  const keyInput = doc.getElementById(
    `zotero-prefpane-${ref}-apikey`,
  ) as HTMLInputElement | null;
  const keyHintEl = doc.getElementById(
    `zotero-prefpane-${ref}-apikey-hint`,
  ) as HTMLElement | null;
  const toggleBtn = doc.getElementById(
    `zotero-prefpane-${ref}-apikey-toggle`,
  ) as HTMLButtonElement | null;
  const baseUrlRow = doc.getElementById(
    `zotero-prefpane-${ref}-baseurl-row`,
  ) as HTMLElement | null;
  const baseUrlHint = doc.getElementById(
    `zotero-prefpane-${ref}-baseurl-hint`,
  ) as HTMLElement | null;
  const baseUrlInput = doc.getElementById(
    `zotero-prefpane-${ref}-baseurl`,
  ) as HTMLInputElement | null;
  const keepAliveRow = doc.getElementById(
    `zotero-prefpane-${ref}-keepalive-row`,
  ) as HTMLElement | null;
  const keepAliveHint = doc.getElementById(
    `zotero-prefpane-${ref}-keepalive-hint`,
  ) as HTMLElement | null;
  const keepAliveInput = doc.getElementById(
    `zotero-prefpane-${ref}-keepalive`,
  ) as HTMLInputElement | null;
  const modelMenu = doc.getElementById(`zotero-prefpane-${ref}-model`) as any;
  const testBtn = doc.getElementById(
    `zotero-prefpane-${ref}-test`,
  ) as HTMLButtonElement | null;
  const resultEl = doc.getElementById(
    `zotero-prefpane-${ref}-test-result`,
  ) as HTMLElement | null;

  function updateProviderUI(provider: string, selectedModel?: string) {
    const cfg = PROVIDERS[provider] ?? PROVIDERS.anthropic;

    // Show only items matching the current provider; hide the rest
    if (modelMenu) {
      const allItems = modelMenu.querySelectorAll("menuitem[data-provider]");
      for (const item of allItems) {
        if ((item as Element).getAttribute("data-provider") === provider) {
          (item as any).removeAttribute("hidden");
        } else {
          (item as any).setAttribute("hidden", "true");
        }
      }
      const toSelect = selectedModel || cfg.defaultModel;
      const inList = cfg.models.some((m) => m.value === toSelect);
      modelMenu.value = inList ? toSelect : cfg.defaultModel;
      if (!modelMenu.value) {
        const first = modelMenu.querySelector(
          `menuitem[data-provider="${provider}"]`,
        ) as any;
        if (first) modelMenu.value = first.getAttribute("value");
      }
    }

    // Show/hide API key row
    if (keyRow) keyRow.style.display = cfg.requiresKey ? "" : "none";
    if (keyLabel) keyLabel.textContent = `${cfg.name} API Key`;
    if (keyInput) keyInput.placeholder = cfg.keyPlaceholder;
    if (keyHintEl) keyHintEl.textContent = cfg.keyHint;

    // Show/hide base URL + keep-alive rows (Ollama only)
    if (baseUrlRow) baseUrlRow.style.display = cfg.hasBaseUrl ? "" : "none";
    if (baseUrlHint) baseUrlHint.style.display = cfg.hasBaseUrl ? "" : "none";
    if (keepAliveRow) keepAliveRow.style.display = cfg.hasBaseUrl ? "" : "none";
    if (keepAliveHint)
      keepAliveHint.style.display = cfg.hasBaseUrl ? "" : "none";
  }

  // ── Populate fields from saved prefs ──────────────────────────────────────
  const savedProvider = getPref("provider") || "anthropic";
  if (providerSelect) providerSelect.value = savedProvider;
  if (keyInput) keyInput.value = getPref("apiKey");
  if (baseUrlInput) baseUrlInput.value = getPref("baseUrl");
  if (keepAliveInput) keepAliveInput.value = getPref("keepAlive");

  updateProviderUI(savedProvider, getPref("model"));

  // ── Provider change ───────────────────────────────────────────────────────
  if (providerSelect) {
    providerSelect.addEventListener("command", () => {
      const provider = providerSelect.value;
      setPref("provider", provider);
      updateProviderUI(provider);
      // Save the default model for the new provider
      if (modelMenu) setPref("model", modelMenu.value);
    });
  }

  // ── API key ───────────────────────────────────────────────────────────────
  if (keyInput) {
    keyInput.addEventListener("input", () =>
      setPref("apiKey", keyInput.value.trim()),
    );
  }

  if (keyInput && toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const isPassword = keyInput.type === "password";
      keyInput.type = isPassword ? "text" : "password";
      toggleBtn.textContent = isPassword ? "Hide" : "Show";
    });
  }

  // ── Base URL ──────────────────────────────────────────────────────────────
  if (baseUrlInput) {
    baseUrlInput.addEventListener("input", () =>
      setPref("baseUrl", baseUrlInput.value.trim()),
    );
  }

  // ── Keep-alive (Ollama) ───────────────────────────────────────────────────
  if (keepAliveInput) {
    keepAliveInput.addEventListener("input", () =>
      setPref("keepAlive", keepAliveInput.value.trim()),
    );
  }

  // ── Model ─────────────────────────────────────────────────────────────────
  if (modelMenu) {
    modelMenu.addEventListener("command", () => {
      setPref("model", modelMenu.value);
    });
  }

  // ── Test connection ───────────────────────────────────────────────────────
  if (testBtn && resultEl) {
    testBtn.addEventListener("click", () => {
      runTest().catch((e: any) => {
        resultEl!.textContent = `✗ Unexpected: ${e?.message ?? e}`;
        resultEl!.style.color = "#c00";
        if (testBtn) (testBtn as any).disabled = false;
      });
    });
  }

  async function runTest() {
    if (!resultEl) return;
    const provider = (providerSelect?.value as string) || "anthropic";
    const cfg = PROVIDERS[provider] ?? PROVIDERS.anthropic;
    const apiKey = keyInput?.value.trim() ?? "";
    const model = (modelMenu?.value as string) || cfg.defaultModel;
    const baseUrl =
      baseUrlInput?.value.trim().replace(/\/$/, "") || cfg.defaultBaseUrl;

    // Show what we're about to use — confirms click registered and values are read
    resultEl.textContent = `Testing ${provider} / ${model}...`;
    resultEl.style.color = "#777";

    if (cfg.requiresKey && !apiKey) {
      resultEl.textContent = "⚠ Enter an API key first.";
      resultEl.style.color = "#b80";
      return;
    }

    if (testBtn) (testBtn as any).disabled = true;

    try {
      Zotero.debug(
        `[GroundedQA] Test: provider=${provider} model=${model} url=${baseUrl}`,
      );
      // Local models (Ollama) can take >15s to load into memory on the first
      // request, so give them a generous timeout; remote APIs respond quickly.
      const timeout = provider === "ollama" ? 120000 : 15000;
      const msg =
        provider === "anthropic"
          ? await pingAnthropicAPI(apiKey, model, baseUrl, timeout)
          : await pingOpenAICompatibleAPI(apiKey, model, baseUrl, timeout);
      resultEl.textContent = `✓ ${msg}`;
      resultEl.style.color = "#080";
    } catch (e: any) {
      Zotero.debug(`[GroundedQA] Test error: ${e?.message}`);
      resultEl.textContent = `✗ ${e?.message ?? "Unknown error"}`;
      resultEl.style.color = "#c00";
    } finally {
      if (testBtn) (testBtn as any).disabled = false;
    }
  }
}

async function pingAnthropicAPI(
  apiKey: string,
  model: string,
  baseUrl: string,
  timeout: number,
): Promise<string> {
  return zoteroPing(
    `${baseUrl}/v1/messages`,
    {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    JSON.stringify({
      model,
      max_tokens: 8,
      messages: [{ role: "user", content: "hi" }],
    }),
    (data) => `Connected — model "${data.model ?? model}" OK`,
    timeout,
  );
}

async function pingOpenAICompatibleAPI(
  apiKey: string,
  model: string,
  baseUrl: string,
  timeout: number,
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return zoteroPing(
    `${baseUrl}/v1/chat/completions`,
    headers,
    JSON.stringify({
      model,
      max_tokens: 8,
      messages: [{ role: "user", content: "hi" }],
    }),
    (data) => `Connected — model "${data.model ?? model}" OK`,
    timeout,
  );
}

async function zoteroPing(
  url: string,
  headers: Record<string, string>,
  body: string,
  onSuccess: (data: any) => string,
  timeout: number,
): Promise<string> {
  let xhr: any;
  try {
    // successCodes:false → don't throw on non-2xx, don't auto-retry 5xx
    xhr = await (Zotero.HTTP as any).request("POST", url, {
      headers,
      body,
      timeout,
      successCodes: false,
    });
  } catch (e: any) {
    throw new Error(e.message ?? "Network error");
  }

  if (xhr.status === 200) {
    try {
      return onSuccess(JSON.parse(xhr.responseText));
    } catch {
      return "Connected";
    }
  }

  let message = `HTTP ${xhr.status}`;
  try {
    const err = JSON.parse(xhr.responseText);
    message = err.error?.message ?? message;
  } catch {
    /* keep default */
  }
  throw new Error(message);
}
