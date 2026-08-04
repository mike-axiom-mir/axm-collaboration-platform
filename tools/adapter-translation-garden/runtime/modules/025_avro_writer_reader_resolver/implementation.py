from __future__ import annotations
import copy, hashlib, json
from typing import Any

_PROMOTIONS={('int','long'),('int','float'),('int','double'),('long','float'),('long','double'),('float','double'),('string','bytes'),('bytes','string')}


def _fp(schema: Any) -> str:
    return hashlib.sha256(json.dumps(schema,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()


def _types(value: Any) -> list[Any]:
    return value if isinstance(value,list) else [value]


def _compatible(writer: Any, reader: Any) -> tuple[bool,str]:
    for w in _types(writer):
        for r in _types(reader):
            wn=w.get('type') if isinstance(w,dict) else w; rn=r.get('type') if isinstance(r,dict) else r
            if wn==rn: return True,'exact'
            if (wn,rn) in _PROMOTIONS: return True,f'promote:{wn}->{rn}'
    return False,'incompatible'


def run(writer_schema: dict[str, Any], reader_schema: dict[str, Any], *, record: dict[str, Any] | None = None) -> dict[str, Any]:
    if writer_schema.get('type')!='record' or reader_schema.get('type')!='record':
        return {'verdict':'REFUSE','reason':'bounded prototype supports record schemas only'}
    writer_fields={f.get('name'):f for f in writer_schema.get('fields',[]) if isinstance(f,dict) and f.get('name')}
    plan=[]; errors=[]; output={}
    for reader in reader_schema.get('fields',[]):
        if not isinstance(reader,dict) or not reader.get('name'): errors.append({'reason':'invalid reader field'}); continue
        candidates=[reader['name']]+list(reader.get('aliases',[])); source_name=next((n for n in candidates if n in writer_fields),None)
        if source_name is None:
            if 'default' in reader:
                plan.append({'reader_field':reader['name'],'action':'default','value':copy.deepcopy(reader['default'])})
                if record is not None: output[reader['name']]=copy.deepcopy(reader['default'])
            else: errors.append({'reader_field':reader['name'],'reason':'missing writer field and no reader default'})
            continue
        writer=writer_fields[source_name]; ok,mode=_compatible(writer.get('type'),reader.get('type'))
        if not ok: errors.append({'reader_field':reader['name'],'writer_field':source_name,'reason':'incompatible types','writer_type':writer.get('type'),'reader_type':reader.get('type')}); continue
        plan.append({'reader_field':reader['name'],'writer_field':source_name,'action':'copy','compatibility':mode})
        if record is not None:
            if source_name not in record: errors.append({'reader_field':reader['name'],'reason':'record value absent'});
            else: output[reader['name']]=copy.deepcopy(record[source_name])
    return {'schema':'axm.translation.avro-resolution/v1','verdict':'RESOLVED' if not errors else ('PARTIAL' if plan else 'REFUSE'),'writer_fingerprint':_fp(writer_schema),'reader_fingerprint':_fp(reader_schema),'plan':plan,'errors':errors,'record':output if record is not None and not errors else None,'encoded':False}
