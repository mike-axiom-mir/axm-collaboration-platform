from pathlib import Path
import importlib.util
import sys

MODULE_PATH = Path(__file__).parents[1] / "src" / "citation_quote_fidelity_checker.py"
spec = importlib.util.spec_from_file_location("citation_quote_fidelity_checker", MODULE_PATH)
mod = importlib.util.module_from_spec(spec); sys.modules[spec.name] = mod; spec.loader.exec_module(mod)

def expect_raises(exc, fn):
    try: fn()
    except exc: return
    raise AssertionError(f"expected {exc.__name__}")

def record():
    return {"citation_id":"cit1","claim_id":"c1","claim_text":"The module is detached.","support_mode":"EXACT_TEXT","citation":{"source_id":"s1","locator":"L1-L2","quoted_text":"The module is detached.","attribution":"AXM"},"source_binding":{"source_id":"s1","locator":"L1-L2","source_excerpt":"The module is detached. It has no authority.","attribution":"AXM"}}

def test_exact_quote_and_exact_text_pass():
    r = mod.CitationQuoteFidelityChecker("q1").evaluate(record()); assert r["verdict_state"] == "PASS"
def test_source_mismatch_fails():
    x=record(); x["citation"]["source_id"]="s2"; assert mod.CitationQuoteFidelityChecker("q").evaluate(x)["verdict_state"] == "FAIL"
def test_locator_mismatch_fails():
    x=record(); x["citation"]["locator"]="L9"; assert "LOCATOR_MISMATCH" in mod.CitationQuoteFidelityChecker("q").evaluate(x)["reasons"]
def test_quote_mismatch_fails():
    x=record(); x["citation"]["quoted_text"]="invented"; assert mod.CitationQuoteFidelityChecker("q").evaluate(x)["quote_state"] == "MISMATCH"
def test_whitespace_normalized_quote_matches():
    x=record(); x["citation"]["quoted_text"]="The   module\n is detached."; r=mod.CitationQuoteFidelityChecker("q","normalized_whitespace").evaluate(x); assert r["quote_state"] == "MATCH"
def test_semantic_support_routes_to_human_review():
    x=record(); x["support_mode"]="HUMAN_REVIEW"; r=mod.CitationQuoteFidelityChecker("q").evaluate(x); assert r["verdict_state"] == "HUMAN_REVIEW" and not r["semantic_support_proven"]
def test_exact_text_absence_fails():
    x=record(); x["claim_text"]="A different claim"; assert mod.CitationQuoteFidelityChecker("q").evaluate(x)["support_state"] == "NOT_SUPPORTED"
def test_attribution_mismatch_fails():
    x=record(); x["citation"]["attribution"]="Other"; assert mod.CitationQuoteFidelityChecker("q").evaluate(x)["attribution_state"] == "MISMATCH"
def test_no_quote_is_not_applicable():
    x=record(); x["citation"].pop("quoted_text"); assert mod.CitationQuoteFidelityChecker("q").evaluate(x)["quote_state"] == "NOT_APPLICABLE"
def test_invalid_modes_refused():
    expect_raises(mod.CitationFidelityError, lambda: mod.CitationQuoteFidelityChecker("q","fuzzy")); x=record(); x["support_mode"]="MAGIC"; expect_raises(mod.CitationFidelityError, lambda: mod.CitationQuoteFidelityChecker("q").evaluate(x))

def run():
    tests=[v for n,v in sorted(globals().items()) if n.startswith("test_")]; [t() for t in tests]; print(f"PASS {len(tests)} citation-quote-fidelity-checker tests")
if __name__ == "__main__": run()
