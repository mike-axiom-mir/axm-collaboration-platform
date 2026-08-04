from html.parser import HTMLParser
from pathlib import Path

class Collector(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=set(); self.scripts=0
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if "id" in attrs: self.ids.add(attrs["id"])
        if tag == "script": self.scripts += 1

def run():
    path=Path(__file__).resolve().parents[1]/"LAYOUT_STRESS_LAB.html"
    text=path.read_text(encoding="utf-8")
    parser=Collector(); parser.feed(text)
    required={"text","mode","role","width","size","lines","safe","frameViewport","frame","sample","metrics"}
    assert required.issubset(parser.ids), sorted(required-parser.ids)
    assert parser.scripts >= 1
    assert "pseudo" in text and "overflow risk" in text
    assert "overflow-x: auto" in text
    assert "fitInitialWidth" in text
