from __future__ import annotations


def _lines(items: list[str], fallback: str = "None verified.") -> str:
    return "\n".join(f"- {item}" for item in items) if items else f"- {fallback}"


def _dict(value):
    return dict(value) if isinstance(value, dict) else {}


def _list(value):
    return value if isinstance(value, list) else []


def _enrichment(card: dict) -> dict:
    return _dict(_dict(card.get("source_reference")).get("enrichment"))


def _registry_role(card: dict) -> dict:
    source = _dict(card.get("source_reference"))
    direct = _dict(source.get("registry_role"))
    if direct:
        return direct
    return _dict(_enrichment(card).get("registry_role"))


def _role_label(card: dict) -> str:
    role = str(_registry_role(card).get("classification", "UNCLASSIFIED"))
    return {
        "PROVIDED_ONLY": "AXM-provided capability",
        "PROVIDED_AND_CONSUMED": "AXM-provided capability + consumed interface/dependency",
        "CONSUMER_ONLY_DEPENDENCY": "Consumed dependency/reference — not an AXM-provided ability",
        "UNBOUND": "Unbound registry identifier — review required",
    }.get(role, role)


def _humanization_seed(card: dict) -> dict:
    return _dict(_enrichment(card).get("humanization_seed"))


def _proof_ceiling(card: dict) -> dict:
    source = _dict(card.get("source_reference"))
    direct = _dict(source.get("proof_ceiling"))
    if direct:
        return direct
    return _dict(_enrichment(card).get("proof_ceiling"))


def _module_label(item: dict) -> str:
    module = _dict(item.get("module"))
    manifest = _dict(item.get("manifest"))
    name = str(module.get("name") or manifest.get("name") or item.get("module_id") or "unknown module")
    status = str(module.get("status") or item.get("registry_status") or "unknown")
    return f"{name} [{item.get('module_id', 'unknown')}] — {item.get('join_status', 'UNKNOWN')} / {status}"


def _provider_summary(card: dict) -> str:
    enrichment = _enrichment(card)
    providers = [item for item in _list(enrichment.get("providers")) if isinstance(item, dict)]
    consumers = [item for item in _list(enrichment.get("consumers")) if isinstance(item, dict)]
    parts = []
    if providers:
        parts.append("Providers: " + "; ".join(_module_label(item) for item in providers))
    if consumers:
        parts.append("Consumers: " + "; ".join(_module_label(item) for item in consumers))
    if not parts:
        return "No verified provider/module context is attached."
    return " | ".join(parts)


def quick_view(card: dict) -> str:
    risk = card["risk_profile"]["risk_level"]
    maturity = card["maturity_profile"]["maturity"]
    example = card["purpose"]["example_uses"][0] if card["purpose"]["example_uses"] else "No verified example is recorded."
    enrichment = _enrichment(card)
    role_line = f"\n**Registry role:** {_role_label(card)}\n" if _registry_role(card) else ""
    context_line = f"\n**Module context:** {_provider_summary(card)}\n" if enrichment else ""
    proof = _proof_ceiling(card)
    proof_line = (
        "\n**Proof ceiling:** declaration/registry consistency is not runtime proof, usability proof, or human approval.\n"
        if proof and proof.get("declaration_is_runtime_proof") is False
        else ""
    )
    return f"""# {card['identity']['human_name']}

{card['purpose']['plain_explanation']}
{role_line}{context_line}{proof_line}
**Why it matters:** {card['purpose']['why_it_matters']}

**Example:** {example}

**Risk:** {risk}

**Maturity:** {maturity}
"""


def practical_view(card: dict) -> str:
    enrichment = _enrichment(card)
    provider_lines = []
    context_details = []
    for item in [x for x in _list(enrichment.get("providers")) if isinstance(x, dict)]:
        provider_lines.append(_module_label(item))
        manifest = _dict(item.get("manifest"))
        contract = _dict(item.get("contract"))
        summary = str(manifest.get("summary", "") or "")
        if summary:
            context_details.append(f"{item.get('module_id')}: {summary}")
        accepts = _list(manifest.get("accepts")) or _list(_dict(contract.get("handoffs")).get("accepts"))
        produces = _list(manifest.get("produces")) or _list(_dict(contract.get("handoffs")).get("emits"))
        if accepts:
            context_details.append(f"{item.get('module_id')} module accepts: {', '.join(map(str, accepts))}")
        if produces:
            context_details.append(f"{item.get('module_id')} module produces/emits: {', '.join(map(str, produces))}")
    context_section = ""
    if enrichment:
        seed = _humanization_seed(card)
        orientation = str(seed.get("orientation", "") or "")
        action_candidates = [
            f"{item.get('module_id')}: {item.get('action')} (context score {item.get('score')})"
            for item in _list(seed.get("action_candidates"))
            if isinstance(item, dict)
        ]
        context_section = f"""
## Registry role

{_role_label(card)}

{orientation}

## Provider/module context

Enrichment status: {enrichment.get('status', 'UNKNOWN')}

{_lines(provider_lines, 'No provider module is declared for this capability.')}

### Context preserved from provider contracts/manifests

{_lines(context_details, 'No additional provider contract context was verified.')}

### Deterministic humanization candidates

{_lines(action_candidates, 'No provider action has enough lexical overlap to use even as a wording candidate.')}

> These are context candidates only. Provider-wide accepts, outputs, actions, and risk are not silently promoted to capability-specific facts.
"""
    return f"""# {card['identity']['human_name']} — Practical View

## What it does

{card['purpose']['plain_explanation']}

## Why use it

{card['purpose']['why_it_matters']}
{context_section}

## Required inputs

{_lines(card['input_profile']['required_inputs'])}

## Expected outputs

{_lines(card['output_profile']['expected_outputs'])}

## Beginner-safe operations

{_lines(card['learning_profile']['beginner_safe_operations'])}

## Common mistakes

{_lines(card['learning_profile']['common_mistakes'])}

## Limitations

{_lines(card['maturity_profile']['known_limitations'])}

## Safety and recovery

- Risk level: {card['risk_profile']['risk_level']}
- Reversibility: {card['risk_profile']['reversibility']}
- Human confirmation required: {card['risk_profile']['human_confirmation_required']}
- Safe preview recommended: {card['risk_profile']['safe_preview_recommended']}
"""


