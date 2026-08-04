from __future__ import annotations
import unittest
from tools.module_loader import load_implementation

class FormatLegacyTests(unittest.TestCase):
    def test_051_png_probe(self):
        m=load_implementation(51); r=m.run(b'\x89PNG\r\n\x1a\nmore',filename='x.png'); self.assertEqual(r['detected']['format'],'png')
    def test_051_executable_flag(self):
        m=load_implementation(51); r=m.run(b'MZ'+b'0'*20,filename='x.exe'); self.assertTrue(r['detected']['executable_like']); self.assertFalse(r['executable_content_executed'])
    def test_051_declared_mismatch(self):
        m=load_implementation(51); r=m.run(b'%PDF-1.7',declared_type='image/png'); self.assertTrue(r['warnings'])
    def test_052_byte_exact(self):
        m=load_implementation(52); r=m.run(b'abc',lambda x:x.hex(),lambda x:bytes.fromhex(x)); self.assertEqual(r['verdict'],'PASS_BYTE_EXACT')
    def test_052_semantic_only(self):
        m=load_implementation(52); r=m.run({'x':1},lambda x:[x['x']],lambda x:{'value':x[0]},semantic_projector=lambda x:list(x.values())[0]); self.assertEqual(r['verdict'],'PASS_SEMANTIC_ONLY')
    def test_052_mutation_fails(self):
        m=load_implementation(52)
        def f(x): x.append(2); return x
        r=m.run([1],f,lambda x:x); self.assertEqual(r['verdict'],'FAIL')
    def test_053_sidecar_validates(self):
        m=load_implementation(53); s=m.create({'x':1},target_ref='out.json',unsupported_metadata={'legacy':1}); self.assertTrue(m.validate(s,{'x':1})['valid'])
    def test_053_source_mismatch(self):
        m=load_implementation(53); s=m.create({'x':1},target_ref='out.json'); self.assertFalse(m.validate(s,{'x':2})['valid'])
    def test_053_merge_conflict_visible(self):
        m=load_implementation(53); a=m.create({'x':1},target_ref='a',color_profile='p1'); b=m.create({'x':1},target_ref='a',color_profile='p2'); self.assertFalse(m.merge([a,b])['ok'])
    def test_061_utf8_selected(self):
        m=load_implementation(61); r=m.run('café'.encode()); self.assertEqual(r['selected']['encoding'],'utf-8')
    def test_061_ambiguous_legacy(self):
        m=load_implementation(61); r=m.run(b'\x80'); self.assertTrue(r['ambiguous']); self.assertIsNone(r['decoded'])
    def test_061_preferred_resolves(self):
        m=load_implementation(61); r=m.run(b'\x80',preferred='cp1252'); self.assertEqual(r['decoded'],'€')
    def test_062_posix_to_windows(self):
        m=load_implementation(62); r=m.run('/data/file.txt',source_style='posix',target_style='windows',root_map={'/':'D:'}); self.assertTrue(r['ok']); self.assertEqual(r['target_path'],'D:\\data\\file.txt')
    def test_062_reserved_name_refuses(self):
        m=load_implementation(62); r=m.run('CON.txt',source_style='windows',target_style='windows'); self.assertFalse(r['ok'])
    def test_062_reserved_name_escape(self):
        m=load_implementation(62); r=m.run('CON.txt',source_style='windows',target_style='windows',reserved_policy='escape'); self.assertTrue(r['ok']); self.assertIn('_AXM_RESERVED_',r['target_path'])
    def test_063_collision_detected(self):
        m=load_implementation(63); r=m.analyze(['Readme','README'],target_case_sensitive=False); self.assertEqual(r['collision_count'],1)
    def test_063_default_refuses(self):
        m=load_implementation(63); r=m.resolve(['Readme','README'],target_case_sensitive=False); self.assertFalse(r['ok'])
    def test_063_suffix_is_deterministic(self):
        m=load_implementation(63); a=m.resolve(['Readme','README'],target_case_sensitive=False,policy='suffix'); b=m.resolve(['Readme','README'],target_case_sensitive=False,policy='suffix'); self.assertEqual(a['mapping'],b['mapping'])
    def test_064_crlf_to_lf(self):
        m=load_implementation(64); r=m.run(b'a\r\nb\r\n',target='LF'); self.assertEqual(r['data'],b'a\nb\n')
    def test_064_binary_unchanged(self):
        m=load_implementation(64); raw=b'a\x00b'; r=m.run(raw); self.assertEqual(r['data'],raw); self.assertEqual(r['status'],'BINARY_UNCHANGED')
    def test_064_bom_preserved(self):
        m=load_implementation(64); r=m.run(b'\xef\xbb\xbfa\r\n',target='LF'); self.assertTrue(r['data'].startswith(b'\xef\xbb\xbf'))
    def test_065_arch_mismatch(self):
        m=load_implementation(65); r=m.compare({'architecture':'arm64'},{'architecture':'x86_64'}); self.assertEqual(r['verdict'],'INCOMPATIBLE')
    def test_065_runtime_minimum(self):
        m=load_implementation(65); r=m.compare({'runtime_libraries':{'python':'3.10'}},{'runtime_libraries':{'python':'3.11.2'}}); self.assertEqual(r['verdict'],'COMPATIBLE')
    def test_065_local_descriptor_no_launch(self):
        m=load_implementation(65); d=m.local_descriptor(); self.assertIn('architecture',d); self.assertFalse(m.run({'architecture':d['architecture']},d)['launch_performed'])

if __name__=='__main__': unittest.main()
