# 055 — Audio Codec and Timeline Adapter

**ID:** `axm.adapter.audio-codec-timeline-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Translate sample formats, channel layouts, loudness metadata, tempo maps, markers, loops, and codec containers.

## Working capabilities

- exact sample-index and timebase calculations
- visible sample-rate, channel-layout, bit-depth, and codec planning
- loss classification for channel removal and lossy targets
- descriptor-only audio timeline inspection

## Honest limitations

- Does not decode, resample, mix, or encode audio.
- Does not infer channel remapping without an explicit map.
- Codec quality is described only from caller-declared metadata.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
