#!/usr/bin/env python3
"""Optional Playwright smoke test for the bundled local studio.

Requires: pip install playwright && playwright install chromium
It makes no network requests while testing the studio.
"""
from __future__ import annotations
import argparse, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORAGE_STUB = """(() => { const s=new Map(); Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>s.has(String(k))?s.get(String(k)):null,setItem:(k,v)=>s.set(String(k),String(v)),removeItem:k=>s.delete(String(k)),clear:()=>s.clear(),key:i=>[...s.keys()][i]??null,get length(){return s.size}}});})();"""

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--chromium', help='Optional Chromium/Chrome executable path')
    parser.add_argument('--out', type=Path, default=ROOT/'reports/OPTIONAL_BROWSER_SMOKE.json')
    args = parser.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise SystemExit('Playwright is not installed. Run: pip install playwright && playwright install chromium') from exc

    html=(ROOT/'dist/AXM_AETHERFX_VISUAL_EFFECT_FABRIC_STUDIO_v1_3_0.html').read_text(encoding='utf-8')
    errors=[]
    with sync_playwright() as p:
        launch={'headless':True}
        if args.chromium: launch['executable_path']=args.chromium
        browser=p.chromium.launch(**launch)
        page=browser.new_page(viewport={'width':1600,'height':1000})
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.evaluate(STORAGE_STUB); page.set_content(html,wait_until='load')
        page.wait_for_selector('html[data-axm-ready="true"]')
        initial=page.locator('#activeStack [data-instance-id]').count()
        page.locator('[data-module-id="light.volumetric-beam"] [data-action="add-module"]').click()
        assert page.locator('#activeStack [data-instance-id]').count()==initial+1
        page.locator('[data-tab="creator"]').click(); page.locator('#creatorDerivedName').fill('Optional Smoke Beam'); page.locator('#btnCreateDerived').click()
        assert '1 custom' in page.locator('#libraryCount').inner_text()
        mobile=browser.new_page(viewport={'width':412,'height':915})
        mobile.on('pageerror',lambda e: errors.append(f'mobile: {e}'))
        mobile.evaluate(STORAGE_STUB); mobile.set_content(html,wait_until='load'); mobile.wait_for_selector('html[data-axm-ready="true"]')
        overflow=mobile.evaluate('document.documentElement.scrollWidth-innerWidth')
        mobile.locator('#mobileTools summary').click(); assert mobile.locator('.mobile-tools-menu').is_visible()
        browser.close()
    result={'ready':True,'desktopInteraction':True,'mobileOverflowPixels':overflow,'mobileTools':True,'pageErrors':errors}
    args.out.parent.mkdir(parents=True,exist_ok=True); args.out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,indent=2))
    if errors or overflow>0: raise SystemExit(1)

if __name__=='__main__': main()
