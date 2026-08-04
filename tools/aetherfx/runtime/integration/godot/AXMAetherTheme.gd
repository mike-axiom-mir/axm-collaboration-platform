## Godot 4 helper for applying an exported AXM Theme resource.
## Attach to a node, assign a target Control and a generated .tres Theme.
extends Node
class_name AXMAetherTheme

@export var target: Control
@export var theme_resource: Theme
@export var apply_to_children: bool = true

func _ready() -> void:
    apply_theme()

func apply_theme() -> void:
    if target == null:
        push_warning("AXMAetherTheme: no target Control assigned.")
        return
    if theme_resource == null:
        push_warning("AXMAetherTheme: no Theme resource assigned.")
        return
    target.theme = theme_resource
    if apply_to_children:
        _apply_recursive(target)

func _apply_recursive(node: Node) -> void:
    for child in node.get_children():
        if child is Control and child.theme == null:
            child.theme = theme_resource
        _apply_recursive(child)
