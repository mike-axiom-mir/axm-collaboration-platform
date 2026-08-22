class_name AXMUniversalObject
extends Node

# AXM Universal Object Fabric v0.7 — Godot 4 helper.
# Reads contracts and builds local scene groups. It does not modify project files,
# choose final collision policy, or control physical machinery.

static func read_json(path: String) -> Dictionary:
    var file := FileAccess.open(path, FileAccess.READ)
    if file == null:
        push_error("AXM could not open: %s" % path)
        return {}
    var parsed = JSON.parse_string(file.get_as_text())
    if typeof(parsed) != TYPE_DICTIONARY:
        push_error("AXM expected a JSON object: %s" % path)
        return {}
    return parsed

static func resolve_relative(base_file: String, relative: String) -> String:
    return base_file.get_base_dir().path_join(relative).simplify_path()

static func runtime_capsule_reference(manifest: Dictionary) -> String:
    var reference = manifest.get("runtime_capsule")
    if reference == null:
        var contracts: Dictionary = manifest.get("contracts", {})
        reference = contracts.get("runtime_capsule")
    if reference == null:
        var outputs: Dictionary = manifest.get("industry_outputs", {})
        reference = outputs.get("runtime_capsule")
    return str(reference) if reference != null else ""

static func lod_records(contract_set: Dictionary) -> Array:
    var runtime_capsule: Dictionary = contract_set.get("runtime_capsule", {})
    if not runtime_capsule.is_empty():
        var capsule_lods: Dictionary = runtime_capsule.get("lods", {})
        var records = capsule_lods.get("records", [])
        return records if records is Array else []
    var runtime: Dictionary = contract_set.get("runtime", {})
    var models: Dictionary = runtime.get("models", {})
    var records = models.get("lods", [])
    return records if records is Array else []

static func lod_policy(contract_set: Dictionary) -> Dictionary:
    var runtime_capsule: Dictionary = contract_set.get("runtime_capsule", {})
    if not runtime_capsule.is_empty():
        var capsule_lods: Dictionary = runtime_capsule.get("lods", {})
        var policy = capsule_lods.get("policy", {})
        return policy if policy is Dictionary else {}
    var runtime: Dictionary = contract_set.get("runtime", {})
    var policy = runtime.get("lod_policy", {})
    return policy if policy is Dictionary else {}

