# Batch 002 — interface world signals

## Outcome

The capability-intelligence trio now has a bounded external-interface context for all 214 registered Workshop modules.

- Module 1 explains which external interface checks are relevant to the selected module.
- Module 2 combines its deterministic pattern recommendation with applicable world-fit checks and links to the bound official sources.
- Module 3 reports source freshness and change state, carries the world-context digest into its signal evidence, and opens review when a relevant source changes.

External guidance remains advisory TEST material. A source change does not mean a module must change, and the tracker cannot rewrite an interface, claim conformance, execute work, merge, or grant CANON.

## Source model

The allowlist contains eight primary sources:

1. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) — normative, broadly applicable accessibility requirements.
2. [W3C WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) — normative accessible semantics.
3. [W3C ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) — implementation guidance for widget and keyboard patterns.
4. [WHATWG HTML forms](https://html.spec.whatwg.org/dev/forms.html) — living-standard native control behavior.
5. [Material Design 3](https://m3.material.io/) — contextual Material and Android guidance.
6. [Apple Human Interface Guidelines](https://developer.apple.com/design/) — contextual Apple-platform guidance.
7. [Microsoft Fluent 2 accessibility](https://fluent2.microsoft.design/accessibility) — contextual Microsoft-platform guidance.
8. [GOV.UK Design System patterns](https://design-system.service.gov.uk/patterns/) — contextual public-service task research.

Normative and universal web guidance can be admitted broadly. Material, Apple, Fluent, and GOV.UK signals are held unless a module declaration contains matching platform or domain context. The applicability adapter uses bounded context-tag matching rather than substring guessing.

## Retention and change tracking

- Full external pages are never retained.
- The tracker stores URL, publisher, source class, response metadata, bounded content size, normalized digest, and timestamps.
- Material's JavaScript shell uses an explicitly declared bounded document-byte digest because useful visible text is not present in the initial HTML response.
- Repeated unchanged checks update an aggregate counter and do not grow the append-only event history.
- Baselines, content changes, availability transitions, recovery, and explicit acknowledgements form a digest-chained JSONL history.
- A comparison-baseline acknowledgement requires a reviewer and note. It approves only the observed source comparison point, never a module change.

The first live observation retained the Material source's initial unavailable state and later recovery instead of hiding the failed attempt.

## Verification

- 8 of 8 sources are currently `TRACKED`.
- 214 of 214 registered modules have a deterministic world-fit context.
- The source-change simulation proves one changed source produces one durable event and a `REVIEW_REQUIRED` state.
- The acknowledgement simulation proves review closes only after explicit reviewer and note fields are supplied.
- The platform catalog and impact map verify their content digests.
- Module 1, Module 2, Module 3, the world-interface tracker, the platform generator, and the shared platform UI focused suites pass.
- Live desktop and 390 by 844 phone checks show the new source context without horizontal overflow; source links, state labels, held-context explanation, and closed authority are visible.

This does not prove accessibility conformance, source meaning, or human usefulness. Those remain human-review questions.

## Evidence

- `evidence/004-interface-world-signals/01-module2-world-fit.png`
- `evidence/004-interface-world-signals/02-module3-change-tracker.png`
- `evidence/004-interface-world-signals/03-module2-world-fit-phone.png`
- `shared/capability-intelligence/generated/world-interface/latest.json`
- `shared/capability-intelligence/generated/world-interface/change-events.jsonl`
- `shared/capability-intelligence/generated/world-interface/check-summary.json`
- `shared/capability-intelligence/generated/platform-usability/world-interface-impact.json`

No recurring scheduler was installed. Refresh is explicit and on demand through `shared/capability-intelligence/refresh-world-interface.ps1`; a future scheduler may call the same bounded command without changing its authority limits.