def deep_view(card: dict) -> str:
    conflicts = card.get('knowledge', {}).get('conflicts', [])
    conflict_text = _lines([f"{c['field']}: declared={c['declared']!r}, observed={c['observed']!r}" for c in conflicts])
    unknowns = _lines(card.get('knowledge', {}).get('unknowns', []))
    enrichment = _enrichment(card)
    contexts = []
    for role in ("providers", "consumers"):
        for item in [x for x in _list(enrichment.get(role)) if isinstance(x, dict)]:
            module = _dict(item.get("module"))
            manifest = _dict(item.get("manifest"))
            contract = _dict(item.get("contract"))
            boundary = _dict(contract.get("boundaries"))
            contexts.append(
                f"{item.get('role', role[:-1])}: {item.get('module_id')} | "
                f"join={item.get('join_status')} | module_status={module.get('status', 'unknown')} | "
                f"manifest={manifest.get('relative_path', 'none')} | contract={contract.get('relative_path', 'none')} | "
                f"refuses={', '.join(map(str, _list(boundary.get('refuses')))) or 'none declared'}"
            )
    enrichment_section = ""
    if enrichment:
        seed = _humanization_seed(card)
        proof = _proof_ceiling(card)
        action_candidates = [
            f"{item.get('module_id')}: {item.get('action')} | score={item.get('score')} | claim={item.get('claim_status')}"
            for item in _list(seed.get("action_candidates"))
            if isinstance(item, dict)
        ]
        enrichment_section = f"""
## Registry role

- Classification: {_registry_role(card).get('classification', 'UNCLASSIFIED')}
- Human surface: {_registry_role(card).get('human_surface', 'UNKNOWN')}
- Human label: {_role_label(card)}

## Provider / consumer enrichment

- Status: {enrichment.get('status', 'UNKNOWN')}
- Catalog hash: {enrichment.get('catalog_hash', '')}
- Enrichment source seal: {enrichment.get('source_seal_hash', '')}
- Enrichment hash: {enrichment.get('enrichment_hash', '')}

{_lines(contexts, 'No provider/consumer module relation is declared.')}

## Proof ceiling

- Declaration is runtime proof: {proof.get('declaration_is_runtime_proof', 'UNKNOWN')}
- Self-test is human approval: {proof.get('selftest_is_human_approval', 'UNKNOWN')}
- Automatic promotion: {proof.get('automatic_promotion', 'UNKNOWN')}
- Canon requires human Merge Gate: {proof.get('canon_requires_human_merge_gate', 'UNKNOWN')}
- Discovery structure proves: {', '.join(map(str, _list(proof.get('discovery_structure_proves')))) or 'none'}
- Discovery structure does not prove: {', '.join(map(str, _list(proof.get('discovery_structure_does_not_prove')))) or 'none'}

## Humanization seed

{seed.get('orientation', '')}

{_lines(action_candidates, 'No action-level wording candidate was derived.')}

This context is deterministic source evidence. Module-wide properties and humanization candidates are not treated as capability-specific KNOWN facts unless a capability-specific declaration exists.
"""
    return f"""# {card['identity']['human_name']} — Deep View

## Identity

- Capability ID: {card['capability_id']}
- Revision: {card['capability_revision']}
- Machine name: {card['identity']['machine_name']}
- Contract: {card['contract_version']}

## Source

- Type: {card['source_reference']['source_type']}
- Location: {card['source_reference']['source_location']}
- SHA-256: {card['source_reference']['source_hash']}
- Confidence: {card['source_reference']['confidence']}
- Last verified: {card['source_reference']['last_verified_at']}
{enrichment_section}

## Technical profile

- Input types: {', '.join(card['input_profile']['input_types']) or 'unknown'}
- Output types: {', '.join(card['output_profile']['output_types']) or 'unknown'}
- Precision: {card['interaction_profile']['precision_requirement']}
- Feedback: {card['interaction_profile']['feedback_requirement']}
- Compute cost: {card['cost_profile']['compute_cost']}
- Skill cost: {card['cost_profile']['skill_cost']}
- Proof status: {card['maturity_profile']['proof_status']}

## Dependencies

{_lines(card['relationships']['dependency_capability_ids'])}

## Failure modes

{_lines(card['risk_profile']['failure_modes'])}

## Unknown fields

{unknowns}

## Conflicts

{conflict_text}
"""