static func load_contract_set(object_manifest_path: String, package_root: String) -> Dictionary:
    var manifest := read_json(object_manifest_path)
    if manifest.is_empty():
        return {}
    var object_root := object_manifest_path.get_base_dir()
    var contracts: Dictionary = manifest.get("contracts", {})
    var outputs: Dictionary = manifest.get("industry_outputs", {})
    var assembly := read_json(object_root.path_join(str(contracts.get("assembly", ""))))
    var materials := read_json(object_root.path_join(str(contracts.get("materials", ""))))
    var game_binding := read_json(object_root.path_join(str(outputs.get("game", ""))))
    var visual_skin_path := ""
    var visual_skin: Dictionary = {}
    var visual_skin_reference := str(outputs.get("visual_skin", ""))
    if not visual_skin_reference.is_empty():
        visual_skin_path = object_root.path_join(visual_skin_reference).simplify_path()
        visual_skin = read_json(visual_skin_path)
    var runtime_capsule_path := ""
    var runtime_capsule: Dictionary = {}
    var capsule_reference := runtime_capsule_reference(manifest)
    if not capsule_reference.is_empty():
        runtime_capsule_path = object_root.path_join(capsule_reference).simplify_path()
        runtime_capsule = read_json(runtime_capsule_path)
    var runtime_reference := str(game_binding.get("runtime_manifest", ""))
    if not runtime_capsule.is_empty():
        var source_binding: Dictionary = runtime_capsule.get("source_binding", {})
        var capsule_runtime: Dictionary = source_binding.get("runtime_manifest", {})
        runtime_reference = str(capsule_runtime.get("portable_path", runtime_reference))
    var runtime_path := package_root.path_join(runtime_reference).simplify_path()
    var runtime := read_json(runtime_path)
    var models: Dictionary = runtime.get("models", {})
    var sockets: Array = []
    if not runtime_capsule.is_empty():
        var socket_contract: Dictionary = runtime_capsule.get("sockets", {})
        var capsule_sockets = socket_contract.get("records", [])
        if capsule_sockets is Array:
            sockets = capsule_sockets
    else:
        var sockets_reference := str(models.get("sockets", ""))
        if not sockets_reference.is_empty():
            var socket_manifest := read_json(runtime_path.get_base_dir().path_join(sockets_reference).simplify_path())
            var legacy_sockets = socket_manifest.get("sockets", [])
            if legacy_sockets is Array:
                sockets = legacy_sockets
    var lods: Array = lod_records({"runtime_capsule": runtime_capsule, "runtime": runtime})
    var lod0_path := ""
    if not lods.is_empty():
        lod0_path = runtime_path.get_base_dir().path_join(str(lods[0].get("file", ""))).simplify_path()
    return {
        "manifest": manifest,
        "assembly": assembly,
        "materials": materials,
        "game_binding": game_binding,
        "runtime": runtime,
        "runtime_path": runtime_path,
        "runtime_capsule": runtime_capsule,
        "runtime_capsule_path": runtime_capsule_path,
        "visual_skin": visual_skin,
        "visual_skin_path": visual_skin_path,
        "sockets": sockets,
        "lod0_path": lod0_path
    }

## Select one declared LOD record from projected screen height. This helper does
## not install camera listeners or switch an already-instantiated scene.
static func select_lod(contract_set: Dictionary, projected_screen_height: float) -> Dictionary:
    var records := lod_records(contract_set)
    if records.is_empty():
        return {}
    var ordered := records.duplicate(true)
    ordered.sort_custom(func(left, right): return int(left.get("lod", 0)) < int(right.get("lod", 0)))
    if is_nan(projected_screen_height) or is_inf(projected_screen_height) or projected_screen_height < 0.0:
        return (ordered[0] as Dictionary).duplicate(true)
    var policy := lod_policy(contract_set)
    var thresholds = policy.get("starting_screen_height_thresholds", [])
    if not thresholds is Array or thresholds.is_empty():
        return (ordered[0] as Dictionary).duplicate(true)
    var selected_index := 0
    while selected_index < ordered.size() - 1:
        if selected_index >= thresholds.size():
            break
        var threshold := float(thresholds[selected_index])
        if projected_screen_height >= threshold:
            break
        selected_index += 1
    return (ordered[selected_index] as Dictionary).duplicate(true)

## Resolve an exact, case-sensitive socket ID. Unknown IDs return an empty
## dictionary instead of a guessed transform.
static func get_socket(contract_set: Dictionary, socket_id: String) -> Dictionary:
    if socket_id.is_empty():
        return {}
    var records = contract_set.get("sockets", [])
    if not records is Array:
        return {}
    for record_value in records:
        if record_value is Dictionary and str(record_value.get("id", "")) == socket_id:
            return (record_value as Dictionary).duplicate(true)
    return {}

## List exact visual-variant IDs from the optional visual-skin sidecar.
static func available_visual_variants(contract_set: Dictionary) -> Array:
    var visual_skin: Dictionary = contract_set.get("visual_skin", {})
    var variants: Dictionary = visual_skin.get("variants", {})
    var result: Array = []
    for variant_id in variants.keys():
        result.append(str(variant_id))
    result.sort()
    return result

