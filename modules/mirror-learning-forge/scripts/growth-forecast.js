'use strict';
const fs=require('fs'),path=require('path'),Growth=require('../core/growth-planner');
const scenarios={conservative:Growth.project({starting_sessions:10,session_growth_factor:1.25,cycles:20}),working:Growth.project({starting_sessions:10,session_growth_factor:1.6,cycles:20}),unbounded_doubling:Growth.project({starting_sessions:10,session_growth_factor:2,cycles:20})};
const out={schema:'axm.mirror.growth-scenario-report/v1',note:'Scenario calculation, not a prediction. Bounded rows apply Forge caps while uncapped rows show pressure.',scenarios};
const file=path.join(__dirname,'..','GROWTH_FORECAST_REPORT.json');fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');
for(const [name,r] of Object.entries(scenarios)){const row=r.rows[r.rows.length-1];console.log(name,'factor',r.parameters.session_growth_factor,'doubling cycles',r.doubling_time_cycles,'uncapped sessions cycle 20',Math.round(row.uncapped.sessions),'bounded promotions',row.bounded.promotions);}
console.log('Wrote',file);
