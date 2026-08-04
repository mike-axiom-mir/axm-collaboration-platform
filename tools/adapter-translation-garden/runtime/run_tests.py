from __future__ import annotations
import os,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parent; shared=root/'shared'; env=dict(os.environ); env['PYTHONPATH']=os.pathsep.join([str(root),str(shared),env.get('PYTHONPATH','')])
commands=[[sys.executable, str(root / 'tools' / 'validate_garden.py')],[sys.executable, str(root / 'tools' / 'verify_assurance.py')],[sys.executable, str(root / 'tools' / 'audit_authority_surface.py')],[sys.executable, '-m', 'unittest', 'discover', '-s', str(root / 'tests'), '-v']]
for command in commands:
    result=subprocess.run(command,cwd=root,env=env)
    if result.returncode!=0: raise SystemExit(result.returncode)
print('ALL AXM TRANSLATION GARDEN TESTS: PASS')
