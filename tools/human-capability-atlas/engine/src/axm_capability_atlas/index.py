from __future__ import annotations


def build_index(cards: list[dict]) -> dict:
    records = []
    by_category: dict[str, list[str]] = {}
    by_tag: dict[str, list[str]] = {}
    for card in cards:
        cid = card["capability_id"]
        source_reference = card.get("source_reference", {}) if isinstance(card.get("source_reference"), dict) else {}
        enrichment = source_reference.get("enrichment", {}) if isinstance(source_reference.get("enrichment"), dict) else {}
        registry_role = source_reference.get("registry_role", {}) if isinstance(source_reference.get("registry_role"), dict) else {}
        if not registry_role and isinstance(enrichment.get("registry_role"), dict):
            registry_role = enrichment["registry_role"]
        if registry_role:
            role_classification = registry_role.get("classification", "UNBOUND")
            human_surface = registry_role.get("human_surface", "REVIEW_HOLD")
            provider_backed = bool(registry_role.get("is_provider_backed", False))
        else:
            role_classification = "NON_PUBLIC_CAPABILITY"
            human_surface = "AXM_CAPABILITY"
            provider_backed = True
        rec = {
            "capability_id": cid,
            "human_name": card["identity"]["human_name"],
            "machine_name": card["identity"]["machine_name"],
            "summary": card["purpose"]["plain_explanation"],
            "categories": card["identity"]["category"],
            "tags": card["identity"]["tags"],
            "risk_level": card["risk_profile"]["risk_level"],
            "maturity": card["maturity_profile"]["maturity"],
            "skill_level": card["learning_profile"]["minimum_skill_level"],
            "unknown_count": len(card.get("knowledge", {}).get("unknowns", [])),
            "conflict_count": len(card.get("knowledge", {}).get("conflicts", [])),
            "registry_role": role_classification,
            "human_surface": human_surface,
            "provider_backed": provider_backed,
        }
        records.append(rec)
        for category in rec["categories"]:
            by_category.setdefault(category, []).append(cid)
        for tag in rec["tags"]:
            by_tag.setdefault(tag, []).append(cid)
    return {
        "contract_version": cards[0]["contract_version"] if cards else "0.1.0",
        "capability_count": len(records),
        "records": sorted(records, key=lambda r: r["human_name"].lower()),
        "by_category": by_category,
        "by_tag": by_tag,
    }
