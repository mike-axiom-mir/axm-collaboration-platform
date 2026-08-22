"""Targeted v0.13 Young AI Workbench smoke test.

Runs the real HTML/CSS/JavaScript in Chromium without a network server, making it
useful in restricted or offline QA environments. Requires Python Playwright.
"""
from pathlib import Path
import json
import os
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
html=(ROOT/'index.html').read_text()
# Remove resource loads and application scripts; add them explicitly after storage is available.
html=re.sub(r'<link[^>]+(?:stylesheet|manifest|icon)[^>]*>', '', html, flags=re.I)
html=re.sub(r'<script[^>]+src="(?:model|app)\.js"[^>]*></script>', '', html, flags=re.I)
html=html.replace('src="assets/axm-builder-mark.svg"','src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 40 40%27%3E%3Crect x=%274%27 y=%274%27 width=%2732%27 height=%2732%27 rx=%279%27 fill=%27%230d1a27%27 stroke=%27%2344d7ca%27/%3E%3Cpath d=%27M12 20l8-9 8 9-8 9z%27 fill=%27none%27 stroke=%27%2344d7ca%27/%3E%3C/svg%3E"')

errors=[]; console=[]; requests=[]
with sync_playwright() as p:
    launch = {"headless": True}
    chromium_path = os.environ.get("AXM_CHROMIUM_PATH")
    if chromium_path:
        launch.update(executable_path=chromium_path, args=["--no-sandbox", "--disable-dev-shm-usage"])
    elif Path("/usr/bin/chromium").exists():
        launch.update(executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage"])
    browser = p.chromium.launch(**launch)
    context=browser.new_context(accept_downloads=True, viewport={'width':1440,'height':900})
    page=context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: console.append(f'{m.type}: {m.text}'))
    page.on('request', lambda r: requests.append(r.url))
    page.set_content(html, wait_until='domcontentloaded')
    page.evaluate("""
      () => {
        const data = new Map();
        const storage = {
          getItem(key){ return data.has(String(key)) ? data.get(String(key)) : null; },
          setItem(key,value){ data.set(String(key), String(value)); },
          removeItem(key){ data.delete(String(key)); },
          clear(){ data.clear(); },
          key(index){ return Array.from(data.keys())[index] || null; }
        };
        Object.defineProperty(storage, 'length', { get(){ return data.size; } });
        Object.defineProperty(window, 'localStorage', { configurable:true, value:storage });
      }
    """)
    page.add_style_tag(path=str(ROOT/'styles.css'))
    page.add_script_tag(path=str(ROOT/'model.js'))
    page.add_script_tag(path=str(ROOT/'app.js'))
    page.wait_for_function("window.AXMShapeableBuilder && window.AXMBuilderModel")
    assert page.evaluate('AXMShapeableBuilder.version') == '0.13.0-beta'
    # Load the dedicated starter and close the delayed first-launch dialog if it appears.
    page.evaluate("AXMShapeableBuilder.loadTemplate('young-ai-workshop')")
    page.wait_for_function("AXMShapeableBuilder.getProject().meta.templateId === 'young-ai-workshop'")
    page.wait_for_timeout(420)
    page.evaluate("document.getElementById('templateDialog').open && document.getElementById('templateDialog').close()")
    project=page.evaluate('AXMShapeableBuilder.getProject()')
    assert sum(len(project['layers'][k]['nodes']) for k in ['logic','capabilities','visual']) == 27
    val=page.evaluate('AXMShapeableBuilder.validate()')
    assert val['errors']==0 and val['warnings']==0, val
    assert page.locator('[data-axm-node-id]').count()==9
    assert page.locator('[data-axm-block-type]').count()==22
    # Open workbench.
    page.click('#aiWorkbenchButton')
    page.wait_for_function("document.getElementById('aiWorkbenchDialog').open")
    workspace=page.evaluate('AXMShapeableBuilder.generateAgentWorkspace()')
    assert workspace['schema']=='axm.agent.workspace'
    assert workspace['seat']['authority']=='PROPOSE_ONLY'
    assert len(workspace['blockCatalog'])==77
    assert len(workspace['actionProtocol']['verbs'])==17
    assert '27' in page.locator('#aiWorkspaceSummary').inner_text()
    assert 'PROPOSE ONLY' in page.locator('#aiWorkbenchDialog').inner_text()
    # Screenshot visual evidence.
    page.screenshot(path=str(ROOT/'tests/young-ai-workbench.png'), full_page=True)
    # Download workspace.
    with page.expect_download() as dl:
        page.click('#aiExportWorkspaceButton')
    download=dl.value
    assert download.suggested_filename.endswith('.axm-agent-workspace.json'), download.suggested_filename
    # The source stamp stays stable because export does not modify project semantics.
    # Validate a legal proposal through the UI.
    proposal=page.evaluate("""
      () => {
        const p=AXMShapeableBuilder.getAgentProposalTemplate();
        p.proposalId='proposal-browser-1';
        p.title='Protect the human apply gate';
        p.summary='Add one explicit invariant without changing permissions or canon.';
        p.actions=[{id:'protect-gate',verb:'add_invariant',why:'Make the shared collaboration boundary explicit in portable source.',text:'A young AI proposal remains unapplied until a human explicitly accepts it through the visible review gate.'}];
        p.tests=['Run project diagnostics after apply.','Confirm Undo removes the invariant and its review receipt.'];
        return p;
      }
    """)
    page.fill('#aiProposalText', json.dumps(proposal, indent=2))
    page.click('#aiValidateProposalButton')
    page.wait_for_selector('#aiProposalReview .ai-review-status.valid')
    assert page.locator('#aiApplyProposalButton').is_disabled()
    for sel in ['#aiCheckActions','#aiCheckAuthority','#aiCheckApply']:
        page.check(sel)
    assert page.locator('#aiApplyProposalButton').is_enabled()
    before=page.evaluate("AXMShapeableBuilder.getProject().spine.invariants.length")
    # Escape is a real cancel: it must reopen the workbench and keep source unchanged.
    page.click('#aiApplyProposalButton')
    page.wait_for_function("!document.getElementById('confirmOverlay').classList.contains('hidden')")
    assert not page.evaluate("document.getElementById('aiWorkbenchDialog').open")
    page.keyboard.press('Escape')
    page.wait_for_function("document.getElementById('confirmOverlay').classList.contains('hidden') && document.getElementById('aiWorkbenchDialog').open")
    assert page.evaluate("AXMShapeableBuilder.getProject().spine.invariants.length") == before

    # A source change during confirmation must stale-block the preflight result.
    for sel in ['#aiCheckActions','#aiCheckAuthority','#aiCheckApply']:
        if not page.locator(sel).is_checked():
            page.check(sel)
    page.click('#aiApplyProposalButton')
    page.wait_for_function("!document.getElementById('confirmOverlay').classList.contains('hidden')")
    page.evaluate("""() => {
      const input=document.getElementById('projectNameTop');
      input.value=input.value+' source-shift';
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }""")
    page.click('#confirmAcceptButton')
    page.wait_for_function("document.getElementById('aiWorkbenchDialog').open && document.querySelector('#aiProposalReview .ai-review-status.invalid')")
    assert page.evaluate("AXMShapeableBuilder.getProject().spine.invariants.length") == before
    assert page.evaluate("AXMShapeableBuilder.getProject().name.endsWith('source-shift')")

    # Rebase through a fresh source stamp, then apply as one reviewed history unit.
    proposal=page.evaluate("""
      () => {
        const p=AXMShapeableBuilder.getAgentProposalTemplate();
        p.proposalId='proposal-browser-2';
        p.title='Protect the human apply gate';
        p.summary='Add one explicit invariant without changing permissions or canon.';
        p.actions=[{id:'protect-gate',verb:'add_invariant',why:'Make the shared collaboration boundary explicit in portable source.',text:'A young AI proposal remains unapplied until a human explicitly accepts it through the visible review gate.'}];
        p.tests=['Run project diagnostics after apply.','Confirm Undo removes the invariant and its review receipt.'];
        return p;
      }
    """)
    page.fill('#aiProposalText', json.dumps(proposal, indent=2))
    page.click('#aiValidateProposalButton')
    page.wait_for_selector('#aiProposalReview .ai-review-status.valid')
    for sel in ['#aiCheckActions','#aiCheckAuthority','#aiCheckApply']:
        page.check(sel)
    page.click('#aiApplyProposalButton')
    page.wait_for_function("!document.getElementById('confirmOverlay').classList.contains('hidden')")
    page.click('#confirmAcceptButton')
    page.wait_for_function(f"AXMShapeableBuilder.getProject().spine.invariants.length === {before+1}")
    applied=page.evaluate('AXMShapeableBuilder.getProject()')
    assert len(applied['spine']['collaboration']['reviewLog'])==1
    assert any('young-ai proposal + human approval' in (x.get('actor') or '') for x in applied['ledger'])
    assert page.evaluate("document.getElementById('aiWorkbenchDialog').open")
    # Close and verify undo/redo is a single history unit.
    page.evaluate("document.getElementById('aiWorkbenchDialog').close()")
    page.click('#undoButton')
    page.wait_for_function(f"AXMShapeableBuilder.getProject().spine.invariants.length === {before}")
    undone=page.evaluate('AXMShapeableBuilder.getProject()')
    assert len(undone['spine']['collaboration']['reviewLog'])==0
    page.click('#redoButton')
    page.wait_for_function(f"AXMShapeableBuilder.getProject().spine.invariants.length === {before+1}")
    # Forbidden authority is blocked via public staging API.
    bad=page.evaluate("""
      () => {
        const p=AXMShapeableBuilder.getAgentProposalTemplate();
        p.proposalId='proposal-forbidden';p.title='Forbidden';
        p.actions=[{id:'bad',verb:'grant_permission',why:'Attempt forbidden authority.'}];
        return AXMShapeableBuilder.stageAgentProposal(p);
      }
    """)
    assert bad['valid'] is False
    page.wait_for_selector('#aiProposalReview .ai-review-status.invalid')
    assert page.locator('#aiApplyProposalButton').is_disabled()
    # Stable focus API maps IDs back to the visual canvas.
    node_id=page.evaluate("AXMShapeableBuilder.getProject().layers.visual.nodes[0].id")
    assert page.evaluate('(id)=>AXMShapeableBuilder.focusNode(id)', node_id)
    assert page.evaluate("AXMShapeableBuilder.getProject().layers.visual.nodes.some(n=>n.id===document.querySelector('[data-axm-node-id][aria-selected=true]').dataset.axmNodeId)")
    page.evaluate("document.getElementById('aiWorkbenchDialog').open && document.getElementById('aiWorkbenchDialog').close()")
    selected_before = page.evaluate("(id)=>AXMShapeableBuilder.getProject().layers.visual.nodes.find(n=>n.id===id).x", node_id)
    page.locator('[data-axm-node-id][aria-selected="true"]').press('ArrowRight')
    page.wait_for_function("([id,x])=>AXMShapeableBuilder.getProject().layers.visual.nodes.find(n=>n.id===id).x===x+10", arg=[node_id, selected_before])
    # Responsive workbench remains usable on a narrow phone-sized viewport.
    page.set_viewport_size({'width': 390, 'height': 844})
    page.click('#aiWorkbenchButton')
    page.wait_for_function("document.getElementById('aiWorkbenchDialog').open")
    mobile_fit = page.evaluate("""() => {
      const shell=document.querySelector('.ai-workbench-shell');
      const grid=document.querySelector('.ai-workbench-grid');
      const footer=document.querySelector('.ai-footer-note');
      const proposalPane=document.querySelector('.ai-proposal-pane');
      shell.scrollTop=0;
      return {
        shellWidth: shell.scrollWidth,
        viewportWidth: shell.clientWidth,
        shellScrollHeight: shell.scrollHeight,
        shellClientHeight: shell.clientHeight,
        applyVisible: document.getElementById('aiApplyProposalButton').getBoundingClientRect().width > 0,
        footerAfterGrid: footer.getBoundingClientRect().top >= grid.getBoundingClientRect().bottom - 1,
        footerAfterProposal: footer.getBoundingClientRect().top >= proposalPane.getBoundingClientRect().bottom - 1
      };
    }""")
    assert mobile_fit['shellWidth'] <= mobile_fit['viewportWidth'] + 2, mobile_fit
    assert mobile_fit['shellScrollHeight'] > mobile_fit['shellClientHeight'], mobile_fit
    assert mobile_fit['applyVisible']
    assert mobile_fit['footerAfterGrid'] and mobile_fit['footerAfterProposal'], mobile_fit
    page.screenshot(path=str(ROOT/'tests/young-ai-workbench-mobile.png'), full_page=True)
    # No unexpected external requests from the app shell.
    external=[u for u in requests if u.startswith(('http://','https://'))]
    assert not external, external
    if errors:
        raise AssertionError('Page errors: '+repr(errors))
    print('PASS browser workbench smoke')
    print('console messages:', console[-8:])
    print('requests:', requests)
    browser.close()
