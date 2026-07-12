# AI Task & Talk Room

A local-only, supervised scheduler for Nova and Gemini Local.

## Task lane

- Queue a task now or schedule it for a local date and time.
- Select Nova, Gemini Local, or both.
- Start the dispatcher explicitly, or opt into persistent auto-resume whenever the module opens. Stop switches persistent resume off again.
- The scheduler sleeps when nothing is due and wakes when a task reaches its time.
- Each task chooses its finish rule. **Auto-complete on response** marks a response task complete when the assigned model delivers output. **Hold for review** waits for Mike before completion.

## Talk lane

- Send a manual message to either identity or both.
- Optional auto-talk alternates Nova and Gemini Local for a visible, finite turn budget, with its own persistent auto-resume opt-in.
- Every automatic prompt is shown in the feed.

The module cannot yet write code or files and does not promote conversation into identity wisdom. A task marked complete means its requested model output was delivered, not that an external action was secretly performed. It only stores task records, results, settings, and conversation history in its browser-local namespace.
