# Asset Sensory Workbench evidence route

Status: **TEST**

This receipt covers the standalone leaf workbench. It does not claim that the
open-ended AXM asset factory, all sensory modalities, or aesthetic quality are
complete.

```text
asset_hand_input_is_exact:
claim: the workbench accepts only the deterministic-animation-fabric v1.1.0 candidate result with READY, validation PASS, candidate-only authority and a schema-consistent editable composition
kind: contract and authorization boundary
risk: high
pass_condition: valid generated result is accepted; metadata/parsed schema disagreement is refused
primary_surface: tools/asset-sensory-workbench/selftest.js
counterevidence: wrong hand/version/status/authority accepted, or schema disagreement accepted
observed_evidence: PASS; real eight-artifact result accepted and corrupted schema bridge refused
verdict: PASS
named_seam: the workbench is not registered or installed merely because the result is accepted

machine_and_human_edits_share_truth:
claim: a human control and a machine API call create the same bounded digest-lineage edit form
kind: deterministic behavior
risk: high
pass_condition: allowlisted edits record previous value, actor/channel, parent digest and changed result digest; unknown/out-of-range fields fail closed
primary_surface: tools/asset-sensory-workbench/selftest.js
counterevidence: silent field coercion, unallowlisted mutation, missing parent digest or unchanged digest after a real edit
observed_evidence: PASS
verdict: PASS
named_seam: the current allowlist is intentionally small; unknown fields remain MISSING_EDIT_CAPABILITY

edited_composition_regenerates_the_derived_set:
claim: editing the canonical composition routes through the public Asset Hand and replaces bake, CSS, atlas, manifest, filmstrip and technical verification artifacts
kind: integration behavior
risk: high
pass_condition: edited result is READY/PASS, composition and bake digests change, seven derived artifacts are rebound, and regenerated composition equals the draft digest
primary_surface: Node selftest and live browser control edit
counterevidence: stale derived artifact, old receipt retained, HOLD, FAIL or regenerated-source mismatch
observed_evidence: PASS; live horizontal amplitude 15.36 -> 30 changed result 2363cefc -> a02079c7, composition fnv1a32:33e024b7 -> fnv1a32:45d0f669 and bake fnv1a32:b2881c42 -> fnv1a32:13b3bf7a; seven derived artifacts reported
verdict: PASS
named_seam: final media encoding and engine-adapter parity are not claimed

live_motion_is_visibly_present:
claim: at the default desktop viewport, the bounded player visibly changes position, scale and rotation while Play is active
kind: visual appearance and motion
risk: medium
pass_condition: two separated frames show different transform and exact tick/sample readouts
primary_surface: in-app browser repeated screenshots plus DOM state
counterevidence: frozen asset, blank stage, unchanged transform, runtime error or static-filmstrip substitution
observed_evidence: PASS; tick 17323 showed translate(346.93055 207.659559), scale 0.938054, rotation 4.303025; a later frame at tick 22573 showed translate(304.161545 163.666665), scale 1.041946, rotation -2.705657
verdict: PASS for visible movement
named_seam: screenshot cadence cannot prove requested FPS or dropped-frame behavior

pause_freezes_the_player:
claim: activating Pause stops tick and visible transform changes
kind: interaction journey
risk: medium
pass_condition: Play label replaces Pause and two separated observations remain identical
primary_surface: in-app browser click plus repeated DOM observation
counterevidence: tick or transform changes after pause
observed_evidence: PASS; tick 8738 and transform translate(313.06934 178.060434) rotate(-1.18447) scale(0.993014) remained identical across the settled interval
verdict: PASS
named_seam: background-tab and interruption recovery remain unobserved

reduced_motion_is_viewer_only:
claim: reduced motion disables transform motion and automatic playback without changing composition or bake digests
kind: accessibility adaptation and contract boundary
risk: high
pass_condition: label becomes REDUCED MOTION · STATIC, transform becomes origin/static, play is disabled, and source/bake digests remain unchanged
primary_surface: in-app browser checkbox, repeated DOM observation and core selftest
counterevidence: source digest changes, hidden motion continues or Play remains misleadingly active
observed_evidence: PASS; transform settled at translate(320 180) rotate(0) scale(1), composition and bake digests were unchanged, and final Play control was disabled
verdict: PASS for the declared viewer strategy
named_seam: vestibular safety and alternate-motion artistic quality remain human/accessibility evidence gaps

high_contrast_is_viewer_only:
claim: high contrast changes presented colours without changing the deterministic composition
kind: visual adaptation
risk: medium
pass_condition: stage/fill/stroke visibly change to the declared contrast palette while the composition digest stays fixed
primary_surface: in-app browser checkbox, DOM styles and screenshot
counterevidence: no visible colour change or source digest mutation
observed_evidence: PASS; background changed to black, fill to rgb(255,223,94), stroke to white; composition stayed fnv1a32:45d0f669
verdict: PASS
named_seam: this is not WCAG or assistive-technology conformance

human_receipt_is_digest_and_viewer_bound:
claim: a human can record a non-promoting receipt for the exact draft/viewer state, and any later source or viewer change invalidates it
kind: human evidence and persistence boundary
risk: high
pass_condition: receipt download becomes enabled after review, state names exact draft digest and no promotion; source or viewer mutation disables the receipt and clears its state
primary_surface: core selftest and live browser review/edit/adaptation journeys
counterevidence: stale receipt remains downloadable after a digest/viewer change, or authority becomes installed/promoted/canonical
observed_evidence: PASS; REVISE bound to fnv1a32:45d0f669, then a colour edit changed composition to fnv1a32:c4ced080 and disabled the stale receipt; fresh viewer change produced the same invalidation without changing composition; core selftest preserves the prior judgment in stale review history bound by viewer_state_digest
verdict: PASS
named_seam: the test observation was not Mike Tobi's aesthetic acceptance

mobile_layout_remains_reachable:
claim: at 390x844 the player and editing controls remain within the horizontal viewport and are reachable by vertical scroll
kind: responsive visual layout
risk: medium
pass_condition: no document horizontal overflow; stage, transport and edit slider render inside viewport width
primary_surface: in-app browser viewport override, screenshots and bounding rectangles
counterevidence: clipping, horizontal page scroll, zero-size controls or unreachable editor
observed_evidence: PASS; document width 375 within 390 viewport; horizontal slider rectangle x=35.6..343.6 and width=308 after scroll
verdict: PASS for this viewport
named_seam: phone touch ergonomics and multiple devices remain untested

runtime_is_clean_after_final_reload:
claim: the corrected workbench initializes without browser runtime warnings or errors
kind: runtime behavior
risk: medium
pass_condition: fresh tab reports READY + PASS and empty warning/error log
primary_surface: fresh in-app browser tab
counterevidence: body error flag, loading placeholders, console warning or error
observed_evidence: PASS; final fresh tab had no body error and no warning/error entries
verdict: PASS
named_seam: earlier target-canvas refusals were preserved as development counterevidence, then corrected

wall_clock_frame_pacing_is_verified:
claim: requested FPS, dropped/late frames, loop seam and background behavior match the declared timing
kind: motion timing and performance
risk: high
pass_condition: bounded timestamped capture measures requested versus observed cadence and interruptions
primary_surface: visual.capture.ephemeral-rolling-buffer/v1 plus runtime frame telemetry
counterevidence: missed frames, unstable interval, loop discontinuity or missing capture capability
observed_evidence: the current browser exposes screenshots but no rolling-buffer capability
verdict: UNKNOWN
named_seam: MISSING visual.capture.ephemeral-rolling-buffer/v1

assistive_technology_and_aesthetic_quality_are_proven:
claim: the workbench and candidate are accessible, comfortable, tasteful and fit their intended use
kind: accessibility, taste and meaning
risk: high
pass_condition: representative assistive-technology journeys and explicit human review against named criteria
primary_surface: real users / appointed human steward
counterevidence: screen-reader, keyboard, motion-safety, perception or intended-use failure
observed_evidence: semantic structure, keyboard playback, contrast, zoom and reduced-motion controls were observed; no screen-reader journey or Mike Tobi aesthetic decision occurred
verdict: UNKNOWN
named_seam: technical or visual checks cannot occupy the human judgment seat
```

Visual backend: `BROWSER_PRIMARY`. Rolling buffer: unavailable. Repeated
screenshots and small typed observations were used instead. No raw video or
temporary capture path was created or retained; cleanup is complete.
