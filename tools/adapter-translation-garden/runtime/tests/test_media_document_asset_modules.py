from __future__ import annotations
import io
import unittest
import zipfile
from tools.module_loader import load_implementation


class MediaDocumentAssetTests(unittest.TestCase):
    def test_054_alpha_drop_refuses(self):
        m=load_implementation(54); r=m.run({'alpha_mode':'straight'},{'alpha_mode':'none'}); self.assertEqual(r['verdict'],'REFUSE')
    def test_054_explicit_flatten_is_partial(self):
        m=load_implementation(54); r=m.run({'alpha_mode':'straight'},{'alpha_mode':'none'},flatten_background=[1,1,1]); self.assertEqual(r['verdict'],'PARTIAL')
    def test_054_premultiply_pixel(self):
        m=load_implementation(54); r=m.convert_alpha_pixel([1,.5,0,.5],source_mode='straight',target_mode='premultiplied'); self.assertEqual(r['pixel'],[.5,.25,0.0,.5])
    def test_054_zero_alpha_unpremultiply_is_visible(self):
        m=load_implementation(54); r=m.convert_alpha_pixel([0,0,0,0],source_mode='premultiplied',target_mode='straight'); self.assertIsNotNone(r['note'])
    def test_054_bit_depth_loss(self):
        m=load_implementation(54); r=m.run({'alpha_mode':'none','bit_depth':16},{'alpha_mode':'none','bit_depth':8}); self.assertTrue(any(x['kind']=='bit_depth_reduction' for x in r['losses']))

    def test_055_exact_sample_time(self):
        m=load_implementation(55); r=m.sample_time(48000,48000); self.assertEqual((r['numerator'],r['denominator']),(1,1))
    def test_055_tick_mapping_exact(self):
        m=load_implementation(55); r=m.map_ticks(48000,'1/48000','1/1000'); self.assertEqual(r['integer_ticks'],1000)
    def test_055_channel_change_without_map_refuses(self):
        m=load_implementation(55); r=m.run({'channels':['L','R']},{'channels':['mono']}); self.assertEqual(r['verdict'],'REFUSE')
    def test_055_unmapped_channel_is_visible(self):
        m=load_implementation(55); r=m.run({'channels':['L','R']},{'channels':['M']},channel_map={'L':'M'}); self.assertTrue(r['losses'])
    def test_055_lossy_target(self):
        m=load_implementation(55); r=m.run({'codec':'flac'},{'codec':'mp3','codec_lossless':False}); self.assertTrue(any(x['kind']=='lossy_codec_target' for x in r['losses']))

    def test_056_exact_timebase(self):
        m=load_implementation(56); r=m.map_timestamp(25,source_timebase='1/25',target_timebase='1/1000'); self.assertEqual(r['ticks'],1000)
    def test_056_fraction_refuses_by_default(self):
        m=load_implementation(56); r=m.map_timestamp(1,source_timebase='1/24',target_timebase='1/1000'); self.assertFalse(r['ok'])
    def test_056_rounding_is_visible(self):
        m=load_implementation(56); r=m.map_timestamp(1,source_timebase='1/24',target_timebase='1/1000',rounding='nearest'); self.assertEqual(r['loss'],'timestamp_rounded')
    def test_056_vfr_collapse_loss(self):
        m=load_implementation(56); r=m.run({'variable_frame_rate':True},{'variable_frame_rate':False}); self.assertTrue(r['losses'])

    def test_057_preserves_supported_tree(self):
        m=load_implementation(57); doc={'type':'document','children':[{'type':'paragraph','text':'hi'}]}; r=m.run(doc,supported_types=['document','paragraph']); self.assertEqual(r['verdict'],'PASS')
    def test_057_sidecars_unsupported(self):
        m=load_implementation(57); doc={'type':'document','children':[{'type':'formula','value':'x'}]}; r=m.run(doc,supported_types=['document']); self.assertEqual(r['verdict'],'PARTIAL'); self.assertEqual(r['sidecar'][0]['node']['type'],'formula')
    def test_057_refusal_mode(self):
        m=load_implementation(57); doc={'type':'document','children':[{'type':'formula'}]}; r=m.run(doc,supported_types=['document'],unsupported_policy='refuse'); self.assertEqual(r['verdict'],'REFUSE')

    def test_058_valid_minimal_gltf(self):
        m=load_implementation(58); r=m.run({'asset':{'version':'2.0'},'scenes':[{'nodes':[0]}],'nodes':[{}]}); self.assertTrue(r['ok'])
    def test_058_bad_node_reference(self):
        m=load_implementation(58); r=m.run({'asset':{'version':'2.0'},'scenes':[{'nodes':[2]}],'nodes':[{}]}); self.assertFalse(r['ok'])
    def test_058_path_traversal_blocked(self):
        m=load_implementation(58); r=m.run({'asset':{'version':'2.0'},'buffers':[{'uri':'../secret.bin'}]}); self.assertEqual(r['verdict'],'REFUSE')
    def test_058_unknown_extension_visible(self):
        m=load_implementation(58); r=m.run({'asset':{'version':'2.0'},'extensionsUsed':['VENDOR_x']}); self.assertIn('VENDOR_x',r['unknown_extensions'])

    def test_059_layer_cycle_refuses(self):
        m=load_implementation(59); scene={'root_layer':'a','layers':[{'id':'a','sublayers':['b']},{'id':'b','sublayers':['a']}]}; r=m.run(scene); self.assertEqual(r['verdict'],'REFUSE')
    def test_059_missing_layer_refuses(self):
        m=load_implementation(59); r=m.run({'root_layer':'a','layers':[{'id':'a','sublayers':['missing']}]}); self.assertFalse(r['ok'])
    def test_059_flatten_is_plan_only(self):
        m=load_implementation(59); r=m.run({'root_layer':'a','layers':[{'id':'a'}]},flatten=True); self.assertEqual(r['verdict'],'PARTIAL'); self.assertFalse(r['usd_runtime_invoked'])
    def test_059_variants_inventory(self):
        m=load_implementation(59); r=m.run({'root_layer':'a','layers':[{'id':'a'}],'prims':[{'path':'/Car','variants':{'color':['red','blue']}}]}); self.assertEqual(r['variants'][0]['set'],'color')

    def _zip(self, entries):
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w') as z:
            for name,data in entries: z.writestr(name,data)
        return out.getvalue()
    def test_060_safe_zip(self):
        m=load_implementation(60); r=m.run(self._zip([('a.txt','x')])); self.assertEqual(r['verdict'],'PASS'); self.assertFalse(r['extracted'])
    def test_060_traversal_refuses(self):
        m=load_implementation(60); r=m.run(self._zip([('../a.txt','x')])); self.assertEqual(r['verdict'],'REFUSE')
    def test_060_invalid_zip_refuses(self):
        m=load_implementation(60); r=m.run(b'no'); self.assertEqual(r['verdict'],'REFUSE')
    def test_060_plan_does_not_extract(self):
        m=load_implementation(60); report=m.run(self._zip([('a.txt','x')])); plan=m.plan_translate(report,target_format='directory-manifest'); self.assertFalse(plan['performed'])

if __name__=='__main__': unittest.main()
