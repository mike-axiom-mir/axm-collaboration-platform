# AXM SEMANTIC THEME SPECIFICATION — package schema 0.2 / runtime v0.6

A theme is a governed material and signal contract shared by renderers and exports. It is not merely a loose palette name.

## Package-theme fields

- stable ID and human name;
- build status and public scope;
- material language;
- primary/secondary surfaces and panel material;
- text, muted text, two accents, warning, success, line, and shadow;
- glow RGB, paper noise, glass strength, and contrast target;
- motion character and low-power fallback;
- compatible renderer scope where applicable.

Each mold declares accepted themes. Validation fails unknown or incompatible references. Theme CSS and Theme Book exports use the same semantic contract.

## Protected and local themes

The six package themes are protected. User-created themes live in the separate local Theme Foundry registry and use an explicit quarantine, approval, and activation lifecycle.

A local theme is declarative data only. Executable code, arbitrary shader code, remote assets, URLs, and font files are rejected.

`public-calm` is explicitly public-safe. Experimental or quarantined themes are never silently promoted.
