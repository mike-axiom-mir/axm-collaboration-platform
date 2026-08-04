from __future__ import annotations
import json
from axm_team_harness.runner_v6 import run_all_v6
if __name__=='__main__': print(json.dumps(run_all_v6(),indent=2,sort_keys=True))
