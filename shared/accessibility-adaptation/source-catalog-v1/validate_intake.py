from __future__ import annotations
import hashlib, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parent
idx=json.load((root/'PACKET_INDEX.json').open(encoding='utf-8'))
errors=[]
if idx.get('module_count')!=100 or len(idx.get('packets',[]))!=100: errors.append('module_count')
ids=[]
for p in idx['packets']:
    ids.append(p['module_id'])
    f=root/p['path']/'module.packet.json'
    if not f.exists(): errors.append('missing:'+str(f))
    else:
        h=hashlib.sha256(f.read_bytes()).hexdigest()
        if h!=p['packet_sha256']: errors.append('digest:'+p['module_id'])
        obj=json.load(f.open(encoding='utf-8'))
        if obj.get('activation_default')!='DISABLED': errors.append('activation:'+p['module_id'])
        if obj.get('real_accessibility_effect')!='NOT_PROVEN': errors.append('truth:'+p['module_id'])
if len(set(ids))!=100: errors.append('unique_ids')
packages=list((root/'packages').glob('*.json'))
if len(packages)!=idx.get('package_count'): errors.append('package_count')
result={'pass':not errors,'errors':errors,'modules':len(ids),'packages':len(packages)}
print(json.dumps(result,indent=2))
sys.exit(0 if result['pass'] else 1)
