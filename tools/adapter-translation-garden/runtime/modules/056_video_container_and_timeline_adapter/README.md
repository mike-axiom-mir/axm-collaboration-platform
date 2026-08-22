# 056 — Video Container and Timeline Adapter

**ID:** `axm.adapter.video-container-timeline-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Translate frame rates, time bases, codecs, tracks, color metadata, subtitles, edit lists, and keyframe constraints.

## Working capabilities

- exact video timebase conversion with explicit rounding policy
- container, codec, frame-rate, color, and audio-track conversion planning
- variable-to-constant-frame-rate loss visibility
- descriptor-only video timeline inspection

## Honest limitations

- Does not demux, decode, render, or encode video.
- Does not inspect real container bytes.
- Frame interpolation and cadence reconstruction are not performed.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
