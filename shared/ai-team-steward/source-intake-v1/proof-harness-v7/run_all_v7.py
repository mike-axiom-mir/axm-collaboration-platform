import json
from axm_team_harness.runner_v7 import run_all_v7
print(json.dumps(run_all_v7(),indent=2,sort_keys=True))
