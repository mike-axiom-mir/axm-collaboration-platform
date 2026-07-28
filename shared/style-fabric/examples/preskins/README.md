# Built-in preskins

This folder contains the 25 portable, precompiled `.axmskin.json` editions of
the editable preskins shown in the Style Fabric studio.

Every file:

- compiles from the same deterministic structured intent used by the UI;
- declares a built-in preskin source in provenance;
- is presentation-only;
- permits remixing under the included test license declaration;
- carries a SHA-256 integrity receipt;
- remains WORKING / TEST and non-canon.

Use `npm run preskins:build` to rebuild the files from the source catalog.
The machine-readable index is `preskin-catalog.json` at the package root.
