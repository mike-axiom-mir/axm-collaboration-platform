#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
BASE=Path(__file__).resolve().parent

def build():
    r=json.loads((BASE/'generated'/'signal_metabolism_report.json').read_text())
    outcomes=[]
    report={'schema':'axm.gei.signal-yield-report/v1','generated_at':'2026-08-08T01:36:00Z','signals_observed':r['unique_signals'],'measured_outcomes':len(outcomes),'helped':0,'no_effect':0,'harmed':0,'unknown':0,'status':'NOT_APPLICABLE','reason':'No closed-loop intervention outcome records are linked to the precanonical signal ledger yet. Signal usefulness will be measured only after a later artifact, research result, direction, or intervention outcome is evidenced.','anti_fake_done':['A derivative candidate is not counted as help.','A correct signal is not automatically useful.','A wrong signal is not automatically useless.','HELPED, NO_EFFECT, or HARMED require retained outcome evidence.']}
    return report
if __name__=='__main__':
    x=build();(BASE/'generated'/'signal_yield_report.json').write_text(json.dumps(x,indent=2,sort_keys=True)+'\n');print(json.dumps(x,indent=2))
