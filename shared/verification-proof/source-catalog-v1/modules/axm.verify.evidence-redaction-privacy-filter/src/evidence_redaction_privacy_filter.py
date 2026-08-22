"""Detached AXM Evidence Redaction and Privacy Filter v0.1.0."""
from __future__ import annotations
import hashlib,json
from typing import Any,Dict,Mapping,Sequence

ACTIONS={"keep","drop","mask","hash","generalize"};DROP=object()
class EvidenceRedactionError(ValueError):pass

def _parts(path:str)->tuple[str,...]:
    if not isinstance(path,str) or not path.startswith("/"):raise EvidenceRedactionError("rule paths must be absolute slash paths")
    return tuple(item for item in path.split("/")[1:] if item!="")

def _matches(pattern:tuple[str,...],path:tuple[str,...])->bool:return len(pattern)==len(path) and all(a==b or a=="*" for a,b in zip(pattern,path))
def _canonical(value:Any)->bytes:
    try:return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode()
    except (TypeError,ValueError) as exc:raise EvidenceRedactionError("evidence must be JSON-compatible") from exc

def _generalize(value:Any)->Any:
    if value is None:return {"type":"null"}
    if isinstance(value,bool):return {"type":"boolean"}
    if isinstance(value,(int,float)) and not isinstance(value,bool):
        magnitude=0 if value==0 else 10**max(0,len(str(abs(int(value))))-1)
        return {"type":"number","bucket_start":0 if magnitude==0 else (int(value)//magnitude)*magnitude,"bucket_size":magnitude}
    if isinstance(value,str):return {"type":"text","length":len(value)}
    return {"type":type(value).__name__}

def _exists(value:Any,path:tuple[str,...])->bool:
    current=value
    for part in path:
        if isinstance(current,dict) and part in current:current=current[part]
        elif isinstance(current,list) and part.isdigit() and int(part)<len(current):current=current[int(part)]
        else:return False
    return True

class EvidenceRedactionPrivacyFilter:
    def filter(self,evidence:Any,rules:Sequence[Mapping[str,Any]],default_action:str="drop",required_paths:Sequence[str]|None=None)->Dict[str,Any]:
        _canonical(evidence)
        if default_action not in ACTIONS:raise EvidenceRedactionError("invalid default action")
        compiled=[]
        for index,rule in enumerate(rules):
            if not isinstance(rule,Mapping) or rule.get("action") not in ACTIONS:raise EvidenceRedactionError("invalid redaction rule")
            compiled.append((_parts(rule.get("path")),rule,index))
        audit=[]
        def choose(path):
            candidates=[item for item in compiled if _matches(item[0],path)]
            return max(candidates,key=lambda x:(sum(part!="*" for part in x[0]),x[2]))[1] if candidates else None
        def walk(value,path=()):
            rule=choose(path);action=rule.get("action") if rule else None
            if action is not None:
                audit.append({"path":"/"+"/".join(path),"action":action})
                if action=="drop":return DROP
                if action=="mask":return rule.get("replacement","***")
                if action=="hash":return {"sha256":hashlib.sha256(_canonical(value)).hexdigest()}
                if action=="generalize":return _generalize(value)
                if action=="keep":return value
            if isinstance(value,dict):
                result={}
                for key,item in value.items():
                    transformed=walk(item,path+(key,))
                    if transformed is not DROP:result[key]=transformed
                return result if result or default_action!="drop" else DROP
            if isinstance(value,list):
                result=[]
                for index,item in enumerate(value):
                    transformed=walk(item,path+(str(index),))
                    if transformed is not DROP:result.append(transformed)
                return result if result or default_action!="drop" else DROP
            audit.append({"path":"/"+"/".join(path),"action":default_action})
            if default_action=="drop":return DROP
            if default_action=="mask":return "***"
            if default_action=="hash":return {"sha256":hashlib.sha256(_canonical(value)).hexdigest()}
            if default_action=="generalize":return _generalize(value)
            return value
        output=walk(evidence)
        if output is DROP:output={}
        for path in required_paths or []:
            if not _exists(output,_parts(path)):raise EvidenceRedactionError(f"required path removed: {path}")
        return {"schema_version":"axm.verify.evidence-redaction/0.1","redacted_evidence":output,"audit":audit,"default_action":default_action,"secret_detection_performed":False,"privacy_sufficiency_proven":False,"authority":"NONE","canon":False}
