"""Fixed AXM Blender host boundary. It never evaluates code supplied by a bundle."""

import argparse
import hashlib
import json
import os
import sys

import bpy


def atomic_json(filename, value):
    folder = os.path.dirname(os.path.abspath(filename))
    os.makedirs(folder, exist_ok=True)
    temporary = filename + ".tmp"
    with open(temporary, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, sort_keys=True, separators=(",", ":"))
        handle.write("\n")
    os.replace(temporary, filename)


def sha256_file(filename):
    digest = hashlib.sha256()
    with open(filename, "rb") as handle:
        while True:
            block = handle.read(1024 * 1024)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def bounded_text(value, maximum=160):
    return str(value or "")[:maximum]


def scene_facts():
    objects = []
    for item in sorted(bpy.context.scene.objects, key=lambda candidate: candidate.name):
        mesh = item.data if item.type == "MESH" else None
        objects.append({
            "name": item.name,
            "type": item.type,
            "vertices": len(mesh.vertices) if mesh else 0,
            "polygons": len(mesh.polygons) if mesh else 0,
            "axm_bundle_id": item.get("axm_bundle_id"),
            "axm_change_digest": item.get("axm_change_digest"),
            "axm_source_digest": item.get("axm_source_digest"),
        })
    return {
        "scene": bpy.context.scene.name,
        "object_count": len(objects),
        "mesh_count": sum(1 for item in objects if item["type"] == "MESH"),
        "vertices": sum(item["vertices"] for item in objects),
        "polygons": sum(item["polygons"] for item in objects),
        "objects": objects,
        "axm_bundle_id": bpy.context.scene.get("axm_bundle_id"),
        "axm_change_digest": bpy.context.scene.get("axm_change_digest"),
        "axm_source_digest": bpy.context.scene.get("axm_source_digest"),
        "axm_metadata": dict(bpy.context.scene.get("axm_metadata", {})),
        "unit_system": bpy.context.scene.unit_settings.system,
        "unit_scale_length": bpy.context.scene.unit_settings.scale_length,
    }


def apply(request):
    source = os.path.abspath(request["source_path"])
    project = os.path.abspath(request["project_file"])
    if request.get("source_mime") != "model/gltf-binary" or not source.lower().endswith(".glb"):
        raise RuntimeError("the Blender reference adapter only imports GLB 2.0")
    if sha256_file(source) != request["source_digest"]:
        raise RuntimeError("staged source digest changed before Blender import")
    before = set(item.name for item in bpy.data.objects)
    result = bpy.ops.import_scene.gltf(filepath=source)
    if "FINISHED" not in result:
        raise RuntimeError("Blender GLB import did not finish")
    imported = [item for item in bpy.data.objects if item.name not in before]
    if not imported:
        raise RuntimeError("Blender GLB import created no objects")
    for item in imported:
        item["axm_bundle_id"] = bounded_text(request["bundle_id"])
        item["axm_change_digest"] = request["change_digest"]
        item["axm_source_digest"] = request["source_digest"]
    scene = bpy.context.scene
    scene["axm_bundle_id"] = bounded_text(request["bundle_id"])
    scene["axm_change_digest"] = request["change_digest"]
    scene["axm_source_digest"] = request["source_digest"]
    metadata = request.get("metadata", {})
    scene["axm_metadata"] = metadata
    for item in imported:
        for key, value in metadata.items():
            item[key] = value
    unit = request.get("target_canvas", {}).get("spatial", {}).get("coordinate_unit") or request.get("target_canvas", {}).get("dimensions", {}).get("unit")
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 0.001 if unit == "mm" else 1.0
    bpy.context.view_layer.update()
    os.makedirs(os.path.dirname(project), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=project, check_existing=False)
    facts = scene_facts()
    facts.update({"ok": True, "mode": "apply", "imported_object_count": len(imported)})
    return facts


def inspect(request):
    facts = scene_facts()
    matches = [item for item in facts["objects"] if item["axm_change_digest"] == request["change_digest"] and item["axm_source_digest"] == request["source_digest"]]
    facts.update({
        "ok": bool(matches) and facts["axm_change_digest"] == request["change_digest"] and facts["axm_source_digest"] == request["source_digest"],
        "mode": "inspect",
        "matching_object_count": len(matches),
    })
    return facts


def main():
    arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["apply", "inspect"], required=True)
    parser.add_argument("--request", required=True)
    parser.add_argument("--receipt", required=True)
    parsed = parser.parse_args(arguments)
    with open(parsed.request, "r", encoding="utf-8") as handle:
        request = json.load(handle)
    required = ["bundle_id", "change_digest", "source_digest", "project_file"]
    if any(not request.get(field) for field in required):
        raise RuntimeError("fixed Blender request is incomplete")
    result = apply(request) if parsed.mode == "apply" else inspect(request)
    result["blender_version"] = ".".join(str(item) for item in bpy.app.version)
    result["project_file"] = os.path.abspath(request["project_file"])
    result["project_digest"] = sha256_file(result["project_file"])
    atomic_json(parsed.receipt, result)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        sys.stderr.write("AXM_BLENDER_ADAPTER_ERROR:" + bounded_text(error, 500) + "\n")
        sys.exit(17)
