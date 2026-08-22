from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"metamorphic_relation_oracle.py";s=importlib.util.spec_from_file_location("metamorphic_relation_oracle",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def c(op,b,t,**r):return [{"case_id":"c","base_output":b,"transformed_output":t,"relation":{"operator":op,**r}}]
def test_equal():assert m.MetamorphicRelationOracle("o").evaluate(c("equal",{"x":1},{"x":1}))["verdict_state"]=="PASS"
def test_not_equal():assert m.MetamorphicRelationOracle("o").evaluate(c("not_equal",1,2))["verdict_state"]=="PASS"
def test_non_decreasing():assert m.MetamorphicRelationOracle("o").evaluate(c("monotonic_non_decreasing",1,2))["verdict_state"]=="PASS"
def test_non_increasing_fail():assert m.MetamorphicRelationOracle("o").evaluate(c("monotonic_non_increasing",1,2))["verdict_state"]=="FAIL"
def test_scale_with_tolerance():assert m.MetamorphicRelationOracle("o").evaluate(c("scale_by",2,4.01,factor=2,absolute_tolerance=.02))["verdict_state"]=="PASS"
def test_permutation_invariant():assert m.MetamorphicRelationOracle("o").evaluate(c("permutation_invariant",[1,{"a":2}],[{"a":2},1]))["verdict_state"]=="PASS"
def test_subset():assert m.MetamorphicRelationOracle("o").evaluate(c("subset",[1,2,3],[2,3]))["verdict_state"]=="PASS"
def test_length_delta():assert m.MetamorphicRelationOracle("o").evaluate(c("length_delta",[1],[1,2],delta=1))["verdict_state"]=="PASS"
def test_duplicate_case_refused():raises(m.MetamorphicOracleError,lambda:m.MetamorphicRelationOracle("o").evaluate(c("equal",1,1)*2))
def test_unsupported_relation_refused():raises(m.MetamorphicOracleError,lambda:m.MetamorphicRelationOracle("o").evaluate(c("magic",1,1)))
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} metamorphic-relation-oracle tests")
if __name__=="__main__":run()
