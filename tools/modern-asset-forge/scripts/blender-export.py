import argparse
import os
import sys

import bpy


def arguments_after_separator():
    if "--" not in sys.argv:
        raise RuntimeError("Modern Asset Forge Blender stage requires arguments after --")
    return sys.argv[sys.argv.index("--") + 1 :]


parser = argparse.ArgumentParser()
parser.add_argument("--output", required=True)
args = parser.parse_args(arguments_after_separator())
output = os.path.abspath(args.output)
if os.path.splitext(output)[1].lower() != ".glb":
    raise RuntimeError("Blender export target must end in .glb")
os.makedirs(os.path.dirname(output), exist_ok=True)

# Keep Blender as authoring truth and emit one self-contained runtime GLB.
# Defaults intentionally preserve meshes, PBR materials, skins, morphs, and animations.
bpy.ops.export_scene.gltf(filepath=output, export_format="GLB")
if not os.path.isfile(output) or os.path.getsize(output) <= 20:
    raise RuntimeError("Blender did not create a non-empty GLB")
print("AXM_MODERN_FORGE_EXPORT_OK")
