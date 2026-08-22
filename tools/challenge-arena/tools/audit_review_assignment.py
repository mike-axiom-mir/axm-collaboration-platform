from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path
from collections import deque
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from axm_challenge_arena.review_assignment import build_review_assignments


def _independent_max_flow(
    reviewers: list[str],
    labels: list[str],
    own_label: dict[str, str | None],
    cap: int,
    target: int,
) -> int:
    """Small independent Edmonds-Karp oracle used only by this audit tool."""

    nodes = ["source"]
    nodes.extend(f"reviewer:{reviewer}" for reviewer in reviewers)
    nodes.extend(f"candidate:{label}" for label in labels)
    nodes.append("sink")
    index = {node: offset for offset, node in enumerate(nodes)}
    capacity = [[0] * len(nodes) for _ in nodes]
    source = index["source"]
    sink = index["sink"]
    for reviewer in reviewers:
        reviewer_node = index[f"reviewer:{reviewer}"]
        capacity[source][reviewer_node] = cap
        for label in labels:
            if own_label.get(reviewer) != label:
                capacity[reviewer_node][index[f"candidate:{label}"]] = 1
    for label in labels:
        capacity[index[f"candidate:{label}"]][sink] = target

    flow = 0
    while True:
        parent = [-1] * len(nodes)
        parent[source] = source
        queue: deque[int] = deque([source])
        while queue and parent[sink] < 0:
            node = queue.popleft()
            for neighbor, available in enumerate(capacity[node]):
                if available > 0 and parent[neighbor] < 0:
                    parent[neighbor] = node
                    queue.append(neighbor)
        if parent[sink] < 0:
            break
        node = sink
        while node != source:
            previous = parent[node]
            capacity[previous][node] -= 1
            capacity[node][previous] += 1
            node = previous
        flow += 1
    return flow


def run_audit(*, cases: int, seed: int) -> dict[str, Any]:
    rng = random.Random(seed)
    for case_index in range(cases):
        reviewer_count = rng.randint(1, 8)
        candidate_count = rng.randint(1, 8)
        reviewers = [f"reviewer-{index}" for index in range(reviewer_count)]
        labels = [f"Candidate-{index:02d}" for index in range(candidate_count)]
        own_label = {
            reviewer: rng.choice([None, *labels]) for reviewer in reviewers
        }
        requested_cap = rng.randint(0, max(1, candidate_count))
        target = rng.randint(0, min(4, reviewer_count + 1))
        state = {
            "packet": {
                "participant_policy": {
                    "review_assignment_mode": "balanced",
                    "reviews_per_reviewer": requested_cap,
                    "minimum_peer_reviews_per_candidate": target,
                    "allow_self_vote": False,
                },
                "rubric": ([{"id": "quality", "source": "peer"}] if target else []),
            },
            "packet_hash": "a" * 64,
            "rubric_hash": "b" * 64,
            "blind_map": {
                label: f"submission-{label}" for label in labels
            },
            "participant_active_submission": {
                reviewer: (
                    f"submission-{own_label[reviewer]}"
                    if own_label[reviewer] is not None
                    else None
                )
                for reviewer in reviewers
            },
            "participants": {
                reviewer: {
                    "can_review": True,
                    "review_required": rng.choice([True, False]),
                }
                for reviewer in reviewers
            },
        }
        report = build_review_assignments(state)
        effective_cap = int(report["effective_reviews_per_reviewer_cap"] or 0)
        expected = _independent_max_flow(
            reviewers,
            labels,
            own_label,
            effective_cap,
            int(report["candidate_target"]),
        )
        actual = int(report["achieved_candidate_target_assignments"])
        if actual != expected:
            raise AssertionError(
                json.dumps(
                    {
                        "case_index": case_index,
                        "expected": expected,
                        "actual": actual,
                        "state": state,
                        "report": report,
                    },
                    indent=2,
                    sort_keys=True,
                )
            )
        for reviewer, assigned in report["assignments"].items():
            if len(assigned) != len(set(assigned)):
                raise AssertionError(f"Duplicate assignment for {reviewer}: {assigned}")
            if len(assigned) > effective_cap:
                raise AssertionError(f"Reviewer cap exceeded for {reviewer}: {assigned}")
            if own_label.get(reviewer) in assigned:
                raise AssertionError(f"Self-review assigned for {reviewer}: {assigned}")

    return {
        "schema_version": "axm.challenge-review-assignment-audit/0.3",
        "status": "PASS",
        "cases": cases,
        "seed": seed,
        "oracle": "independent_edmonds_karp_max_flow",
        "subject": "deterministic_augmenting_b_matching_v1",
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Cross-check balanced review assignments against an independent max-flow oracle."
    )
    parser.add_argument("--cases", type=int, default=20_000)
    parser.add_argument("--seed", type=int, default=20_260_815)
    args = parser.parse_args()
    if not 1 <= args.cases <= 1_000_000:
        raise SystemExit("--cases must be in 1..1000000")
    print(json.dumps(run_audit(cases=args.cases, seed=args.seed), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
