# Migration from v5 to v6

v6 preserves v5’s production and authoring layers and adds optional Storycraft modules. A v5 platform does not need to enable them immediately.

## Safe route

1. Preserve the platform and its v5 preference data.
2. Verify the packaged v5 rollback hash before replacing files.
3. Replace matching core files and run the original 178 + 70 tests.
4. Add `axm-storycraft.css` and Focus Director only.
5. Verify focus preview, approval, target non-mutation, and cleanup.
6. Add Journey Director with autoplay disabled.
7. Register only reviewed, code-free journeys.
8. Add Capture Studio last; test enter/exit while the platform changes a theme or attribute after entry.
9. Run the Storycraft suite and the platform’s own desktop/mobile/accessibility tests.

## Persistence

v6 uses v6-only preference and preset namespaces. v5 data is not silently imported or overwritten.

## Rollback

Destroy Storycraft modules in reverse order: Journey Director, Capture Studio, Focus Director. Restore the complete v5 package rather than mixing v5 and v6 files. The byte-identical checkpoint is `rollback/AXM_AETHERGLASS_VISUAL_ENGINE_v5_0_0_STABLE.zip`.
