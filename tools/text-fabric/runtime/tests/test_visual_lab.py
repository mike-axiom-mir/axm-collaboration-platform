from html.parser import HTMLParser
from pathlib import Path

class Collector(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=set(); self.scripts=0; self.styles=0
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if 'id' in attrs: self.ids.add(attrs['id'])
        if tag=='script': self.scripts += 1
        if tag=='style': self.styles += 1

def run():
    path=Path(__file__).resolve().parents[1]/'START_HERE.html'
    text=path.read_text(encoding='utf-8')
    parser=Collector(); parser.feed(text)
    required={'text','recipe','role','surface','scale','glow','plate','shine','glitch','reduced','uppercase','preview','textPlate','sample','sampleCore','sampleBevel','sampleSheen','meta','cssOutput','copy','copyJson','presetSearch','categoryBar','presetGrid','presetCount','randomPreset','favoritePreset','favoritesOnly','downloadJson','selectedPresetLabel','platform','quality','saveCustom','importCustom','deleteCustom','importFile'}
    assert required.issubset(parser.ids), sorted(required-parser.ids)
    assert parser.scripts >= 1 and parser.styles >= 1
    assert 'const recipeData=' in text
    assert 'const presetData=' in text
    assert 'AXM Future Core' in text
    assert 'function renderPresets()' in text
    assert 'function applyPreset(' in text
    assert 'localStorage' in text
    assert 'Download JSON' in text
    assert 'customPresetKey' in text
    assert 'function saveCurrentCustom()' in text
    assert 'function budgetValues(' in text
