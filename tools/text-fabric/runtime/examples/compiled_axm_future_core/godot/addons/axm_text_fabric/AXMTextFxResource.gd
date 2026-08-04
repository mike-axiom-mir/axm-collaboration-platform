extends Resource
class_name AXMTextFxResource

@export var base_color: Color = Color(1, 1, 1, 1)
@export var glow_color: Color = Color(0.23, 0.91, 1.0, 1)
@export_range(0.0, 4.0, 0.05) var glow_power: float = 1.0
@export var glitch_red: Color = Color(1.0, 0.28, 0.55, 0.55)
@export var glitch_cyan: Color = Color(0.18, 0.94, 1.0, 0.65)
@export_range(0.0, 6.0, 0.05) var glitch_offset_px: float = 2.0
@export_range(0.0, 1.5, 0.05) var glitch_intensity: float = 0.4
@export_range(0.0, 1.0, 0.01) var scanline_opacity: float = 0.08
