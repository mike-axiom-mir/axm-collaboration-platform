# AXM interface world signals

This TEST seam lets the capability-intelligence trio notice relevant changes in official interface standards and design guidance without turning the internet into authority.

## Source classes

- `NORMATIVE_STANDARD`: broadly applicable requirements such as WCAG and WAI-ARIA.
- `LIVING_STANDARD`: current platform behavior such as native HTML forms.
- `IMPLEMENTATION_GUIDANCE`: practical patterns such as the ARIA Authoring Practices Guide.
- `ECOSYSTEM_GUIDANCE`: Apple, Material, or Fluent conventions that apply only when that ecosystem is declared.
- `RESEARCHED_PATTERN_LIBRARY`: contextual task patterns such as GOV.UK service patterns.

`sources.json` is the allowlist. `signals.json` contains short AXM-authored paraphrases and explicit applicability gates. The synchronizer never interprets arbitrary web search results and never stores full source pages.

## Refresh and review

Run the full refresh from the Workshop root:

```powershell
powershell -ExecutionPolicy Bypass -File shared/capability-intelligence/refresh-world-interface.ps1
```

The refresh:

1. fetches only allowlisted HTTPS sources;
2. hashes normalized visible text, or bounded document bytes for a declared JavaScript shell;
3. aggregates unchanged checks;
4. appends only meaningful change or availability events;
5. rebuilds the 214-module world-fit contexts and impact map.

When a source genuinely changed and a steward has reviewed its applicability, acknowledge only the source comparison baseline:

```powershell
python shared/capability-intelligence/world-interface/sync_world_interface.py --acknowledge w3c-wcag-2-2 --reviewer "Mike Tobi" --note "Reviewed the official change and routed affected modules for separate interface review."
```

This acknowledgement closes the source-digest review state only. It does not apply a design change, approve accessibility conformance, merge code, or grant CANON.
