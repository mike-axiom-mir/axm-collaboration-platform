from axm_translation_core import diff_values

def run(source, target):
    return {"changes": diff_values(source, target)}
