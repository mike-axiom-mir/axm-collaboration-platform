"""Bounded fresh-process adapters for pinned AXM image, colour and MaterialX substrates."""

import hashlib
import json
import sys


def emit(value):
    print(json.dumps(value, sort_keys=True, separators=(",", ":")))


def safe_error(error):
    return str(error).replace("\\", "/").split("/")[-1][:500]


def inspect_image(filename):
    import OpenImageIO as oiio

    image = oiio.ImageInput.open(filename)
    if image is None:
        return {"pass": False, "checks": [{"name": "openimageio-read", "pass": False}], "errors": [oiio.geterror()[:500]]}
    try:
        spec = image.spec()
        report = {
            "width": int(spec.width),
            "height": int(spec.height),
            "depth": int(spec.depth),
            "channels": int(spec.nchannels),
            "format": str(spec.format),
            "channel_names": list(spec.channelnames),
            "attribute_names": sorted({str(item.name) for item in spec.extra_attribs})[:200],
        }
        checks = [
            {"name": "openimageio-read", "pass": True},
            {"name": "positive-dimensions", "pass": report["width"] > 0 and report["height"] > 0},
            {"name": "declared-channels", "pass": report["channels"] > 0},
        ]
        return {"pass": all(item["pass"] for item in checks), "checks": checks, "image": report, "errors": []}
    finally:
        image.close()


def inspect_openexr(filename, base):
    if not base.get("pass"):
        return base
    import OpenEXR

    try:
        exr = OpenEXR.File(filename, separate_channels=True)
        header = exr.header()
        channels = sorted(exr.channels().keys())
        base["openexr"] = {
            "version": str(OpenEXR.__version__),
            "channel_names": channels,
            "header_names": sorted(str(key) for key in header.keys())[:200],
        }
        base["checks"].append({"name": "openexr-read", "pass": bool(channels)})
        base["pass"] = all(item["pass"] for item in base["checks"])
        return base
    except Exception as error:
        base["checks"].append({"name": "openexr-read", "pass": False})
        base["errors"].append(safe_error(error))
        base["pass"] = False
        return base


def inspect_ocio(filename, config_filename):
    import PyOpenColorIO as ocio

    image = inspect_image(filename)
    if not image.get("pass"):
        return image
    try:
        config = ocio.Config.CreateFromFile(config_filename)
        config.validate()
        source = config.getRoleColorSpace(ocio.ROLE_SCENE_LINEAR)
        display = config.getDefaultDisplay()
        view = config.getDefaultView(display)
        processor = config.getProcessor(source, display, view, ocio.TRANSFORM_DIR_FORWARD).getDefaultCPUProcessor()
        samples = []
        for value in ([0.01, 0.05, 0.1], [0.18, 0.18, 0.18], [0.5, 0.25, 0.05]):
            samples.append({"input": value, "output": list(processor.applyRGB(value))})
        changed = all(any(abs(row["input"][i] - row["output"][i]) > 1e-7 for i in range(3)) for row in samples)
        checks = image["checks"] + [
            {"name": "ocio-config-validation", "pass": True},
            {"name": "ocio-display-processor", "pass": bool(source and display and view)},
            {"name": "numeric-transform-changed-samples", "pass": changed},
        ]
        return {
            "pass": all(item["pass"] for item in checks),
            "checks": checks,
            "image": image["image"],
            "ocio": {
                "library_version": str(ocio.__version__),
                "config_version": "%d.%d" % (config.getMajorVersion(), config.getMinorVersion()),
                "colour_space_count": len(config.getColorSpaces()),
                "source": source,
                "display": display,
                "view": view,
                "samples": samples,
            },
            "errors": [],
        }
    except Exception as error:
        return {"pass": False, "checks": image["checks"] + [{"name": "ocio-processor", "pass": False}], "image": image.get("image"), "errors": [safe_error(error)]}


def inspect_materialx(filename):
    import MaterialX as mx
    import MaterialX.PyMaterialXGenGlsl as glsl
    import MaterialX.PyMaterialXGenOsl as osl
    import MaterialX.PyMaterialXGenShader as shader

    try:
        libraries = mx.createDocument()
        loaded = mx.loadLibraries(mx.getDefaultDataLibraryFolders(), mx.getDefaultDataSearchPath(), libraries)
        document = mx.createDocument()
        document.importLibrary(libraries)
        mx.readFromXmlFile(document, filename, mx.getDefaultDataSearchPath())
        valid, message = document.validate()
        renderables = list(shader.findRenderableElements(document)) if valid else []
        generated = []
        errors = [] if valid else [str(message)[:1000]]
        if valid and not renderables:
            errors.append("no renderable MaterialX element")
        for backend, generator in (("glsl", glsl.GlslShaderGenerator.create()), ("osl", osl.OslShaderGenerator.create())):
            try:
                context = shader.GenContext(generator)
                context.registerSourceCodeSearchPath(mx.getDefaultDataSearchPath())
                result = generator.generate("axm_validation_shader", renderables[0], context)
                stages = {}
                backend_stages = (shader.VERTEX_STAGE, shader.PIXEL_STAGE) if backend == "glsl" else (shader.PIXEL_STAGE,)
                for stage in backend_stages:
                    source = result.getSourceCode(stage)
                    if source:
                        stages[stage] = {"bytes": len(source.encode("utf-8")), "sha256": hashlib.sha256(source.encode("utf-8")).hexdigest()}
                generated.append({"backend": backend, "pass": bool(stages), "stages": stages})
            except Exception as error:
                generated.append({"backend": backend, "pass": False, "stages": {}})
                errors.append(backend + ": " + safe_error(error))
        checks = [
            {"name": "materialx-document-validation", "pass": bool(valid)},
            {"name": "materialx-renderable-element", "pass": bool(renderables)},
            {"name": "glsl-shader-generation", "pass": any(item["backend"] == "glsl" and item["pass"] for item in generated)},
            {"name": "osl-shader-generation", "pass": any(item["backend"] == "osl" and item["pass"] for item in generated)},
        ]
        return {
            "pass": all(item["pass"] for item in checks),
            "checks": checks,
            "materialx": {"version": mx.getVersionString(), "libraries_loaded": len(loaded), "renderable_count": len(renderables), "generated": generated},
            "errors": errors,
        }
    except Exception as error:
        return {"pass": False, "checks": [{"name": "materialx-read", "pass": False}], "errors": [safe_error(error)]}


def main(argv):
    if len(argv) < 3:
        raise ValueError("mode and staged artifact are required")
    mode, filename = argv[1], argv[2]
    if mode == "image":
        result = inspect_image(filename)
        if filename.lower().endswith(".exr"):
            result = inspect_openexr(filename, result)
    elif mode == "ocio":
        if len(argv) != 4:
            raise ValueError("OCIO mode requires an exact config")
        result = inspect_ocio(filename, argv[3])
    elif mode == "materialx":
        result = inspect_materialx(filename)
    else:
        raise ValueError("unsupported adapter mode")
    emit(result)


if __name__ == "__main__":
    try:
        main(sys.argv)
    except Exception as error:
        emit({"pass": False, "tool_error": True, "checks": [], "errors": [safe_error(error)]})
        sys.exit(2)
