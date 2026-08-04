from __future__ import annotations
import json,tempfile,textwrap,unittest
from pathlib import Path
from tools.authority_audit_lib import scan_file,scan_root
ROOT=Path(__file__).resolve().parents[1]
class Run41AuthorityAuditTests(unittest.TestCase):
    def test_current_tree_clean(self): self.assertEqual(scan_root(ROOT)['issues'],[])
    def test_shadow_implementations_absent(self): self.assertEqual(scan_root(ROOT)['shadow_implementations'],[])
    def check(self,code):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'x.py'; p.write_text(textwrap.dedent(code),encoding='utf-8'); return scan_file(p)
    def test_socket_import_caught(self): self.assertTrue(self.check('import socket'))
    def test_subprocess_from_caught(self): self.assertTrue(self.check('from subprocess import run'))
    def test_eval_caught(self): self.assertTrue(self.check('x=eval("1")'))
    def test_exec_caught(self): self.assertTrue(self.check('exec("x=1")'))
    def test_open_caught(self): self.assertTrue(self.check('open("x")'))
    def test_os_system_caught(self): self.assertTrue(self.check('import os\nos.system("x")'))
    def test_write_text_caught(self): self.assertTrue(self.check('p.write_text("x")'))
    def test_pure_code_allowed(self): self.assertEqual(self.check('def run(x):\n return {"x":x}'),[])
if __name__=='__main__': unittest.main()
