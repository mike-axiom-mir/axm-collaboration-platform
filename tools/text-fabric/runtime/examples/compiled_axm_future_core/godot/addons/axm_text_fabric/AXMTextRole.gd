extends Resource
class_name AXMTextRole

@export var font_size: int = 18
@export var outline_size: int = 0
@export var uppercase: bool = false
@export_range(0.8, 2.0, 0.05) var line_height: float = 1.3
@export var letter_spacing: int = 0

func apply_to(label: Label) -> void:
    label.add_theme_font_size_override("font_size", max(font_size, 1))
    label.add_theme_constant_override("outline_size", max(outline_size, 0))
    label.text = label.text.to_upper() if uppercase else label.text
    label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
