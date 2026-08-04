# AXM Text Fabric workshop integration

This capsule admits the complete AXM Text Fabric v1.0.0 release candidate as
an inspectable local Workshop tool. The original package remains under
`runtime/`; the Workshop manifest, module contract, integration map, Python
launcher, and selftest are kept at this folder's root.

## Open it

Start the Workshop and open **AXM Text Fabric** from the launcher. Its declared
entry is the original offline preset workshop:

`/tools/text-fabric/runtime/START_HERE.html`

The browser workshop has no network path. Favorites and custom presets stay in
browser local storage; copy and download require explicit user actions.

## Use the machine CLI

The Node launcher finds an explicitly configured Python runtime first, then
known local runtimes, without invoking a shell:

```powershell
npm run text-fabric -- list-presets
npm run text-fabric -- resolve-preset axm_future_core --pretty
npm run text-fabric -- stress-text "System ready {name}" --mode all --pretty
```

Commands that create bundles or assets still require an explicit output path.
Existing destinations are refused unless the source CLI's explicit `--force`
flag is present.

## Verify it

```powershell
npm run test:text-fabric
```

The selftest verifies both checksum manifests, confirms that only the four
recorded renderer and responsive-layout files differ from the upstream package,
runs the complete Python suite, checks a real resolved preset, and exercises a
negative CLI path.

The package is `TEST`, not CANON. Exact shaping, kerning, bidi paragraph
ordering, and final line breaks remain the responsibility of the target
renderer with the real project font stack.

See `integration-map.json` for the admitted capability map and ownership seams.
