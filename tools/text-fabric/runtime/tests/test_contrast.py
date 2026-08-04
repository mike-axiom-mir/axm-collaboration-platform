from axm_text_fabric.contrast import contrast_ratio

def run():
    assert round(contrast_ratio("#FFFFFF", "#000000"), 2) == 21.00
    assert contrast_ratio("#F5F7FB", "#11151C") > 4.5
