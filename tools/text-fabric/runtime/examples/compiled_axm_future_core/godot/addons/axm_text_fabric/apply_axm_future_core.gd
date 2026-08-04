extends Node

const TARGET_ID := "axm_future_core"
const RECIPE := "readable_glitch"

func apply_to(canvas_item: CanvasItem) -> void:
    if canvas_item == null:
        return
    var shader := load("res://addons/axm_text_fabric/axm_text_fx.gdshader")
    var material := ShaderMaterial.new()
    material.shader = shader
    material.set_shader_parameter("base_color", Color(0.956863, 0.984314, 1.000000, 1.000000))
    material.set_shader_parameter("glow_color", Color(0.231373, 0.909804, 1.000000, 1.000000))
    material.set_shader_parameter("glow_power", 0.204000)
    material.set_shader_parameter("glitch_red", Color(1.000000, 0.282353, 0.549020, 0.550000))
    material.set_shader_parameter("glitch_cyan", Color(0.176471, 0.941176, 1.000000, 0.650000))
    material.set_shader_parameter("glitch_offset_px", 2.000000)
    material.set_shader_parameter("glitch_intensity", 0.320000)
    material.set_shader_parameter("scanline_opacity", 0.080000)
    canvas_item.material = material
