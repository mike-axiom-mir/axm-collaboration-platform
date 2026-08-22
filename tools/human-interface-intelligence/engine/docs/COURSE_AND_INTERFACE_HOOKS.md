# Course and Interface Connection Hooks

This module does not build the Human Capability Atlas or courses. It exposes stable hooks:

- `capability_id`
- `learning_profile.minimum_skill_level`
- `recommended_learning_steps`
- `beginner_safe_operations`
- `advanced_operations`
- selected `interface_pattern_id`
- beginner `operation_class`
- `advanced_layer.required_knowledge`

A course system can map lessons to these identifiers without changing the capability or recommendation schemas.
