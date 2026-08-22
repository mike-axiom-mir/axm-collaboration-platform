from __future__ import annotations

import math
from collections import deque
from typing import Any

from .utils import sha256_json


ASSIGNMENT_SCHEMA_VERSION = "axm.challenge-review-assignment/0.3"
ASSIGNMENT_ALGORITHM = "deterministic_augmenting_b_matching_v1"


def _tie_key(seed: str, *parts: str) -> str:
    return sha256_json({"seed": seed, "parts": list(parts)})


def _allowed_labels(
    state: dict[str, Any], reviewer_id: str, labels: list[str], *, allow_self: bool
) -> list[str]:
    if allow_self:
        return list(labels)
    own_submission = state.get("participant_active_submission", {}).get(reviewer_id)
    own_label = next(
        (
            label
            for label, submission_id in state.get("blind_map", {}).items()
            if submission_id == own_submission
        ),
        None,
    )
    return [label for label in labels if label != own_label]


def _target_matching(
    *,
    reviewers: list[str],
    labels: list[str],
    allowed: dict[str, list[str]],
    cap: int,
    target: int,
    required_reviewers: set[str],
    seed: str,
) -> tuple[dict[str, set[str]], dict[str, int], int]:
    """Return a deterministic maximum-cardinality capacitated assignment.

    This is an augmenting-path b-matching algorithm over candidate demand and
    reviewer capacity. Unlike a one-pass greedy allocator, it can move earlier
    assignments along an alternating path when that is necessary to cover a
    candidate that would otherwise be stranded.
    """

    assignments: dict[str, set[str]] = {reviewer: set() for reviewer in reviewers}
    coverage: dict[str, int] = {label: 0 for label in labels}
    if cap <= 0 or target <= 0 or not reviewers or not labels:
        return assignments, coverage, 0

    allowed_reviewers: dict[str, list[str]] = {
        label: [reviewer for reviewer in reviewers if label in allowed.get(reviewer, [])]
        for label in labels
    }

    def reviewer_order(label: str, reviewer: str) -> tuple[Any, ...]:
        load = len(assignments[reviewer])
        return (
            0 if load < cap else 1,
            0 if reviewer in required_reviewers and load == 0 else 1,
            load,
            _tie_key(seed, "edge", label, reviewer),
            reviewer,
        )

    def augment(start_label: str) -> bool:
        candidate_queue: deque[str] = deque([start_label])
        visited_candidates = {start_label}
        visited_reviewers: set[str] = set()
        # C -> R edges are unassigned candidate-reviewer pairs.
        parent_reviewer: dict[str, str] = {}
        # R -> C edges are currently assigned pairs and allow reassignment.
        parent_candidate: dict[str, str] = {}
        free_reviewer: str | None = None

        while candidate_queue and free_reviewer is None:
            candidate = candidate_queue.popleft()
            for reviewer in sorted(
                allowed_reviewers.get(candidate, []),
                key=lambda value: reviewer_order(candidate, value),
            ):
                if reviewer in visited_reviewers or candidate in assignments[reviewer]:
                    continue
                visited_reviewers.add(reviewer)
                parent_reviewer[reviewer] = candidate
                if len(assignments[reviewer]) < cap:
                    free_reviewer = reviewer
                    break
                for displaced_candidate in sorted(
                    assignments[reviewer],
                    key=lambda value: (
                        _tie_key(seed, "displace", reviewer, value),
                        value,
                    ),
                ):
                    if displaced_candidate in visited_candidates:
                        continue
                    visited_candidates.add(displaced_candidate)
                    parent_candidate[displaced_candidate] = reviewer
                    candidate_queue.append(displaced_candidate)

        if free_reviewer is None:
            return False

        reviewer = free_reviewer
        candidate = parent_reviewer[reviewer]
        assignments[reviewer].add(candidate)
        while candidate != start_label:
            previous_reviewer = parent_candidate[candidate]
            assignments[previous_reviewer].remove(candidate)
            previous_candidate = parent_reviewer[previous_reviewer]
            assignments[previous_reviewer].add(previous_candidate)
            candidate = previous_candidate
        coverage[start_label] += 1
        return True

    achieved = 0
    while True:
        progress = False
        under_target = sorted(
            (label for label in labels if coverage[label] < target),
            key=lambda label: (
                coverage[label],
                _tie_key(seed, "candidate", label, str(coverage[label])),
                label,
            ),
        )
        if not under_target:
            break
        for label in under_target:
            while coverage[label] < target:
                if not augment(label):
                    break
                achieved += 1
                progress = True
        if not progress:
            break

    # Recompute rather than trusting incremental accounting after alternating-path
    # flips. This also makes internal invariants easier to audit.
    coverage = {
        label: sum(label in assigned for assigned in assignments.values())
        for label in labels
    }
    achieved = sum(min(value, target) for value in coverage.values())
    return assignments, coverage, achieved


