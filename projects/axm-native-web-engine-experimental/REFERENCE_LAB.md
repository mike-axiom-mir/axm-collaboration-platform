# AXM Browser Reference Lab — EXPERIMENTAL

Reference Lab is an optional companion surface for the AXM native browser experiment. It reuses the browser's existing digest-bound visual-state packet rather than requiring an unrelated screenshot/browser-observation skill.

## What it adds

- current AXM browser visual state can be supplied to an AI only when that provider has `visualStateAccess: true`
- a user-selected query, image, PDF, or safe UTF-8 text document can be supplied only when that provider has `referenceAccess: true`
- visual access and reference access are separate permissions
- image search uses provider-neutral AXM contracts with SearXNG Images and Brave Image Search adapters
- a plain query goes directly to search without spending an AI request
- an image or PDF can be described by a compatible model into a bounded search query; that description is recorded as an **untrusted interpretation**, separately from search evidence
- image-search results are normalized metadata only; result image bytes are not fetched automatically and result URLs do not become browser-navigation authority

## AI adapters

The AXM provider registry currently has wire adapters for:

- `openai-responses`
- `anthropic-messages`
- `openai-compatible-chat` — for compatible local or hosted endpoints such as LM Studio/vLLM-style servers; image support must be explicitly declared with `supportsImages: true`
- `gemini-generate-content`
- `ollama-chat` — loopback `/api/chat` only

This is provider-neutral at the AXM contract layer. It is not a claim that every proprietary model API uses the same wire protocol.

Example descriptors:

```js
const registry = Ai.createRegistry([
  {
    id: 'local-ollama',
    label: 'Local Vision',
    adapter: 'ollama-chat',
    model: 'your-vision-model',
    enabled: true,
    visualStateAccess: true,
    referenceAccess: true
  },
  {
    id: 'openai-cloud',
    label: 'OpenAI',
    adapter: 'openai-responses',
    model: 'your-configured-model',
    enabled: false,
    visualStateAccess: false,
    referenceAccess: false
  },
  {
    id: 'gemini-cloud',
    label: 'Gemini',
    adapter: 'gemini-generate-content',
    model: 'your-configured-model',
    enabled: false,
    visualStateAccess: false,
    referenceAccess: false
  }
], { mode: 'single' });
```

No secret value belongs in the registry. Cloud adapters keep only environment-variable references in plans and materialize the actual secret at the explicit executor boundary.

## Enabling the companion browser surface

```js
const host = await LocalBrowserHost.createLocalBrowserHost(session, {
  aiRegistry: registry,
  referenceLab: true
});

console.log(host.receipt.shellUrl); // normal AXM local browser shell
console.log(host.referenceLabUrl);  // optional Reference Lab shell
```

A configured search/reference run remains separately gated:

```js
const host = await LocalBrowserHost.createLocalBrowserHost(session, {
  aiRegistry: registry,
  referenceConfig: {
    aiNetworkAuthority: 'EXPLICIT_ALLOW',
    searchNetworkAuthority: 'EXPLICIT_ALLOW',
    imageSearchConfig: {
      searxng: { endpoint: 'http://127.0.0.1:8888/search' }
    },
    imageSearchOptions: {
      allowedSearxngEndpoints: ['http://127.0.0.1:8888/search']
    },
    aiOptions: {
      allowLoopbackOllama: true
    }
  }
});
```

The UI cannot invent those executor authorities. The host must be configured deliberately.

## Supported reference intake

Current bounded intake accepts:

- PNG
- JPEG
- WebP
- GIF
- PDF
- UTF-8 plain text
- Markdown
- HTML as inert UTF-8 text
- JSON as inert UTF-8 text

The current file ceiling is 8 MiB. Unsupported binary document formats such as DOCX fail closed for now; a later extractor can add them without giving uploaded document code execution authority.

## Held boundaries

Reference Lab is still experimental. It does **not** grant:

- automatic network access
- automatic provider execution
- uploaded code/document execution
- arbitrary browser navigation from search results
- automatic image/thumbnail fetching
- installation, promotion, or canon authority

The first implementation is a sibling loopback surface bound to the same browser session and visual-state control plane. Folding the UI into the main browser chrome is deliberately held until this contract and security boundary have passed the independent branch verification.
