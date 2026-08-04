# 067 — Application Compatibility Profile Matcher

**ID:** `axm.adapter.application-compatibility-profile-matcher`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.6.0`

## Purpose

Match an old application by hashes and file evidence to a tested compatibility profile and known refusal conditions.

## Working capabilities

- exact hash, required-file, platform, and version evidence matching
- known refusal-condition evaluation
- specificity-based ranking with ambiguity refusal
- profile provenance and tested-status visibility

## Honest limitations

- Does not launch applications, inspect files, emulate platforms, or apply compatibility settings.
- Evidence is caller-supplied and must be independently collected and verified.
- A match is a recommendation, not proof of successful execution.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
