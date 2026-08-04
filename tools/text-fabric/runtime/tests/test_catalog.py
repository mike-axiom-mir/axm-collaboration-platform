from axm_text_fabric.catalog import recipes, roles, presets

def run():
    assert len(recipes()) >= 13
    assert len(roles()) >= 10
    assert len(presets()) >= 24
    for key, recipe in recipes().items():
        for required in ("label","font_stack","fill","background","plate","outline","shadow","glow"):
            assert required in recipe, f"{key} missing {required}"
