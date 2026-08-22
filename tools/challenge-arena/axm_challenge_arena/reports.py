from __future__ import annotations

from typing import Any


def _score(value: Any) -> str:
    return "—" if value is None else f"{float(value):.2f}"


def render_result_markdown(state: dict[str, Any]) -> str:
    packet = state["packet"]
    result = state.get("result", {})
    merge_map = state.get("merge_map", {})
    blind_map = state.get("blind_map", {})
    lines = [
        f"# AXM Challenge Arena Result — {packet['title']}",
        "",
        f"- Challenge ID: `{state['challenge_id']}`",
        f"- State: `{state['state']}`",
        f"- Category: `{packet.get('category', 'OPEN')}`",
        f"- Locked packet hash: `{state.get('packet_hash')}`",
        f"- Locked rubric hash: `{state.get('rubric_hash')}`",
        f"- Recommendation status: **{result.get('recommendation_status', 'unknown')}**",
        f"- Provisional winner: **{result.get('provisional_winner') or 'withheld'}**",
        f"- Highest-scoring candidate: **{result.get('highest_scoring_candidate') or 'none'}**",
        f"- Confidence: **{result.get('confidence', 'unknown')}**",
        f"- Human decision required: **yes**",
        "",
        "## Goal",
        "",
        packet.get("goal", ""),
        "",
        "## Ranked candidates",
        "",
        "| Rank | Blind candidate | Eligible | Automatic score | Deterministic pass | First choices | Ranking signal |",
        "|---:|---|:---:|---:|---:|---:|---:|",
    ]
    for index, candidate in enumerate(result.get("candidates", []), start=1):
        lines.append(
            f"| {index} | {candidate['blind_label']} | {'yes' if candidate['eligible'] else 'no'} | "
            f"{_score(candidate['automatic_score'])} | {candidate['deterministic_pass_ratio'] * 100:.1f}% | "
            f"{candidate['first_choice_votes']} | {_score(candidate['ranking_score'])} |"
        )

    lines.extend(["", "## Evidence status", ""])
    gaps = result.get("evidence_gaps", [])
    if gaps:
        for gap in gaps:
            lines.append(f"- **{gap.get('code', 'EVIDENCE_GAP')}** — {gap.get('detail', '')}")
    else:
        lines.append("No material automatic-evidence gap was recorded.")
    if result.get("exact_tie_labels") and len(result.get("exact_tie_labels", [])) > 1:
        lines.append(
            f"- Exact top tie: {', '.join(result['exact_tie_labels'])}; no winner was selected lexically."
        )

    lines.extend(["", "## Criterion awards", ""])
    for award in result.get("criterion_awards", []):
        lines.append(
            f"- **{award['label']}** ({award['source']}): {', '.join(award['winners'])} at {_score(award['score'])}"
        )
    if not result.get("criterion_awards"):
        lines.append("No criterion had enough scored evidence.")

    lines.extend(["", "## Dissent preserved", ""])
    if result.get("dissent"):
        for item in result["dissent"]:
            reason = f" — {item['reason']}" if item.get("reason") else ""
            lines.append(f"- `{item['reviewer_id']}` preferred **{item['preferred']}**{reason}")
    else:
        lines.append("No active reviewer ranked another candidate first, or no peer reviews were present.")

    lines.extend(["", "## Merge map", ""])
    lines.append(f"Proposed base candidate: **{merge_map.get('base_candidate') or 'none'}**")
    for item in merge_map.get("best_by_criterion", []):
        lines.append(
            f"- {item['criterion']}: {', '.join(item['candidate_sources'])} — `{item['action']}`"
        )
    for component in merge_map.get("proposed_components", []):
        lines.append(
            f"- From **{component['candidate_source']}**: {component['component']} "
            f"(supported by {component['support_count']} review(s); proposed only)"
        )

    lines.extend(["", "## Author reveal", ""])
    reveal = packet.get("participant_policy", {}).get("reveal_authors_after_close", True)
    if reveal and state.get("state") in {"VOTING_CLOSED", "SYNTHESIZED", "FINALIZED"}:
        submissions = state.get("submissions", {})
        participants = state.get("participants", {})
        for label, submission_id in sorted(blind_map.items()):
            participant_id = submissions.get(submission_id, {}).get("participant_id")
            display = participants.get(participant_id, {}).get("display_name", participant_id)
            lines.append(f"- **{label}** → {display} (`{participant_id}`)")
    else:
        lines.append("Author identities remain hidden by policy or phase.")

    lines.extend([
        "",
        "## Decision boundary",
        "",
        "The automatic result is evidence, not authority. The human operator may accept, merge, branch, rerun, or reject every candidate.",
        "",
    ])
    return "\n".join(lines)
