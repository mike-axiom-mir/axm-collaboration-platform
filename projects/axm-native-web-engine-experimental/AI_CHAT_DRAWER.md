# AXM Browser AI Chat Drawer — EXPERIMENTAL

The AXM native-browser lane can expose an optional AI chat companion whenever browser AI providers are configured.

## Human interaction

The normal browser shell gains one floating **AI Chat** button.

- tap/click **AI Chat** to slide the drawer up
- tap **Down** or press Escape to collapse it
- **Alt+A** toggles the drawer when focus is not inside a text field
- **Pop out** opens the same memory-only conversation in a separate small window
- each enabled AI provider has its own thread; switching provider does not blend histories

The drawer embeds a separate loopback chat origin. The normal browser shell continues to expose only its existing `state` and `action` routes.

## Provider behavior

The chat provider list comes from the same swappable AI registry used by Browser AI / Research Mode.

Per-provider `visualStateAccess` is enforced by the existing AI planning contract:

- allowed provider: current digest-bound browser visual state may be attached
- denied provider: browser visual state is omitted

Chat does not override the AI on/off switch.

## Authority boundary

Chat history is memory-only and bounded. It grants no:

- browser navigation or Browser Session mutation
- search execution
- tool execution
- page JavaScript/Wasm execution
- file write
- install, promotion, or canon authority

AI provider execution still requires the host to be configured with `aiNetworkAuthority: 'EXPLICIT_ALLOW'`.

The main browser host remains external-network free. Provider execution occurs through the separate chat companion host. Its UI is loopback-only and may be framed only by the exact parent browser origin supplied when the chat host is created.

## Configuration

```js
const host = await LocalBrowserHost.createLocalBrowserHost(session, {
  aiRegistry,
  aiChatConfig: {
    aiNetworkAuthority: 'EXPLICIT_ALLOW',
    aiOptions: {
      allowLoopbackCompatible: true
    }
  }
});

console.log(host.receipt.shellUrl);
console.log(host.aiChatUrl);
```

`aiChat: false` disables the drawer even when AI providers are configured.

No provider credential value is stored in chat state or chat history. Secret resolution remains inside the existing explicit AI executor boundary.