static func _portable_material(material_profile: String, appearance: Dictionary) -> StandardMaterial3D:
    var rgba_value = appearance.get("base_color_rgba", [180, 180, 180, 255])
    var rgba: Array = rgba_value if rgba_value is Array and rgba_value.size() >= 4 else [180, 180, 180, 255]
    var emissive_value = appearance.get("emissive_rgb", [0.0, 0.0, 0.0])
    var emissive: Array = emissive_value if emissive_value is Array and emissive_value.size() >= 3 else [0.0, 0.0, 0.0]
    var material := StandardMaterial3D.new()
    material.resource_name = "AXM_%s" % material_profile
    material.albedo_color = Color(
        clampf(float(rgba[0]) / 255.0, 0.0, 1.0),
        clampf(float(rgba[1]) / 255.0, 0.0, 1.0),
        clampf(float(rgba[2]) / 255.0, 0.0, 1.0),
        clampf(float(rgba[3]) / 255.0, 0.0, 1.0)
    )
    material.metallic = clampf(float(appearance.get("metallic", 0.0)), 0.0, 1.0)
    material.roughness = clampf(float(appearance.get("roughness", 0.6)), 0.0, 1.0)
    var transmission := clampf(float(appearance.get("transmission", 0.0)), 0.0, 1.0)
    if float(rgba[3]) < 255.0 or transmission > 0.0:
        material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
    var emission_color := Color(
        maxf(float(emissive[0]), 0.0),
        maxf(float(emissive[1]), 0.0),
        maxf(float(emissive[2]), 0.0)
    )
    if emission_color.r > 0.0 or emission_color.g > 0.0 or emission_color.b > 0.0:
        material.emission_enabled = true
        material.emission = emission_color
    if bool(appearance.get("double_sided", false)):
        material.cull_mode = BaseMaterial3D.CULL_DISABLED
    var depth_write := str(appearance.get("depth_write", "AUTO"))
    if depth_write == "ON":
        material.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_ALWAYS
    elif depth_write == "OFF":
        material.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
    return material

## Apply only generated portable-PBR material overrides. Renderer hints, layer
## slots and external capabilities are returned to the caller, never executed.
## Geometry, transforms, colliders, physics and manufacturing truth are untouched.
static func apply_visual_variant(scene_root: Node, contract_set: Dictionary, variant_id: String) -> Dictionary:
    var visual_skin: Dictionary = contract_set.get("visual_skin", {})
    if visual_skin.is_empty():
        push_error("AXM object has no visual-skin sidecar")
        return {}
    var truth_boundaries: Dictionary = visual_skin.get("truth_boundaries", {})
    if (
        bool(truth_boundaries.get("geometry_modified", true))
        or bool(truth_boundaries.get("physical_material_truth_modified", true))
        or bool(truth_boundaries.get("simulation_modified", true))
        or bool(truth_boundaries.get("manufacturing_authority", true))
    ):
        push_error("AXM visual skin exceeds portable presentation authority")
        return {}
    var variants: Dictionary = visual_skin.get("variants", {})
    if not variants.has(variant_id):
        push_error("Unknown AXM visual variant: %s" % variant_id)
        return {}
    var variant: Dictionary = variants.get(variant_id, {})
    var portable_fallback: Dictionary = variant.get("portable_fallback", {})
    var node_records = portable_fallback.get("nodes", [])
    if not node_records is Array:
        push_error("AXM visual variant has no portable node records: %s" % variant_id)
        return {}
    var applied_node_count := 0
    var missing_nodes: Array = []
    for record_value in node_records:
        if not record_value is Dictionary:
            continue
        var record: Dictionary = record_value
        var node_name := str(record.get("node", ""))
        var node := scene_root.find_child(node_name, true, false)
        if not node is MeshInstance3D:
            missing_nodes.append(node_name)
            continue
        var appearance: Dictionary = record.get("appearance", {})
        var material_profile := "%s@%s" % [str(record.get("material_profile", "material")), variant_id]
        (node as MeshInstance3D).material_override = _portable_material(material_profile, appearance)
        node.set_meta("axm_visual_variant", variant_id)
        applied_node_count += 1
    scene_root.set_meta("axm_visual_variant", variant_id)
    return {
        "status": "PASS",
        "variant_id": variant_id,
        "applied_node_count": applied_node_count,
        "missing_nodes": missing_nodes,
        "renderer_hints": (variant.get("renderer_hints", {}) as Dictionary).duplicate(true),
        "layer_slots": (variant.get("layer_slots", []) as Array).duplicate(true),
        "external_capabilities": (variant.get("external_capabilities", []) as Array).duplicate(true),
        "truth_boundaries": truth_boundaries.duplicate(true)
    }

