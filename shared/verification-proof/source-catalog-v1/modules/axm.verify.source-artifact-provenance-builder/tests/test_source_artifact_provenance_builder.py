from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'source_artifact_provenance_builder.py'
SPEC = importlib.util.spec_from_file_location('source_artifact_provenance_builder', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Builder=MODULE.SourceArtifactProvenanceBuilder();ARGS=([{"name":"out","digest":"sha256:o"}],[{"name":"src","digest":"sha256:s"}],{"id":"builder-1"},{"mode":"release"},{"os":"linux"},{"type":"build"})
def test_builds_statement():assert Builder.build(*ARGS)["statement_id"].startswith("sha256:")
def test_deterministic_order():
    a=Builder.build(*ARGS);b=Builder.build(ARGS[0],list(reversed(ARGS[1])),*ARGS[2:]);assert a["statement_id"]==b["statement_id"]
def test_subject_change_changes_id():assert Builder.build([{"name":"out","digest":"sha256:x"}],*ARGS[1:])["statement_id"]!=Builder.build(*ARGS)["statement_id"]
def test_multiple_subjects_sorted():assert Builder.build([{"name":"z","digest":"d"},{"name":"a","digest":"e"}],*ARGS[1:])["subjects"][0]["name"]=="a"
def test_empty_subject_refused():raises(MODULE.ProvenanceBuilderError,lambda:Builder.build([], *ARGS[1:]))
def test_duplicate_subject_refused():raises(MODULE.ProvenanceBuilderError,lambda:Builder.build(ARGS[0]+ARGS[0],*ARGS[1:]))
def test_duplicate_material_refused():raises(MODULE.ProvenanceBuilderError,lambda:Builder.build(ARGS[0],ARGS[1]+ARGS[1],*ARGS[2:]))
def test_missing_builder_refused():raises(MODULE.ProvenanceBuilderError,lambda:Builder.build(ARGS[0],ARGS[1],{},*ARGS[3:]))
def test_missing_activity_refused():raises(MODULE.ProvenanceBuilderError,lambda:Builder.build(*ARGS[:5],{}))
def test_boundary_truth():
    result=Builder.build(*ARGS);assert result["declarations_are_caller_supplied"] and result["activity_occurrence_proven"] is False and result["builder_identity_authenticated"] is False and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} source-artifact-provenance-builder tests")

if __name__ == "__main__":
    run()