def build_review_assignments(state: dict[str, Any]) -> dict[str, Any]:
    """Build a deterministic, auditable reviewer-to-candidate assignment plan.

    ``all`` preserves the v0.1/v0.2 behavior. ``balanced`` limits quadratic review
    growth while meeting the locked candidate-coverage target whenever a valid
    capacitated matching exists. No randomness, timestamps, registration order, or
    host-specific dictionary order influences the result.
    """

    policy = state.get("packet", {}).get("participant_policy", {})
    mode = str(policy.get("review_assignment_mode", "all")).lower()
    if mode not in {"all", "balanced"}:
        raise ValueError(f"Unsupported review assignment mode: {mode!r}")

    labels = sorted(str(label) for label in state.get("blind_map", {}))
    reviewers = sorted(
        participant_id
        for participant_id, participant in state.get("participants", {}).items()
        if participant.get("can_review", True)
    )
    required_reviewers = {
        participant_id
        for participant_id, participant in state.get("participants", {}).items()
        if participant.get("can_review", True) and participant.get("review_required", True)
    }
    allow_self = bool(policy.get("allow_self_vote", False))
    minimum_target = int(policy.get("minimum_peer_reviews_per_candidate", 0))
    has_peer_criteria = any(
        criterion.get("source") == "peer"
        for criterion in state.get("packet", {}).get("rubric", [])
    )
    target = max(minimum_target, 1 if has_peer_criteria and labels else 0)
    requested_per_reviewer = int(policy.get("reviews_per_reviewer", 0))
    seed = str(state.get("packet_hash", ""))

    allowed = {
        reviewer_id: _allowed_labels(
            state, reviewer_id, labels, allow_self=allow_self
        )
        for reviewer_id in reviewers
    }
    assignments: dict[str, list[str]] = {reviewer_id: [] for reviewer_id in reviewers}
    requested_target_assignments = len(labels) * target
    achieved_target_assignments = 0
    supplemental_assignments = 0

    if mode == "all":
        assignments = {
            reviewer_id: sorted(allowed_labels)
            for reviewer_id, allowed_labels in allowed.items()
        }
        effective_cap: int | None = None
        achieved_target_assignments = sum(
            min(
                target,
                sum(label in reviewer_labels for reviewer_labels in assignments.values()),
            )
            for label in labels
        )
        algorithm = "all_eligible_candidates_v1"
    else:
        eligible_reviewers = [reviewer for reviewer in reviewers if allowed[reviewer]]
        desired_edge_count = max(
            requested_target_assignments,
            sum(1 for reviewer in required_reviewers if allowed.get(reviewer)),
        )
        maximum_cap = max((len(allowed[r]) for r in eligible_reviewers), default=0)
        if requested_per_reviewer > 0:
            effective_cap = requested_per_reviewer
            matched, _coverage, achieved_target_assignments = _target_matching(
                reviewers=reviewers,
                labels=labels,
                allowed=allowed,
                cap=effective_cap,
                target=target,
                required_reviewers=required_reviewers,
                seed=seed,
            )
        elif eligible_reviewers:
            effective_cap = max(1, math.ceil(desired_edge_count / len(eligible_reviewers)))
            effective_cap = min(effective_cap, maximum_cap)
            matched: dict[str, set[str]] = {reviewer: set() for reviewer in reviewers}
            # Aggregate capacity is not enough to prove feasibility when reviewers
            # cannot assess their own candidate. Increase the auto cap only when an
            # exact augmenting-path solve shows that candidate coverage still falls
            # short and more unique candidate edges remain available.
            while True:
                matched, _coverage, achieved_target_assignments = _target_matching(
                    reviewers=reviewers,
                    labels=labels,
                    allowed=allowed,
                    cap=effective_cap,
                    target=target,
                    required_reviewers=required_reviewers,
                    seed=seed,
                )
                if (
                    achieved_target_assignments >= requested_target_assignments
                    or effective_cap >= maximum_cap
                ):
                    break
                effective_cap += 1
        else:
            effective_cap = 0
            matched = {reviewer: set() for reviewer in reviewers}

        working: dict[str, set[str]] = {
            reviewer: set(matched.get(reviewer, set())) for reviewer in reviewers
        }
        coverage = {
            label: sum(label in assigned for assigned in working.values())
            for label in labels
        }

        def add_participation_assignment(reviewer: str) -> bool:
            nonlocal supplemental_assignments
            if (
                not allowed.get(reviewer)
                or len(working[reviewer]) >= int(effective_cap or 0)
            ):
                return False
            candidates = [
                label for label in allowed[reviewer] if label not in working[reviewer]
            ]
            if not candidates:
                return False
            label = min(
                candidates,
                key=lambda value: (
                    coverage[value],
                    _tie_key(seed, "participation", reviewer, value),
                    value,
                ),
            )
            working[reviewer].add(label)
            coverage[label] += 1
            supplemental_assignments += 1
            return True

        # Candidate coverage is solved first. Empty required reviewers then receive
        # one supplemental assignment when their own cap and allowed edges permit;
        # this cannot damage already-achieved candidate coverage.
        for reviewer in sorted(
            required_reviewers,
            key=lambda value: (_tie_key(seed, "required", value), value),
        ):
            if reviewer in working and not working[reviewer]:
                add_participation_assignment(reviewer)

        # Optional reviewers also receive one assignment when capacity permits,
        # preserving participation without expanding to all-to-all review.
        for reviewer in sorted(
            (value for value in reviewers if value not in required_reviewers),
            key=lambda value: (_tie_key(seed, "optional", value), value),
        ):
            if not working[reviewer]:
                add_participation_assignment(reviewer)

        assignments = {
            reviewer: sorted(assigned) for reviewer, assigned in working.items()
        }
        algorithm = ASSIGNMENT_ALGORITHM

    coverage = {
        label: sum(label in labels_for_reviewer for labels_for_reviewer in assignments.values())
        for label in labels
    }
    reviewer_loads = {
        reviewer_id: len(labels_for_reviewer)
        for reviewer_id, labels_for_reviewer in assignments.items()
    }
    unmet = {
        label: {"assigned": coverage[label], "target": target}
        for label in labels
        if coverage[label] < target
    }
    empty_required = sorted(
        reviewer
        for reviewer in required_reviewers
        if reviewer in assignments and not assignments[reviewer] and allowed.get(reviewer)
    )
    core = {
        "schema_version": ASSIGNMENT_SCHEMA_VERSION,
        "mode": mode,
        "assignment_algorithm": algorithm,
        "packet_hash": state.get("packet_hash"),
        "rubric_hash": state.get("rubric_hash"),
        "allow_self_vote": allow_self,
        "candidate_labels": labels,
        "eligible_reviewers": reviewers,
        "required_reviewers": sorted(required_reviewers),
        "candidate_target": target,
        "requested_candidate_target_assignments": requested_target_assignments,
        "achieved_candidate_target_assignments": achieved_target_assignments,
        "target_coverage_feasible_under_cap": (
            achieved_target_assignments >= requested_target_assignments
        ),
        "supplemental_participation_assignments": supplemental_assignments,
        "requested_reviews_per_reviewer": requested_per_reviewer,
        "effective_reviews_per_reviewer_cap": effective_cap,
        "assignments": assignments,
        "candidate_coverage": coverage,
        "reviewer_loads": reviewer_loads,
        "unmet_candidate_targets": unmet,
        "empty_required_reviewers_with_available_candidates": empty_required,
        "all_candidate_targets_met": not unmet,
    }
    return {**core, "assignment_hash": sha256_json(core)}
