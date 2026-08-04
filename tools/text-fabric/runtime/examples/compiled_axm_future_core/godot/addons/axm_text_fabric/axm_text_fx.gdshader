shader_type canvas_item;
render_mode blend_mix;

uniform vec4 base_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
uniform vec4 glow_color : source_color = vec4(0.23, 0.91, 1.0, 1.0);
uniform float glow_power : hint_range(0.0, 4.0) = 1.0;
uniform vec4 glitch_red : source_color = vec4(1.0, 0.28, 0.55, 0.55);
uniform vec4 glitch_cyan : source_color = vec4(0.18, 0.94, 1.0, 0.65);
uniform float glitch_offset_px : hint_range(0.0, 6.0) = 2.0;
uniform float glitch_intensity : hint_range(0.0, 1.5) = 0.4;
uniform float scanline_opacity : hint_range(0.0, 1.0) = 0.08;
uniform float reduced_motion = 0.0;

void fragment() {
    vec4 tex = texture(TEXTURE, UV);
    COLOR = tex * base_color;

    float alpha = tex.a;
    float line = 0.5 + 0.5 * sin(UV.y * 900.0);
    float scan = mix(1.0, line, scanline_opacity);
    COLOR.rgb *= scan;

    // Keep this starter simple: use glow as a brightness lift.
    COLOR.rgb += glow_color.rgb * glow_power * alpha * 0.08;

    // Readable glitch guidance: this is intentionally subtle.
    if (glitch_intensity > 0.0) {
        vec2 px = TEXTURE_PIXEL_SIZE * glitch_offset_px;
        vec4 left_s = texture(TEXTURE, UV - vec2(px.x, 0.0));
        vec4 right_s = texture(TEXTURE, UV + vec2(px.x, 0.0));
        COLOR.rgb += glitch_red.rgb * left_s.a * glitch_intensity * 0.18;
        COLOR.rgb += glitch_cyan.rgb * right_s.a * glitch_intensity * 0.18;
    }
}
