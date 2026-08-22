from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .arena import ChallengeArena
from .presets import generic_packet


def run_demo(root: str | Path, *, reset: bool = True) -> dict[str, Any]:
    root = Path(root).expanduser().resolve()
    arena = ChallengeArena(root)
    challenge_id = "arena-demo-001"
    if arena.store.exists(challenge_id):
        if not reset:
            return arena.get(challenge_id)
        arena.store.delete_challenge(challenge_id)

    packet = generic_packet(
        challenge_id,
        "Build the smallest useful AXM handoff organ",
        "Create a beginner-readable, local-first handoff artifact that another AXM module can inspect without silently changing the source.",
        source_module="demo",
        source_job_id="demo-job-001",
    )
    packet["constraints"] = [
        "No network dependency",
        "Preserve the source text unchanged",
        "Return an explicit receipt",
    ]
    arena.create_challenge(packet, actor="Mike/demo")

    participants = {
        "axiom-ai": "Axiom AI",
        "mir-ai": "Mir AI",
        "wildcard-ai": "Wildcard AI",
    }
    for participant_id, display_name in participants.items():
        arena.register_participant(
            challenge_id,
            participant_id,
            display_name=display_name,
            capabilities=["text", "architecture", "local-first"],
            actor="Mike/demo",
        )
    arena.lock_challenge(challenge_id, actor="Mike/demo")
    locked = arena.get(challenge_id)
    submission_ack = {
        "challenge_id": challenge_id,
        "packet_hash": locked["packet_hash"],
        "rubric_hash": locked["rubric_hash"],
    }

    source_root = root / "demo-sources"
    source_root.mkdir(parents=True, exist_ok=True)
    contents = {
        "axiom-ai": "AXM HANDOFF RECEIPT\nVerify hash. Preserve source. Record destination. Refuse silent overwrite.\n",
        "mir-ai": "AXM HANDOFF RECEIPT\nPreserve the source and its meaning. Verify the hash, ask before replacement, and return a readable receipt.\n",
        "wildcard-ai": "AXM HANDOFF RECEIPT\nPut the source in a sealed branch capsule, verify its hash, and return a trail another tool can replay.\n",
    }
    for participant_id, text in contents.items():
        folder = source_root / participant_id
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "solution.txt").write_text(text, encoding="utf-8")
        manifest = {
            **submission_ack,
            "participant_id": participant_id,
            "summary": "A tiny deterministic handoff receipt concept.",
            "artifacts": [
                {
                    "path": "solution.txt",
                    "deliverable_id": "primary",
                    "role": "primary",
                    "media_type": "text/plain",
                    "provenance": {
                        "origin": "created locally for the AXM Challenge Arena demo",
                        "rights": "CC0-1.0",
                        "source_refs": [],
                    },
                }
            ],
            "claims": {"local_first": True, "silent_overwrite": False},
        }
        arena.submit(challenge_id, participant_id, folder, manifest)

    arena.close_submissions(challenge_id, actor="Mike/demo")
    arena.run_deterministic_checks(challenge_id)
    arena.open_review(challenge_id, actor="Mike/demo")

    state = arena.get(challenge_id)
    label_to_participant = {
        label: state["submissions"][submission_id]["participant_id"]
        for label, submission_id in state["blind_map"].items()
    }
    base_quality = {"axiom-ai": 84, "mir-ai": 92, "wildcard-ai": 79}
    merge_ideas = {
        "axiom-ai": "Keep the explicit refusal of silent overwrite.",
        "mir-ai": "Keep the readable consent step before replacement.",
        "wildcard-ai": "Keep the replayable branch-capsule trail.",
    }
    for reviewer_id in participants:
        packet_for_reviewer = arena.review_packet(challenge_id, reviewer_id)
        evaluations = {}
        for label in packet_for_reviewer["candidate_labels"]:
            author = label_to_participant[label]
            base = base_quality[author]
            scores = {
                "goal_fidelity": min(100, base + 2),
                "quality": base,
                "originality": min(100, base + (8 if author == "wildcard-ai" else 1)),
                "integration": min(100, base + (5 if author == "axiom-ai" else 2)),
            }
            evaluations[label] = {
                "scores": scores,
                "evidence_refs": {
                    criterion_id: [
                        {
                            "kind": "artifact",
                            "path": "solution.txt",
                            "note": f"The score for {criterion_id} was grounded in the declared primary artifact.",
                        }
                    ]
                    for criterion_id in scores
                },
                "strengths": [f"Strong {author} interpretation of the handoff boundary."],
                "weaknesses": ["Needs a full machine-readable schema before production use."],
                "risks": ["A receipt alone cannot provide a security sandbox."],
                "merge_worthy": [merge_ideas[author]],
            }
        ranking = sorted(
            packet_for_reviewer["candidate_labels"],
            key=lambda label: base_quality[label_to_participant[label]],
            reverse=True,
        )
        review = {
            "schema_version": "axm.challenge-review/0.4",
            "rubric_hash": packet_for_reviewer["rubric_hash"],
            "assignment_hash": packet_for_reviewer["assignment_hash"],
            "review_packet_hash": packet_for_reviewer["review_packet_hash"],
            "evaluations": evaluations,
            "ranking_tiers": [[label] for label in ranking],
            "ranking": ranking,
            "overall_reason": "Ranked by locked goal fidelity and integration value; unusual ideas were preserved in the merge map.",
        }
        arena.submit_review(challenge_id, reviewer_id, review)

    arena.close_voting(challenge_id, actor="Mike/demo")
    arena.synthesize(challenge_id)
    return arena.get(challenge_id)
