from __future__ import annotations
import ntpath
import posixpath
from pathlib import PurePosixPath, PureWindowsPath
from typing import Any

from axm_translation_core import add_loss, new_loss_ledger

_RESERVED={'CON','PRN','AUX','NUL',*(f'COM{i}' for i in range(1,10)),*(f'LPT{i}' for i in range(1,10))}


def _escape_windows(name: str) -> str:
    out=''.join(f'_AXM_{ord(ch):02X}_' if ch in '<>:"/\\|?*' or ord(ch)<32 else ch for ch in name)
    stem=out.rstrip(' .').split('.')[0].upper()
    if stem in _RESERVED or out.endswith((' ','.')): out='_AXM_RESERVED_'+out.replace(' ','_AXM_20_').replace('.','_AXM_2E_')
    return out


def run(path: str, *, source_style: str, target_style: str, root_map: dict[str,str]|None=None, reserved_policy: str='refuse', max_component: int=255, max_path: int=4096, metadata: dict[str,Any]|None=None) -> dict[str,Any]:
    if source_style not in {'posix','windows'} or target_style not in {'posix','windows'}: raise ValueError('styles must be posix or windows')
    ledger=new_loss_ledger(); root_map=root_map or {}; component_map=[]
    pure=PureWindowsPath(path) if source_style=='windows' else PurePosixPath(path)
    parts=list(pure.parts)
    if '..' in parts:
        add_loss(ledger,kind='path_traversal',path='$.path',source_value=path,reason='parent traversal is not translated',severity='blocking')
        return {'schema':'axm.translation.path-semantics/v1','ok':False,'target_path':None,'loss':ledger}
    anchor=pure.anchor
    body=[p for p in parts if p not in {anchor,'/','\\'}]
    target_root=''
    if anchor:
        normalized_anchor=anchor.rstrip('\\/')
        matches=[(src,dst) for src,dst in root_map.items() if normalized_anchor.casefold()==src.rstrip('\\/').casefold()]
        if not matches:
            add_loss(ledger,kind='unmapped_path_root',path='$.root',source_value=anchor,reason='absolute source root has no explicit target mapping',severity='blocking')
        else: target_root=matches[0][1]
    converted=[]
    for part in body:
        new=part
        if target_style=='windows':
            unsafe=any(ch in '<>:"/\\|?*' or ord(ch)<32 for ch in part) or part.rstrip(' .').split('.')[0].upper() in _RESERVED or part.endswith((' ','.'))
            if unsafe:
                if reserved_policy=='refuse':
                    add_loss(ledger,kind='windows_name_unrepresentable',path=f'$.component.{part}',source_value=part,reason='target Windows name is reserved or contains invalid characters',severity='blocking')
                    continue
                if reserved_policy=='escape':
                    new=_escape_windows(part); component_map.append({'source':part,'target':new})
                    add_loss(ledger,kind='path_component_escaped',path=f'$.component.{part}',source_value=part,target_value=new,reason='explicit reversible escape policy',severity='medium',reversible=True)
                else: raise ValueError('reserved_policy must be refuse or escape')
        if len(new)>max_component:
            add_loss(ledger,kind='path_component_too_long',path=f'$.component.{part}',source_value=len(new),target_value=max_component,reason='target component length limit exceeded',severity='blocking')
        converted.append(new)
    separator='\\' if target_style=='windows' else '/'
    relative=separator.join(converted)
    target=(target_root.rstrip('\\/')+separator+relative) if target_root else relative
    if len(target)>max_path:
        add_loss(ledger,kind='path_too_long',path='$.path',source_value=len(target),target_value=max_path,reason='target path length limit exceeded',severity='blocking')
    return {'schema':'axm.translation.path-semantics/v1','ok':not ledger['summary']['has_blocking_loss'],'target_path':target if not ledger['summary']['has_blocking_loss'] else None,'sidecar':{'source_path':path,'source_style':source_style,'target_style':target_style,'component_map':component_map,'metadata_not_applied':metadata or {}},'loss':ledger,'filesystem_touched':False}
