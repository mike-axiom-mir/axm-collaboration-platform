from __future__ import annotations

from collections import defaultdict
from statistics import mean, median, pstdev
from typing import Any

from .orchestration import orchestration_report
from .utils import clamp, utc_now


def _reviewer_independence_group(state: dict[str, Any], reviewer_id: str) -> str:
    participant = state.get("participants", {}).get(reviewer_id, {})
    if isinstance(participant, dict):
        group = participant.get("independence_group")
        if isinstance(group, str) and group.strip():
            return group.strip()
    return "UNDECLARED"


def _active_submissions(state: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        submission_id: submission
        for submission_id, submission in state.get("submissions", {}).items()
        if submission.get("status") == "ACTIVE"
    }


def _aggregate(values: list[float], method: str, trim_fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(float(value) for value in values)
    if method == "mean":
        return mean(ordered)
    if method == "trimmed_mean" and len(ordered) >= 3:
        trim = int(len(ordered) * trim_fraction)
        if trim and len(ordered) - 2 * trim >= 1:
            ordered = ordered[trim : len(ordered) - trim]
        return mean(ordered)
    return median(ordered)


def _dispersion(values: list[float]) -> dict[str, Any]:
    if not values:
        return {
            "count": 0,
            "minimum": None,
            "maximum": None,
            "range": None,
            "stdev": None,
            "mad": None,
        }
    center = median(values)
    deviations = [abs(value - center) for value in values]
    return {
        "count": len(values),
        "minimum": round(min(values), 6),
        "maximum": round(max(values), 6),
        "range": round(max(values) - min(values), 6),
        "stdev": round(pstdev(values), 6) if len(values) > 1 else 0.0,
        "mad": round(median(deviations), 6),
    }


def _review_tiers(review: dict[str, Any]) -> list[list[str]]:
    tiers = review.get("ranking_tiers")
    if isinstance(tiers, list) and all(isinstance(tier, list) for tier in tiers):
        return [[str(label) for label in tier] for tier in tiers if tier]
    ranking = review.get("ranking", [])
    if isinstance(ranking, list):
        return [[str(label)] for label in ranking]
    return []


def _condorcet(labels: list[str], pairwise: dict[str, dict[str, int]]) -> dict[str, Any]:
    wins: dict[str, int] = defaultdict(int)
    losses: dict[str, int] = defaultdict(int)
    ties: list[list[str]] = []
    for index, left in enumerate(labels):
        for right in labels[index + 1 :]:
            left_over = int(pairwise[left].get(right, 0))
            right_over = int(pairwise[right].get(left, 0))
            if left_over > right_over:
                wins[left] += 1
                losses[right] += 1
            elif right_over > left_over:
                wins[right] += 1
                losses[left] += 1
            else:
                ties.append([left, right])
    required_wins = max(0, len(labels) - 1)
    winners = sorted(
        label for label in labels if wins[label] == required_wins and losses[label] == 0
    )

    cycles: list[list[str]] = []
    for a in labels:
        for b in labels:
            if b == a or pairwise[a].get(b, 0) <= pairwise[b].get(a, 0):
                continue
            for c in labels:
                if c in {a, b}:
                    continue
                if (
                    pairwise[b].get(c, 0) > pairwise[c].get(b, 0)
                    and pairwise[c].get(a, 0) > pairwise[a].get(c, 0)
                ):
                    canonical = min([a, b, c], [b, c, a], [c, a, b])
                    if canonical not in cycles:
                        cycles.append(canonical)
    return {
        "winner": winners[0] if len(winners) == 1 else None,
        "co_winners": winners,
        "wins": {label: wins[label] for label in labels},
        "losses": {label: losses[label] for label in labels},
        "ties": ties,
        "cycles": sorted(cycles),
    }


def aggregate_votes(packet: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
    blind_map: dict[str, str] = state.get("blind_map", {})
    submissions = _active_submissions(state)
    reviews = [
        review
        for review in state.get("reviews", {}).values()
        if review.get("status") == "ACTIVE"
    ]
    criteria = {criterion["id"]: criterion for criterion in packet.get("rubric", [])}
    evaluation_policy = packet.get("evaluation_policy", {})
    aggregation_method = str(evaluation_policy.get("peer_aggregation", "median"))
    trim_fraction = float(evaluation_policy.get("trim_fraction", 0.1))
    outlier_threshold = float(
        evaluation_policy.get("outlier_threshold_points", 25.0)
    )

    peer_observations: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    peer_abstentions: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    reviewer_values: dict[str, list[float]] = defaultdict(list)
    reviewer_score_vectors: dict[str, dict[tuple[str, str], float]] = defaultdict(dict)
    first_choices: dict[str, float] = defaultdict(float)
    rank_points: dict[str, list[float]] = defaultdict(list)
    pairwise: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    ranking_appearances: dict[str, int] = defaultdict(int)
    pairwise_opportunities: dict[str, dict[str, int]] = defaultdict(
        lambda: defaultdict(int)
    )
    ranking_ballot_shapes: list[dict[str, Any]] = []
    comparative_ranking_ballots = 0

    labels = sorted(blind_map)
    for review in reviews:
        reviewer_id = str(review.get("reviewer_id", "unknown-reviewer"))
        evaluations = review.get("evaluations", {})
        if not isinstance(evaluations, dict):
            evaluations = {}
        for label, evaluation in evaluations.items():
            if not isinstance(evaluation, dict):
                continue
            for criterion_id, raw_score in evaluation.get("scores", {}).items():
                criterion = criteria.get(criterion_id)
                if not criterion or criterion.get("source") != "peer":
                    continue
                minimum = float(criterion.get("score_min", 0))
                maximum = float(criterion.get("score_max", 100))
                raw = float(raw_score)
                normalized = (
                    100.0
                    if maximum == minimum
                    else (raw - minimum) / (maximum - minimum) * 100.0
                )
                normalized = clamp(normalized)
                peer_observations[label][criterion_id].append(
                    {
                        "reviewer_id": reviewer_id,
                        "independence_group": _reviewer_independence_group(state, reviewer_id),
                        "score": normalized,
                        "evidence_ref_count": len(
                            evaluation.get("evidence_refs", {}).get(criterion_id, [])
                        ),
                    }
                )
                reviewer_values[reviewer_id].append(normalized)
                reviewer_score_vectors[reviewer_id][(label, criterion_id)] = normalized
            for criterion_id, abstention in evaluation.get("abstentions", {}).items():
                criterion = criteria.get(criterion_id)
                if not criterion or criterion.get("source") != "peer":
                    continue
                peer_abstentions[label][criterion_id].append(
                    {
                        "reviewer_id": reviewer_id,
                        "reason": (
                            abstention.get("reason", "")
                            if isinstance(abstention, dict)
                            else str(abstention)
                        ),
                        "missing_capability": (
                            abstention.get("missing_capability", "")
                            if isinstance(abstention, dict)
                            else ""
                        ),
                    }
                )

        tiers = _review_tiers(review)
        flattened = [label for tier in tiers for label in tier]
        if tiers and flattened:
            unique_ranked = sorted(set(flattened))
            for label in unique_ranked:
                ranking_appearances[label] += 1
            for left_index, left in enumerate(unique_ranked):
                for right in unique_ranked[left_index + 1 :]:
                    pairwise_opportunities[left][right] += 1
                    pairwise_opportunities[right][left] += 1
            comparative = len(unique_ranked) >= 2
            ranking_ballot_shapes.append(
                {
                    "reviewer_id": reviewer_id,
                    "labels": unique_ranked,
                    "tier_sizes": [len(tier) for tier in tiers],
                    "comparative": comparative,
                }
            )
            if comparative:
                comparative_ranking_ballots += 1
                top_tier = tiers[0]
                share = 1.0 / len(top_tier)
                for label in top_tier:
                    first_choices[label] += share

                total = len(flattened)
                position = 0
                for tier in tiers:
                    start = position
                    end = position + len(tier) - 1
                    average_position = (start + end) / 2.0
                    points = (total - 1 - average_position) / (total - 1) * 100.0
                    for label in tier:
                        rank_points[label].append(points)
                    position = end + 1

                for higher_index, higher_tier in enumerate(tiers):
                    for lower_tier in tiers[higher_index + 1 :]:
                        for higher in higher_tier:
                            for lower in lower_tier:
                                pairwise[higher][lower] += 1

    assignment_report = state.get("review_assignment_report", {})
    assignment_mode = str(assignment_report.get("mode", "all"))
    reviewer_similarity_pairs: list[dict[str, Any]] = []
    reviewer_ids = sorted(reviewer_score_vectors)
    for index, left in enumerate(reviewer_ids):
        left_vector = reviewer_score_vectors[left]
        for right in reviewer_ids[index + 1 :]:
            right_vector = reviewer_score_vectors[right]
            overlap = sorted(set(left_vector) & set(right_vector))
            if len(overlap) < 3:
                continue
            deltas = [abs(left_vector[key] - right_vector[key]) for key in overlap]
            mean_abs_delta = mean(deltas) if deltas else 0.0
            exact = all(delta <= 1e-9 for delta in deltas)
            near_identical = mean_abs_delta <= 1.0
            if exact or near_identical:
                reviewer_similarity_pairs.append(
                    {
                        "reviewer_a": left,
                        "reviewer_b": right,
                        "independence_group_a": _reviewer_independence_group(state, left),
                        "independence_group_b": _reviewer_independence_group(state, right),
                        "overlap_score_count": len(overlap),
                        "mean_absolute_score_delta": round(mean_abs_delta, 6),
                        "exact_score_vector_match": exact,
                        "near_identical_score_vector": near_identical,
                    }
                )
    reviewer_similarity_audit = {
        "pair_count": len(reviewer_similarity_pairs),
        "pairs": reviewer_similarity_pairs,
        "minimum_overlap_for_signal": 3,
        "near_identical_mean_absolute_delta_threshold": 1.0,
        "automatic_exclusion": False,
        "note": (
            "Similarity is a diagnostic signal only. It may reflect shared models, shared evidence, "
            "or legitimate agreement and never silently changes scores."
        ),
    }

    reviewed_reviewer_ids = sorted(
        str(review.get("reviewer_id")) for review in reviews if review.get("reviewer_id")
    )
    independence_groups: dict[str, list[str]] = defaultdict(list)
    for reviewer_id in reviewed_reviewer_ids:
        independence_groups[_reviewer_independence_group(state, reviewer_id)].append(reviewer_id)
    review_independence_audit = {
        "groups": {group: sorted(members) for group, members in sorted(independence_groups.items())},
        "declared_group_count": len([group for group in independence_groups if group != "UNDECLARED"]),
        "undeclared_reviewers": sorted(independence_groups.get("UNDECLARED", [])),
        "automatic_score_effect": False,
        "note": (
            "Independence groups are registry declarations, not proof that reviewers are actually independent. "
            "They are used only for locked minimum-diversity readiness checks."
        ),
    }

    assignment_map = state.get("review_assignments", {})
    complete_ranking_ballots = True
    for review in reviews:
        reviewer_id = str(review.get("reviewer_id", "unknown-reviewer"))
        actual = {label for tier in _review_tiers(review) for label in tier}
        expected = set(assignment_map.get(reviewer_id, []))
        if not expected:
            own_submission = state.get("participant_active_submission", {}).get(
                reviewer_id
            )
            own_label = next(
                (
                    label
                    for label, submission_id in blind_map.items()
                    if submission_id == own_submission
                ),
                None,
            )
            expected = set(labels)
            if own_label and not packet.get("participant_policy", {}).get(
                "allow_self_vote", False
            ):
                expected.discard(own_label)
        if actual != expected:
            complete_ranking_ballots = False
            break

    appearance_counts = {label: ranking_appearances.get(label, 0) for label in labels}
    appearance_values = list(appearance_counts.values())
    equal_appearances = len(set(appearance_values)) <= 1
    pair_opportunity_counts = {
        left: {
            right: pairwise_opportunities[left].get(right, 0)
            for right in labels
            if right != left
        }
        for left in labels
    }
    unique_pair_values = {
        pairwise_opportunities[left].get(right, 0)
        for left_index, left in enumerate(labels)
        for right in labels[left_index + 1 :]
    }
    equal_pairwise_opportunity = len(unique_pair_values) <= 1
    assignment_targets_met = bool(
        assignment_report.get("all_candidate_targets_met", True)
    )
    ranking_comparability_reasons: list[str] = []
    if assignment_mode != "all":
        ranking_comparability_reasons.append(
            "balanced assignments expose candidates to different ranking subsets"
        )
    if not complete_ranking_ballots:
        ranking_comparability_reasons.append(
            "one or more rankings do not cover the reviewer's complete locked assignment"
        )
    if not equal_appearances:
        ranking_comparability_reasons.append(
            "candidate ranking appearance counts are unequal"
        )
    if not equal_pairwise_opportunity:
        ranking_comparability_reasons.append(
            "candidate pairwise comparison opportunities are unequal"
        )
    if not assignment_targets_met:
        ranking_comparability_reasons.append(
            "the locked review assignment did not meet every candidate coverage target"
        )
    if not reviews or not any(appearance_values):
        ranking_comparability_reasons.append("no ranking ballots were available")
    elif comparative_ranking_ballots == 0:
        ranking_comparability_reasons.append(
            "no ballot compared two or more candidates; single-candidate rankings carry no preference weight"
        )
    ranking_tie_break_eligible = not ranking_comparability_reasons
    ranking_comparability = {
        "tie_break_eligible": ranking_tie_break_eligible,
        "assignment_mode": assignment_mode,
        "complete_locked_ballots": complete_ranking_ballots,
        "equal_candidate_appearances": equal_appearances,
        "equal_pairwise_opportunity": equal_pairwise_opportunity,
        "assignment_targets_met": assignment_targets_met,
        "candidate_appearance_counts": appearance_counts,
        "pairwise_opportunity_counts": pair_opportunity_counts,
        "ballot_shapes": ranking_ballot_shapes,
        "comparative_ballot_count": comparative_ranking_ballots,
        "reasons_withheld": ranking_comparability_reasons,
        "note": (
            "Rankings remain visible as preference evidence. They may break an otherwise "
            "exact rubric tie only when candidates had structurally comparable opportunities."
        ),
    }

    deterministic_available: dict[str, bool] = {}
    for criterion_id, criterion in criteria.items():
        if criterion.get("source") != "deterministic":
            continue
        deterministic_available[criterion_id] = any(
            state.get("test_results", {})
            .get(submission_id, {})
            .get("criterion_scores", {})
            .get(criterion_id, {})
            .get("score")
            is not None
            for submission_id in blind_map.values()
        )

    automatic_total_weight = sum(
        float(criterion.get("weight", 1.0))
        for criterion in criteria.values()
        if criterion.get("source") != "human"
    )
    peer_criterion_ids = [
        criterion_id
        for criterion_id, criterion in criteria.items()
        if criterion.get("source") == "peer"
    ]
    human_total_weight = sum(
        float(criterion.get("weight", 1.0))
        for criterion in criteria.values()
        if criterion.get("source") == "human"
    )

    candidate_rows: list[dict[str, Any]] = []
    for label in labels:
        submission_id = blind_map[label]
        submission = submissions[submission_id]
        tests = state.get("test_results", {}).get(submission_id, {})
        criterion_scores: dict[str, Any] = {}
        weighted_total = 0.0
        included_weight = 0.0
        reviewers_for_candidate: set[str] = set()
        peer_supports: list[int] = []

        for criterion_id, criterion in criteria.items():
            source = criterion.get("source")
            weight = float(criterion.get("weight", 1.0))
            score: float | None
            support = 0
            score_dispersion: dict[str, Any] | None = None
            abstention_rows: list[dict[str, Any]] = []
            evidence_ref_count = 0
            independent_review_groups: list[str] = []
            undeclared_reviewer_count = 0
            if source == "peer":
                observations = peer_observations[label].get(criterion_id, [])
                values = [float(item["score"]) for item in observations]
                reviewers_for_candidate.update(
                    str(item["reviewer_id"]) for item in observations
                )
                score = _aggregate(values, aggregation_method, trim_fraction)
                support = len(values)
                observed_review_groups = [
                    str(item.get("independence_group", "UNDECLARED"))
                    for item in observations
                ]
                independent_review_groups = sorted(
                    {group for group in observed_review_groups if group != "UNDECLARED"}
                )
                undeclared_reviewer_count = sum(
                    1 for group in observed_review_groups if group == "UNDECLARED"
                )
                peer_supports.append(support)
                score_dispersion = _dispersion(values)
                evidence_ref_count = sum(
                    int(item.get("evidence_ref_count", 0)) for item in observations
                )
                abstention_rows = peer_abstentions[label].get(criterion_id, [])
            elif source == "deterministic":
                stored = tests.get("criterion_scores", {}).get(criterion_id, {})
                stored_score = stored.get("score")
                if stored_score is None and deterministic_available.get(criterion_id):
                    score = 0.0
                else:
                    score = float(stored_score) if stored_score is not None else None
                support = int(stored.get("coverage", 0))
            else:
                score = None

            criterion_scores[criterion_id] = {
                "label": criterion.get("label", criterion_id),
                "source": source,
                "weight": weight,
                "score": round(score, 6) if score is not None else None,
                "support": support,
                "abstention_count": len(abstention_rows),
                "abstentions": abstention_rows,
                "evidence_ref_count": evidence_ref_count,
                "independent_review_group_count": len(independent_review_groups),
                "independent_review_groups": independent_review_groups,
                "undeclared_reviewer_count": undeclared_reviewer_count,
                "dispersion": score_dispersion,
            }
            if source != "human" and score is not None:
                weighted_total += score * weight
                included_weight += weight

        total_score = weighted_total / included_weight if included_weight else 0.0
        check_summary = tests.get("summary", {})
        check_total = int(check_summary.get("total", 0))
        pass_ratio = (
            int(check_summary.get("passed", 0)) / check_total if check_total else 0.0
        )
        ranking_values = rank_points.get(label, [])
        coverage_ratio = (
            included_weight / automatic_total_weight if automatic_total_weight else 1.0
        )
        candidate_rows.append(
            {
                "blind_label": label,
                "submission_id": submission_id,
                "artifact_hash": submission.get("content_hash"),
                "eligible": bool(tests.get("eligible", True)),
                "automatic_score": round(total_score, 6),
                "automatic_weight_coverage": round(included_weight, 6),
                "automatic_weight_total": round(automatic_total_weight, 6),
                "automatic_weight_coverage_ratio": round(coverage_ratio, 6),
                "criterion_scores": criterion_scores,
                "deterministic_pass_ratio": round(pass_ratio, 6),
                "first_choice_votes": round(first_choices.get(label, 0.0), 6),
                "ranking_score": (
                    round(mean(ranking_values), 6) if ranking_values else 0.0
                ),
                "ranking_median": (
                    round(median(ranking_values), 6) if ranking_values else 0.0
                ),
                "reviews_received": len(reviewers_for_candidate),
                "minimum_peer_support": min(peer_supports) if peer_supports else None,
                "minimum_independent_review_groups": (
                    min(
                        criterion_scores[criterion_id]["independent_review_group_count"]
                        for criterion_id in peer_criterion_ids
                    )
                    if peer_criterion_ids else None
                ),
                "independent_review_groups_by_criterion": {
                    criterion_id: criterion_scores[criterion_id]["independent_review_groups"]
                    for criterion_id in peer_criterion_ids
                },
                "peer_support_by_criterion": {
                    criterion_id: criterion_scores[criterion_id]["support"]
                    for criterion_id in peer_criterion_ids
                },
                "peer_abstentions_by_criterion": {
                    criterion_id: criterion_scores[criterion_id]["abstention_count"]
                    for criterion_id in peer_criterion_ids
                },
            }
        )

    def ranking_signal(row: dict[str, Any]) -> tuple[Any, ...]:
        base: tuple[Any, ...] = (
            bool(row["eligible"]),
            round(row["automatic_score"], 6),
            round(row["automatic_weight_coverage_ratio"], 6),
            round(row["deterministic_pass_ratio"], 6),
        )
        if ranking_tie_break_eligible:
            return base + (
                round(float(row["first_choice_votes"]), 6),
                round(row["ranking_score"], 6),
            )
        return base

    candidate_rows.sort(key=ranking_signal, reverse=True)
    grouped: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
    for row in candidate_rows:
        grouped[ranking_signal(row)].append(row)
    sorted_rows: list[dict[str, Any]] = []
    seen_keys: set[tuple[Any, ...]] = set()
    for row in candidate_rows:
        key = ranking_signal(row)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        sorted_rows.extend(sorted(grouped[key], key=lambda item: item["blind_label"]))
    candidate_rows = sorted_rows

    highest_scoring_candidate = (
        candidate_rows[0]["blind_label"] if candidate_rows else None
    )
    runner_up = candidate_rows[1]["blind_label"] if len(candidate_rows) > 1 else None
    top_signal = ranking_signal(candidate_rows[0]) if candidate_rows else None
    exact_tie_labels = (
        sorted(
            row["blind_label"]
            for row in candidate_rows
            if ranking_signal(row) == top_signal
        )
        if top_signal is not None
        else []
    )
    margin = (
        candidate_rows[0]["automatic_score"] - candidate_rows[1]["automatic_score"]
        if len(candidate_rows) > 1
        else candidate_rows[0]["automatic_score"] if candidate_rows else 0.0
    )

    criterion_awards = []
    for criterion_id, criterion in criteria.items():
        scored = [
            row
            for row in candidate_rows
            if row["criterion_scores"][criterion_id]["score"] is not None
        ]
        if not scored:
            continue
        best_score = max(
            row["criterion_scores"][criterion_id]["score"] for row in scored
        )
        winners = sorted(
            row["blind_label"]
            for row in scored
            if row["criterion_scores"][criterion_id]["score"] == best_score
        )
        criterion_awards.append(
            {
                "criterion_id": criterion_id,
                "label": criterion.get("label", criterion_id),
                "source": criterion.get("source"),
                "score": best_score,
                "winners": winners,
            }
        )

    dissent = []
    for review in reviews:
        tiers = _review_tiers(review)
        top_tier = tiers[0] if tiers else []
        if (
            top_tier
            and highest_scoring_candidate
            and highest_scoring_candidate not in top_tier
        ):
            dissent.append(
                {
                    "reviewer_id": review.get("reviewer_id"),
                    "preferred": top_tier[0],
                    "preferred_tier": top_tier,
                    "winner": highest_scoring_candidate,
                    "reason": review.get("overall_reason", ""),
                }
            )

    pairwise_table = {
        higher: {
            lower: pairwise[higher].get(lower, 0)
            for lower in labels
            if lower != higher
        }
        for higher in labels
    }
    condorcet = _condorcet(labels, pairwise)

    peer_medians: dict[tuple[str, str], float] = {}
    for label, criterion_map in peer_observations.items():
        for criterion_id, observations in criterion_map.items():
            values = [float(item["score"]) for item in observations]
            if values:
                peer_medians[(label, criterion_id)] = median(values)

    reviewer_audit = []
    ungrounded_scores = 0
    for review in reviews:
        reviewer_id = str(review.get("reviewer_id", "unknown-reviewer"))
        values = reviewer_values.get(reviewer_id, [])
        outliers = []
        abstention_count = 0
        evidence_ref_count = 0
        scored_criterion_count = 0
        for label, evaluation in review.get("evaluations", {}).items():
            abstention_count += len(evaluation.get("abstentions", {}))
            for criterion_id, raw_score in evaluation.get("scores", {}).items():
                criterion = criteria.get(criterion_id)
                if not criterion or criterion.get("source") != "peer":
                    continue
                scored_criterion_count += 1
                refs = evaluation.get("evidence_refs", {}).get(criterion_id, [])
                evidence_ref_count += len(refs)
                if not refs:
                    ungrounded_scores += 1
                minimum = float(criterion.get("score_min", 0))
                maximum = float(criterion.get("score_max", 100))
                normalized = clamp(
                    (float(raw_score) - minimum) / (maximum - minimum) * 100.0
                )
                center = peer_medians.get((label, criterion_id))
                if center is not None and abs(normalized - center) >= outlier_threshold:
                    outliers.append(
                        {
                            "candidate": label,
                            "criterion_id": criterion_id,
                            "score": round(normalized, 6),
                            "peer_median": round(center, 6),
                            "difference": round(normalized - center, 6),
                        }
                    )
        value_range = max(values) - min(values) if values else 0.0
        extreme_share = (
            sum(1 for value in values if value <= 5 or value >= 95) / len(values)
            if values
            else 0.0
        )
        evidence_coverage = (
            sum(
                1
                for evaluation in review.get("evaluations", {}).values()
                for criterion_id in evaluation.get("scores", {})
                if evaluation.get("evidence_refs", {}).get(criterion_id)
            )
            / scored_criterion_count
            if scored_criterion_count
            else 1.0
        )
        flags = []
        if len(values) >= 3 and value_range <= 1.0:
            flags.append("NEAR_FLAT_SCORING")
        if len(values) >= 3 and extreme_share >= 0.8:
            flags.append("MOSTLY_EXTREME_SCORES")
        if outliers:
            flags.append("OUTLIER_SCORES_PRESENT")
        if scored_criterion_count and evidence_coverage < 1.0:
            flags.append("UNGROUNDED_SCORES_PRESENT")
        reviewer_audit.append(
            {
                "reviewer_id": reviewer_id,
                "score_count": len(values),
                "abstention_count": abstention_count,
                "evidence_ref_count": evidence_ref_count,
                "score_evidence_coverage_ratio": round(evidence_coverage, 6),
                "mean_score": round(mean(values), 6) if values else None,
                "score_range": round(value_range, 6) if values else None,
                "extreme_score_share": round(extreme_share, 6),
                "outlier_count": len(outliers),
                "outliers": outliers,
                "flags": flags,
                "automatic_exclusion": False,
            }
        )

    assignment_map = state.get("review_assignments", {})
    required_reviewers = {
        participant_id
        for participant_id, participant in state.get("participants", {}).items()
        if participant.get("can_review", True)
        and participant.get("review_required", True)
        and (not assignment_map or bool(assignment_map.get(participant_id)))
    }
    completed_reviewers = set(state.get("participant_active_review", {}))
    missing_required_reviewers = sorted(required_reviewers - completed_reviewers)
    policy = packet.get("participant_policy", {})
    is_v04_packet = packet.get("schema_version") in {
        "axm.challenge-arena/0.4",
        "axm.challenge-arena/0.5",
    }
    minimum_peer_support = int(policy.get("minimum_peer_reviews_per_candidate", 0))
    minimum_independent_groups = int(
        policy.get("minimum_independent_review_groups_per_candidate", 0)
    )
    minimum_coverage = float(
        policy.get("minimum_automatic_weight_coverage_ratio", 0.0)
    )
    evidence_gaps: list[dict[str, Any]] = []
    orchestration_policy = packet.get("orchestration_policy", {})
    build_orchestration: dict[str, Any] | None = None
    if orchestration_policy.get("enabled", False):
        stored_report = state.get("orchestration_reports", {}).get("BUILD")
        build_orchestration = (
            stored_report
            if isinstance(stored_report, dict)
            else orchestration_report(state, phase="BUILD")
        )
        minimum_task_completion = float(
            orchestration_policy.get(
                "minimum_build_task_completion_ratio", 0.0
            )
        )
        actual_task_completion = float(
            build_orchestration.get("completion_ratio", 1.0)
        )
        if actual_task_completion < minimum_task_completion:
            evidence_gaps.append(
                {
                    "code": "LOW_BUILD_TASK_COMPLETION",
                    "detail": (
                        f"BUILD seat-task completion {actual_task_completion:.3f} is below "
                        f"the locked minimum {minimum_task_completion:.3f}. Missing or "
                        "unavailable seats remain an evidence gap rather than becoming "
                        "invented negative candidate scores."
                    ),
                    "actual_completion_ratio": actual_task_completion,
                    "minimum_completion_ratio": minimum_task_completion,
                    "required_incomplete_task_ids": build_orchestration.get(
                        "required_incomplete_task_ids", []
                    ),
                }
            )
    if not candidate_rows:
        evidence_gaps.append(
            {"code": "NO_CANDIDATES", "detail": "No candidate rows were available."}
        )
    if candidate_rows and not any(row["eligible"] for row in candidate_rows):
        evidence_gaps.append(
            {
                "code": "ALL_CANDIDATES_INELIGIBLE",
                "detail": "Every candidate failed a required deterministic check.",
            }
        )
    if candidate_rows and (
        automatic_total_weight <= 0
        or not any(row["automatic_weight_coverage"] > 0 for row in candidate_rows)
    ):
        evidence_gaps.append(
            {
                "code": "NO_AUTOMATIC_SCORING_EVIDENCE",
                "detail": (
                    "The locked rubric produced no deterministic or peer score evidence; "
                    "a lexical label must not become a winner."
                ),
            }
        )
    if len(exact_tie_labels) > 1:
        evidence_gaps.append(
            {
                "code": "EXACT_TOP_TIE",
                "detail": (
                    "Top candidates are exactly tied on every declared ranking signal: "
                    f"{exact_tie_labels}"
                ),
            }
        )
    winner_row = next(
        (
            row
            for row in candidate_rows
            if row["blind_label"] == highest_scoring_candidate
        ),
        None,
    )
    if winner_row and winner_row["automatic_weight_coverage_ratio"] < minimum_coverage:
        evidence_gaps.append(
            {
                "code": "LOW_AUTOMATIC_WEIGHT_COVERAGE",
                "detail": (
                    f"Winner coverage {winner_row['automatic_weight_coverage_ratio']:.3f} is below "
                    f"the locked minimum {minimum_coverage:.3f}."
                ),
            }
        )
    assignment_target = int(
        assignment_report.get(
            "candidate_target", 1 if peer_criterion_ids and candidate_rows else 0
        )
        or 0
    )
    required_peer_support = max(minimum_peer_support, assignment_target)
    comparative_support_deficits: list[dict[str, Any]] = []
    if is_v04_packet and peer_criterion_ids:
        for row in candidate_rows:
            for criterion_id in peer_criterion_ids:
                support = int(
                    row.get("peer_support_by_criterion", {}).get(criterion_id, 0)
                )
                if support < required_peer_support:
                    comparative_support_deficits.append(
                        {
                            "blind_label": row["blind_label"],
                            "criterion_id": criterion_id,
                            "support": support,
                            "required": required_peer_support,
                            "abstentions": int(
                                row.get("peer_abstentions_by_criterion", {}).get(
                                    criterion_id, 0
                                )
                            ),
                        }
                    )
        assignment_unmet = assignment_report.get(
            "unmet_candidate_targets", {}
        )
        if comparative_support_deficits or assignment_unmet:
            evidence_gaps.append(
                {
                    "code": "INCOMPLETE_COMPARATIVE_REVIEW_COVERAGE",
                    "detail": (
                        "At least one candidate/peer-criterion lacks the locked minimum "
                        "comparative support, so an unreviewed or abstained candidate is not "
                        "silently treated as a weaker candidate."
                    ),
                    "required_peer_support": required_peer_support,
                    "deficits": comparative_support_deficits,
                    "assignment_unmet_candidate_targets": assignment_unmet,
                }
            )

    independent_group_deficits: list[dict[str, Any]] = []
    if peer_criterion_ids and minimum_independent_groups > 0:
        for row in candidate_rows:
            for criterion_id in peer_criterion_ids:
                groups = row.get("independent_review_groups_by_criterion", {}).get(
                    criterion_id, []
                )
                declared_groups = list(groups)
                if len(declared_groups) < minimum_independent_groups:
                    independent_group_deficits.append(
                        {
                            "blind_label": row["blind_label"],
                            "criterion_id": criterion_id,
                            "declared_independent_group_count": len(declared_groups),
                            "required": minimum_independent_groups,
                            "groups_observed": groups,
                        }
                    )
        if independent_group_deficits:
            evidence_gaps.append(
                {
                    "code": "INSUFFICIENT_INDEPENDENT_REVIEW_GROUPS",
                    "detail": (
                        "At least one candidate/peer-criterion lacks the locked minimum number "
                        "of declared reviewer independence groups. The Arena withholds readiness "
                        "rather than pretending repeated or related reviewers are independent evidence."
                    ),
                    "required_declared_groups": minimum_independent_groups,
                    "deficits": independent_group_deficits,
                }
            )

    if peer_criterion_ids and winner_row:
        support = winner_row.get("minimum_peer_support") or 0
        if support < minimum_peer_support:
            evidence_gaps.append(
                {
                    "code": "LOW_PEER_REVIEW_SUPPORT",
                    "detail": (
                        f"Winner has minimum peer support {support}; locked minimum is "
                        f"{minimum_peer_support}. Abstentions remain visible rather than being "
                        "converted into invented scores."
                    ),
                }
            )
    if missing_required_reviewers:
        evidence_gaps.append(
            {
                "code": "MISSING_REQUIRED_REVIEWS",
                "detail": f"Missing required reviewers: {missing_required_reviewers}",
            }
        )
    if ungrounded_scores and policy.get("require_score_evidence", False):
        evidence_gaps.append(
            {
                "code": "UNGROUNDED_PEER_SCORES",
                "detail": (
                    f"{ungrounded_scores} peer score(s) lack evidence references despite the "
                    "locked grounding requirement."
                ),
            }
        )
    if human_total_weight:
        evidence_gaps.append(
            {
                "code": "HUMAN_RUBRIC_WEIGHT_PENDING",
                "detail": (
                    f"{human_total_weight:g} rubric weight is reserved for explicit human judgment."
                ),
            }
        )

    all_ineligible = bool(candidate_rows) and not any(
        row["eligible"] for row in candidate_rows
    )
    material_gaps = [
        gap for gap in evidence_gaps if gap["code"] != "HUMAN_RUBRIC_WEIGHT_PENDING"
    ]
    material_gap_codes = {gap["code"] for gap in material_gaps}
    if not candidate_rows:
        recommendation_status = "NO_CANDIDATES"
    elif all_ineligible:
        recommendation_status = "ALL_CANDIDATES_INELIGIBLE"
    elif "NO_AUTOMATIC_SCORING_EVIDENCE" in material_gap_codes:
        recommendation_status = "INSUFFICIENT_EVIDENCE"
    elif len(exact_tie_labels) > 1:
        recommendation_status = "EXACT_TIE"
    elif material_gaps:
        recommendation_status = "INSUFFICIENT_EVIDENCE"
    elif human_total_weight:
        recommendation_status = "PARTIAL_RUBRIC_HUMAN_REQUIRED"
    else:
        recommendation_status = "READY_FOR_HUMAN_DECISION"

    provisional_winner = (
        highest_scoring_candidate
        if recommendation_status
        in {"READY_FOR_HUMAN_DECISION", "PARTIAL_RUBRIC_HUMAN_REQUIRED"}
        else None
    )

    ranking_ballots = sum(1 for review in reviews if _review_tiers(review))
    winner_firsts = (
        first_choices.get(highest_scoring_candidate, 0.0)
        if highest_scoring_candidate
        else 0.0
    )
    first_choice_share = (
        winner_firsts / comparative_ranking_ballots
        if comparative_ranking_ballots
        else 0.0
    )
    confidence_first_choice_share = (
        first_choice_share if ranking_tie_break_eligible else 0.0
    )
    if recommendation_status in {
        "NO_CANDIDATES",
        "ALL_CANDIDATES_INELIGIBLE",
        "EXACT_TIE",
        "INSUFFICIENT_EVIDENCE",
    }:
        confidence = "INSUFFICIENT"
    elif not peer_criterion_ids:
        confidence = "DETERMINISTIC_ONLY"
    elif margin >= 15 and confidence_first_choice_share >= 0.6:
        confidence = "HIGH"
    elif margin >= 5 or confidence_first_choice_share >= 0.5:
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    return {
        "generated_at": utc_now(),
        "method": {
            "primary": "pre-locked weighted rubric score",
            "peer_aggregation": aggregation_method,
            "trim_fraction": trim_fraction,
            "eligibility": "required deterministic failures rank behind eligible candidates",
            "review_audit": "flags remain evidence only; no review is silently removed",
            "abstention_handling": "explicit abstentions contribute no invented numeric score and remain visible as coverage evidence",
            "ranking_ties": "ranking tiers use average positional points; candidates in the same tier create no pairwise preference",
            "tie_breaks": [
                "automatic weight coverage ratio",
                "deterministic pass ratio",
                (
                    "fractional first-choice support only when ranking opportunities are comparable"
                ),
                (
                    "normalized tied-ranking score only when ranking opportunities are comparable"
                ),
                "blind label lexical order for display only; an exact tie withholds a winner",
            ],
            "ranking_note": (
                "Peer rankings do not override the locked rubric. In balanced or otherwise "
                "unequal assignments they remain dissent evidence and cannot break a score tie."
            ),
            "orchestration_note": (
                "Seat availability, retries, and budget signals are operational evidence. "
                "They affect recommendation readiness only through an explicitly locked "
                "minimum-completion threshold and never become hidden candidate scores."
            ),
        },
        "provisional_winner": provisional_winner,
        "highest_scoring_candidate": highest_scoring_candidate,
        "exact_tie_labels": exact_tie_labels,
        "runner_up": runner_up,
        "automatic_score_margin": round(margin, 6),
        "recommendation_status": recommendation_status,
        "confidence": confidence,
        "review_count": len(reviews),
        "ranking_ballot_count": ranking_ballots,
        "comparative_ranking_ballot_count": comparative_ranking_ballots,
        "first_choice_share": round(first_choice_share, 6),
        "automatic_rubric_weight": round(automatic_total_weight, 6),
        "human_rubric_weight_pending": round(human_total_weight, 6),
        "candidates": candidate_rows,
        "criterion_awards": criterion_awards,
        "dissent": dissent,
        "pairwise_preferences": pairwise_table,
        "condorcet": condorcet,
        "ranking_comparability": ranking_comparability,
        "reviewer_audit": reviewer_audit,
        "reviewer_similarity_audit": reviewer_similarity_audit,
        "review_independence_audit": review_independence_audit,
        "orchestration_evidence": build_orchestration,
        "evidence_gaps": evidence_gaps,
        "human_decision_required": True,
    }
