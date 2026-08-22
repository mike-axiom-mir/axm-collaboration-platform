from __future__ import annotations
import csv
import io
import re
from datetime import date,datetime
from decimal import Decimal,InvalidOperation
from typing import Any

_INT=re.compile(r'^[+-]?(0|[1-9]\d*)$')

def _kind(value: Any, decimal_separator: str) -> str:
    if value is None or value=='': return 'null'
    if isinstance(value,bool): return 'boolean'
    if isinstance(value,int): return 'integer'
    if isinstance(value,float): return 'number'
    text=str(value)
    if text.startswith('='): return 'formula_text'
    if _INT.match(text) and not (len(text.lstrip('+-'))>1 and text.lstrip('+-').startswith('0')): return 'integer'
    numeric=text.replace(decimal_separator,'.')
    try:
        number=Decimal(numeric)
        if number.is_finite() and (decimal_separator in text or '.' in numeric): return 'number'
    except InvalidOperation: pass
    try:
        parsed=datetime.fromisoformat(text.replace('Z','+00:00'))
        return 'datetime' if ('T' in text or ' ' in text) else 'date'
    except ValueError: pass
    return 'string'

def _rows(data: Any, fmt: str, delimiter: str) -> tuple[list[dict[str,Any]],list[dict[str,Any]]]:
    malformed=[]
    if fmt=='rows':
        if not isinstance(data,list) or any(not isinstance(r,dict) for r in data): raise TypeError('rows format requires list of objects')
        return data,malformed
    if fmt!='csv' or not isinstance(data,str): raise TypeError('csv format requires text')
    raw=list(csv.reader(io.StringIO(data),delimiter=delimiter))
    if not raw: return [],[]
    header=raw[0]
    duplicates=sorted({h for h in header if header.count(h)>1})
    if duplicates: malformed.append({'row':1,'kind':'duplicate_headers','values':duplicates})
    rows=[]
    for index,values in enumerate(raw[1:],start=2):
        if len(values)!=len(header): malformed.append({'row':index,'kind':'column_count','expected':len(header),'actual':len(values)})
        padded=values+['']*(len(header)-len(values)); rows.append(dict(zip(header,padded[:len(header)])))
    return rows,malformed

def run(data: Any, *, format: str='rows', delimiter: str=',', decimal_separator: str='.', sample_limit: int=1000) -> dict[str,Any]:
    rows,malformed=_rows(data,format,delimiter); sample=rows[:sample_limit]
    fields=sorted({k for row in sample for k in row})
    properties={}; conflicts=[]
    for field in fields:
        kinds=[_kind(row.get(field),decimal_separator) for row in sample]
        counts={k:kinds.count(k) for k in sorted(set(kinds))}; non_null=[k for k in kinds if k!='null']
        meaningful=set(non_null)
        if meaningful<= {'integer','number'}: inferred='number' if 'number' in meaningful else 'integer'
        elif meaningful<= {'date','datetime'}: inferred='datetime' if 'datetime' in meaningful else 'date'
        elif len(meaningful)==1: inferred=next(iter(meaningful))
        elif not meaningful: inferred='unknown'
        else: inferred='string'; conflicts.append({'field':field,'observed_types':sorted(meaningful)})
        dominant=max((counts.get(k,0) for k in meaningful),default=0); confidence=dominant/len(non_null) if non_null else 0
        properties[field]={'candidate_type':inferred,'confidence':round(confidence,4),'observed':counts,'missing_count':sum(1 for row in sample if field not in row),'nullable':counts.get('null',0)>0,'formula_present_not_evaluated':counts.get('formula_text',0)>0}
    return {'schema':'axm.translation.tabular-schema-candidate/v1','row_count':len(rows),'sampled_rows':len(sample),'properties':properties,'type_conflicts':conflicts,'malformed_rows':malformed,'assumptions':{'format':format,'delimiter':delimiter,'decimal_separator':decimal_separator},'candidate_only':True,'formulas_evaluated':False}
