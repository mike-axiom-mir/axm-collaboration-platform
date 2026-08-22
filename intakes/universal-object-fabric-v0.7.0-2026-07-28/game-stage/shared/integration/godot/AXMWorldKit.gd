class_name AXMWorldKit
extends Node

# Godot 4 world-kit loader. Imported GLB files must be available under res:// or
# another path Godot can load as PackedScene. Source-clone mode reuses each asset.

static func instantiate_source_world(world_manifest_path: String, package_root: String) -> Node3D:
    var manifest := AXMUniversalObject.read_json(world_manifest_path)
    var world := Node3D.new()
    world.name = str(manifest.get("world_id", "AXM_WORLD"))
    var cache: Dictionary = {}
    for instance_value in manifest.get("instances", []):
        var instance: Dictionary = instance_value
        var runtime_path := package_root.path_join(str(instance.get("source_runtime_manifest", ""))).simplify_path()
        var runtime: Dictionary = cache.get(runtime_path, {})
        if runtime.is_empty():
            runtime = AXMUniversalObject.read_json(runtime_path)
            cache[runtime_path] = runtime
        var lods: Array = runtime.get("models", {}).get("lods", [])
        if lods.is_empty():
            push_warning("AXM world instance has no LOD0: %s" % str(instance.get("id", "")))
            continue
        var model_path := runtime_path.get_base_dir().path_join(str(lods[0].get("file", ""))).simplify_path()
        var packed := load(model_path) as PackedScene
        if packed == null:
            push_warning("AXM could not load imported GLB: %s" % model_path)
            continue
        var object := packed.instantiate() as Node3D
        object.name = str(instance.get("id", "AXM_INSTANCE"))
        var position: Array = instance.get("position_m", [0.0, 0.0, 0.0])
        object.position = Vector3(float(position[0]), float(position[1]), float(position[2]))
        object.rotation.y = deg_to_rad(float(instance.get("rotation_y_deg", 0.0)))
        object.set_meta("axm_instance", instance)
        world.add_child(object)
    return world