static func apply_materials(scene_root: Node, material_manifest: Dictionary) -> void:
    for record_value in material_manifest.get("nodes", []):
        var record: Dictionary = record_value
        var node := scene_root.find_child(str(record.get("node", "")), true, false)
        if not node is MeshInstance3D:
            continue
        var appearance: Dictionary = record.get("appearance", {})
        var material_profile := str(record.get("material_profile", "material"))
        (node as MeshInstance3D).material_override = _portable_material(material_profile, appearance)
        node.set_meta("axm_material_profile", record.get("material_profile", ""))

static func build_assembly(scene_root: Node3D, assembly: Dictionary) -> Dictionary:
    var groups: Dictionary = {}
    for record_value in assembly.get("groups", []):
        var record: Dictionary = record_value
        var group := Node3D.new()
        var group_id := str(record.get("id", ""))
        group.name = "AXM_GROUP_%s" % group_id
        var pivot: Array = record.get("pivot_m", [0.0, 0.0, 0.0])
        group.position = Vector3(float(pivot[0]), float(pivot[1]), float(pivot[2]))
        scene_root.add_child(group)
        groups[group_id] = group
        for node_name in record.get("members", []):
            var member := scene_root.find_child(str(node_name), true, false)
            if member is Node3D and member != group:
                (member as Node3D).reparent(group, true)

    for joint_value in assembly.get("joints", []):
        var joint: Dictionary = joint_value
        var parent: Node3D = groups.get(str(joint.get("parent_group", "")))
        var child: Node3D = groups.get(str(joint.get("child_group", "")))
        if parent != null and child != null and child.get_parent() != parent:
            child.reparent(parent, true)

    for group_value in groups.values():
        var group: Node3D = group_value
        group.set_meta("axm_base_position", group.position)
        group.set_meta("axm_base_quaternion", group.quaternion)

    var joints: Dictionary = {}
    for joint_value in assembly.get("joints", []):
        var joint: Dictionary = joint_value
        var joint_id := str(joint.get("id", ""))
        joints[joint_id] = {"contract": joint, "group": groups.get(str(joint.get("child_group", ""))), "value": float(joint.get("default", 0.0))}
    return {"groups": groups, "joints": joints}

static func clamp_joint_value(joint: Dictionary, requested: float) -> float:
    if joint.get("type", "") == "continuous":
        return requested
    var limits: Dictionary = joint.get("limits", {})
    if limits.has("min") and limits.has("max"):
        return clampf(requested, float(limits.get("min")), float(limits.get("max")))
    return requested

static func apply_joint(group: Node3D, joint: Dictionary, requested: float) -> float:
    var value := clamp_joint_value(joint, requested)
    var axis_values: Array = joint.get("axis", [0.0, 1.0, 0.0])
    var axis := Vector3(float(axis_values[0]), float(axis_values[1]), float(axis_values[2])).normalized()
    var base_position: Vector3 = group.get_meta("axm_base_position", group.position)
    var base_quaternion: Quaternion = group.get_meta("axm_base_quaternion", group.quaternion)
    var joint_type := str(joint.get("type", ""))
    if joint_type == "revolute" or joint_type == "continuous":
        group.quaternion = base_quaternion * Quaternion(axis, deg_to_rad(value))
    elif joint_type == "prismatic":
        group.position = base_position + axis * value
    return value
