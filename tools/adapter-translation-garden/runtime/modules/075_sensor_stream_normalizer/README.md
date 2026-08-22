# 075 — Sensor Stream Normalizer

**ID:** `axm.adapter.sensor-stream-normalizer`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `read_only_observation_normalizer`  
**Version:** `0.6.0`

## Purpose

Normalize camera, microphone, motion, location, touch, environmental, and custom sensor samples into timestamped typed envelopes.

## Working capabilities

- typed camera, microphone, motion, location, touch, environmental, and custom sample envelopes
- sequence, timestamp, unit, coordinate-frame, quality, and source provenance preservation
- sensitive-sensor consent-scope checks
- monotonic sequence and timestamp-order diagnostics

## Honest limitations

- Does not capture, open, calibrate, or control sensors.
- Timestamps, units, calibration, and quality are caller-supplied.
- Payload transformation is structural only; media bytes are not decoded.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
