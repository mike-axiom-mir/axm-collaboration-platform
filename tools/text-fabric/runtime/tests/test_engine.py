from axm_text_fabric.engine import TextFabricEngine

def run():
    e = TextFabricEngine()
    plan = e.resolve({'text':'MISSION COMPLETE','role':'game_reward_title','mood':'reward','platform':'game_tv','background':'dynamic'})
    assert plan['resolved']['recipe'] == 'game_reward'
    assert plan['resolved']['size_px'] >= 44
    assert plan['resolved']['effects']['plate']['enabled'] is True
    assert plan['resolved']['rendering_strategy'] in {'SDF','MSDF'}
    assert plan['adapter']['kind'] == 'generic_game'
    gold = e.resolve({'text':'GOLDEN VICTORY','role':'display','mood':'gold','platform':'web','background':'dynamic'})
    assert gold['resolved']['recipe'] == 'molten_gold'
    assert gold['resolved']['effects']['sheen']['enabled'] is True
    glitch = e.resolve({'text':'SYSTEM BREACH','role':'display','mood':'glitch','platform':'web','background':'dynamic'})
    assert glitch['resolved']['recipe'] == 'readable_glitch'
    assert glitch['resolved']['effects']['glitch']['enabled'] is True
    tiny = e.resolve({'text':'tiny','role':'body','mood':'glitch','platform':'web','background':'solid'})
    assert tiny['resolved']['effects']['glitch']['enabled'] is False
