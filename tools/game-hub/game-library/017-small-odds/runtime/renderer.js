import { LOCATIONS, ACTORS, DISTRICT_RESIDENTS, DISTRICT_SUPPLIER, NEIGHBORHOOD_WORKS, NEIGHBORHOOD_COMMONS } from './game-data.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

function rounded(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillEllipse(ctx, x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

function seeded(index) {
  const value = Math.sin(index * 138.123 + 91.73) * 43758.5453;
  return value - Math.floor(value);
}

function districtPhase(hour) {
  const fixed = ((Number(hour) || 0) % 24 + 24) % 24;
  return fixed < 6 ? 'deepnight' : fixed < 12 ? 'foreglow' : fixed < 18 ? 'highglow' : 'afterglow';
}

function districtSupplierBand(state) {
  const standing=Math.max(-12,Math.min(12,Math.round(Number(state.district?.supplier?.standing)||0)));
  return DISTRICT_SUPPLIER.bands.find(band=>(band.minimum==null||standing>=band.minimum)&&(band.maximum==null||standing<=band.maximum))||DISTRICT_SUPPLIER.bands[1];
}

function districtHouseholdBand(state) {
  const warmth=Math.max(-8,Math.min(12,Math.round(Number(state.district?.households?.[NEIGHBORHOOD_COMMONS.id]?.warmth)||0)));
  return NEIGHBORHOOD_COMMONS.bands.find(band=>(band.minimum==null||warmth>=band.minimum)&&(band.maximum==null||warmth<=band.maximum))||NEIGHBORHOOD_COMMONS.bands[1];
}

function districtMaintenanceProfile(state) {
  const source=state.district?.households?.[NEIGHBORHOOD_COMMONS.id]?.maintenance||{};
  const integrity=Math.max(0,Math.min(8,Math.round(Number(source.integrity)||0)));
  const band=NEIGHBORHOOD_COMMONS.maintenance.integrityBands.find(candidate=>(candidate.minimum==null||integrity>=candidate.minimum)&&(candidate.maximum==null||integrity<=candidate.maximum))||NEIGHBORHOOD_COMMONS.maintenance.integrityBands[0];
  const nextDueDay=source.nextDueDay==null?null:Math.max(1,Math.round(Number(source.nextDueDay)||state.day));
  const due=nextDueDay!=null&&state.day>=nextDueDay&&!source.active;
  const overdue=due&&state.day>nextDueDay+NEIGHBORHOOD_COMMONS.maintenance.graceDays;
  const scheduleState=source.active?'active':overdue?'overdue':due?'due':null;
  const fault=source.fault||null,governance=source.governance||{};
  const governanceModel=NEIGHBORHOOD_COMMONS.maintenance.governance.models.find(model=>model.id===governance.modelId)||null;
  const governanceRequired=due&&(Math.max(0,Number(source.cycles)||0)>=NEIGHBORHOOD_COMMONS.maintenance.governance.firstChoiceCycle)&&!governanceModel;
  const overrides=scheduleState?{ ...(NEIGHBORHOOD_COMMONS.maintenance.scheduleOverrides[scheduleState]||{}),...(fault?.scheduleOverrides||{}) }:{};
  return { integrity,band,nextDueDay,due,overdue,active:source.active||null,scheduleState,overrides,fault,governance,governanceModel,governanceRequired };
}

function workPressureBand(state) {
  const pressure=Math.max(0,Math.min(12,Math.round(Number(state.work?.pressure)||0)));
  return NEIGHBORHOOD_WORKS.pressureBands.find(band=>(band.minimum==null||pressure>=band.minimum)&&(band.maximum==null||pressure<=band.maximum))||NEIGHBORHOOD_WORKS.pressureBands[0];
}

export class WorldRenderer {
  constructor(canvas, getView) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.getView = getView;
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.pointer = { x: .5, y: .5 };
    this.currentPipX = .34;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.onPointerMove = event => {
      const rect = canvas.getBoundingClientRect();
      this.pointer.x = (event.clientX - rect.left) / Math.max(1, rect.width);
      this.pointer.y = (event.clientY - rect.top) / Math.max(1, rect.height);
    };
    canvas.addEventListener('pointermove', this.onPointerMove);
    this.resize();
    this.running = true;
    this.frame = time => {
      if (!this.running) return;
      this.draw(time * .001);
      this.frameId = requestAnimationFrame(this.frame);
    };
    this.frameId = requestAnimationFrame(this.frame);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
  }

  draw(time) {
    const view = this.getView();
    if (!view?.state) return;
    const state = view.state;
    const motion = state.settings.motion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = motion ? time : 0;
    const targetX = LOCATIONS[state.location].focus[state.focus] ?? .34;
    this.currentPipX = lerp(this.currentPipX, targetX, motion ? .075 : 1);
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    if (state.location === 'shore') this.drawShore(ctx, t, state);
    else if (state.location === 'room') this.drawRoom(ctx, t, state);
    else if (state.location === 'kitchen') this.drawKitchen(ctx, t, state);
    else if (state.location === 'district') this.drawDistrict(ctx, t, state);
    else if (state.location === 'market') this.drawMarket(ctx, t, state);
    else this.drawStarspite(ctx, t, state);
    this.drawLifeSituation(ctx, t, state);
    this.drawPip(ctx, t, state, this.currentPipX * this.width, this.height * .78);
    this.drawForeground(ctx, t, state.location);
    ctx.restore();
  }

  backdrop(ctx, top, bottom) {
    ctx.save();
    ctx.globalAlpha = .52;
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  drawStars(ctx, t, amount = 34) {
    for (let i = 0; i < amount; i += 1) {
      const x = seeded(i * 3) * this.width;
      const y = seeded(i * 7 + 5) * this.height * .48;
      const pulse = .45 + Math.sin(t * (1 + seeded(i) * 2) + i) * .28;
      fillEllipse(ctx, x, y, 1 + seeded(i + 4) * 1.5, 1 + seeded(i + 9), `rgba(255,225,190,${pulse})`);
    }
  }

  drawShore(ctx, t, state) {
    this.backdrop(ctx, '#201534', '#82516d');
    this.drawStars(ctx, t, 42);
    const horizon = this.height * .43;
    // Oversized inhabited alien forms on the horizon.
    for (let i = 0; i < 13; i += 1) {
      const x = this.width * (.02 + i * .081) + Math.sin(i * 3) * 8;
      const towerH = this.height * (.12 + seeded(i) * .29);
      const towerW = this.width * (.035 + seeded(i + 2) * .04);
      const gradient = ctx.createLinearGradient(x, horizon - towerH, x, horizon);
      gradient.addColorStop(0, '#49314f');
      gradient.addColorStop(1, '#251a36');
      rounded(ctx, x - towerW / 2, horizon - towerH, towerW, towerH + 20, towerW * .48);
      ctx.fillStyle = gradient;
      ctx.fill();
      for (let w = 0; w < 3; w += 1) {
        const wy = horizon - towerH * (.2 + w * .27);
        fillEllipse(ctx, x + (w % 2 ? -1 : 1) * towerW * .13, wy, 2, 3, `rgba(255,188,93,${.45 + .3 * Math.sin(t + i + w)})`);
      }
    }
    // The Glimmer: layered elastic non-water folds.
    for (let layer = 0; layer < 7; layer += 1) {
      const yBase = horizon + layer * this.height * .072;
      ctx.beginPath();
      ctx.moveTo(-30, this.height + 20);
      ctx.lineTo(-30, yBase);
      for (let x = -30; x <= this.width + 40; x += 28) {
        const phase = x * .012 + t * (.35 + layer * .06) + layer;
        const y = yBase + Math.sin(phase) * (8 + layer * 1.4) + Math.sin(phase * .43) * 5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(this.width + 30, this.height + 30);
      ctx.closePath();
      const alpha = .16 + layer * .045;
      ctx.fillStyle = layer % 2 ? `rgba(93,185,210,${alpha})` : `rgba(156,91,184,${alpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(178,239,239,${.13 + layer * .025})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    // Floating organisms inside the sea.
    for (let i = 0; i < 17; i += 1) {
      const x = seeded(i + 40) * this.width;
      const y = horizon + seeded(i + 74) * (this.height - horizon) * .8;
      const bob = Math.sin(t * .7 + i) * 6;
      ctx.globalAlpha = .32 + seeded(i) * .35;
      fillEllipse(ctx, x, y + bob, 4 + seeded(i + 8) * 9, 3 + seeded(i + 12) * 7, i % 2 ? '#78e0d8' : '#df82d6');
      ctx.globalAlpha = 1;
    }
    this.drawShellby(ctx, t, this.width * .67, this.height * .59, state.portal.unlocked);
  }

  drawShellby(ctx, t, x, y, portalGone) {
    ctx.save();
    const bob = Math.sin(t * 1.4) * 2;
    ctx.translate(x, y + bob);
    ctx.fillStyle = '#253f4a';
    for (let i = 0; i < 6; i += 1) {
      ctx.save();
      ctx.rotate((i - 2.5) * .28);
      rounded(ctx, -6, 35, 12, 46, 6);
      ctx.fill();
      ctx.restore();
    }
    const shellGradient = ctx.createRadialGradient(-18,-18,4,0,0,60);
    shellGradient.addColorStop(0,'#63828a');
    shellGradient.addColorStop(1,'#1f2f3c');
    fillEllipse(ctx, 0, 0, 58, 48, shellGradient);
    ctx.strokeStyle = '#8aa0a0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0,0,58,48,0,0,TAU); ctx.stroke();
    fillEllipse(ctx, -18, -11, 4, 4, '#ffc765');
    fillEllipse(ctx, 20, 8, 5, 5, '#79d9d2');
    if (!portalGone) {
      const glow = ctx.createRadialGradient(0,0,2,0,0,38);
      glow.addColorStop(0,'#fff3b0'); glow.addColorStop(.22,'#ffb555'); glow.addColorStop(.6,'#e35558'); glow.addColorStop(1,'rgba(227,85,88,0)');
      fillEllipse(ctx, 0, 0, 38, 38, glow);
      ctx.strokeStyle = '#ffe189'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0,0,24 + Math.sin(t*3)*2,0,TAU); ctx.stroke();
      ctx.fillStyle = '#efdb9b';
      ctx.save(); ctx.rotate(-.14 + Math.sin(t)*.03); rounded(ctx,-11,-3,42,17,2); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }

  drawRoom(ctx, t, state) {
    this.backdrop(ctx, '#563750', '#2a1a34');
    const floorY = this.height * .7;
    ctx.fillStyle = '#2a2533'; ctx.fillRect(0, floorY, this.width, this.height - floorY);
    // Wallpaper remembers childhood stars.
    for (let i = 0; i < 26; i += 1) {
      const x = seeded(i + 10) * this.width;
      const y = seeded(i + 20) * floorY;
      ctx.fillStyle = i % 3 ? 'rgba(244,188,120,.10)' : 'rgba(121,221,207,.13)';
      ctx.font = `${10 + seeded(i)*10}px Georgia`;
      ctx.fillText(i % 2 ? '✦' : '●', x, y);
    }
    // Window and living city.
    const wx = this.width * .08, wy = this.height * .12, ww = this.width * .25, wh = this.height * .34;
    rounded(ctx, wx, wy, ww, wh, 30); ctx.fillStyle='#15172d'; ctx.fill();
    ctx.save(); rounded(ctx, wx, wy, ww, wh, 30); ctx.clip();
    for (let i=0;i<9;i+=1) {
      const x=wx+i*ww/8; const h=wh*(.18+seeded(i+4)*.66);
      rounded(ctx,x-ww*.035,wy+wh-h,ww*.08,h+20,ww*.04);ctx.fillStyle='#342344';ctx.fill();
      fillEllipse(ctx,x,wy+wh-h*.6,2,3,`rgba(255,194,91,${.45+.3*Math.sin(t+i)})`);
    }
    ctx.restore();
    // Bed, shelf, moving box.
    rounded(ctx, this.width*.06, floorY-this.height*.11, this.width*.29, this.height*.13, 18); ctx.fillStyle='#8e5571';ctx.fill();
    rounded(ctx, this.width*.07, floorY-this.height*.17, this.width*.13, this.height*.1, 24);ctx.fillStyle='#d98f78';ctx.fill();
    rounded(ctx,this.width*.39,floorY-this.height*.1,this.width*.14,this.height*.11,8);ctx.fillStyle='#6d4a38';ctx.fill();
    ctx.strokeStyle='rgba(255,235,190,.25)';ctx.strokeRect(this.width*.41,floorY-this.height*.075,this.width*.09,this.height*.04);
    // Portal machine moved into the room.
    if (state.portal.unlocked) this.drawPortalMachine(ctx,t,this.width*.62,floorY-this.height*.12,state.portal.charges);
    if (state.business) this.drawBusinessNook(ctx,t,state,floorY);
    // Visible home growth.
    if (state.home.upgrades.includes('shelf')) {
      rounded(ctx,this.width*.67,this.height*.18,this.width*.25,12,5);ctx.fillStyle='#b27b55';ctx.fill();
      state.installed.slice(0,3).forEach((item,index)=>{ctx.fillStyle=item.rarityColor;ctx.font='24px Georgia';ctx.fillText(item.glyph,this.width*(.7+index*.075),this.height*.17);});
    }
    if (state.home.upgrades.includes('glimmer-window')) {
      ctx.strokeStyle='#63e2d0';ctx.lineWidth=4;rounded(ctx,wx-5,wy-5,ww+10,wh+10,34);ctx.stroke();
    }
    this.drawDistrictHouseMarks(ctx,t,state,'room');
    this.drawParent(ctx,t,this.width*.78,floorY,'dad');
  }

  drawBusinessNook(ctx,t,state,floorY) {
    const business=state.business;
    const x=this.width*.37,y=this.height*.17,w=this.width*.205,h=this.height*.18;
    ctx.save();
    // A local alien-web window: light and motion are decorative; offer state is not.
    const screen=ctx.createLinearGradient(x,y,x+w,y+h);screen.addColorStop(0,'#152b30');screen.addColorStop(1,'#241b35');
    rounded(ctx,x,y,w,h,12);ctx.fillStyle=screen;ctx.fill();ctx.strokeStyle='rgba(100,223,199,.35)';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#64dfc7';ctx.font='800 8px Consolas';ctx.fillText('PIP://LOCAL-WEB',x+10,y+15);
    ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(x+10,y+23,w-20,1);
    const listingCount=Math.min(4,business.listings.length);
    for(let i=0;i<4;i+=1){
      const rowY=y+34+i*14;
      rounded(ctx,x+10,rowY,w-20,9,4);ctx.fillStyle=i<listingCount?'rgba(100,223,199,.09)':'rgba(255,255,255,.025)';ctx.fill();
      if(i<listingCount){
        const listing=business.listings[i];
        fillEllipse(ctx,x+17,rowY+4.5,2.5,2.5,listing.item.rarityColor);
        ctx.fillStyle='#d7cfd9';ctx.font='700 6px Consolas';ctx.fillText(`${listing.offer}₡  ${listing.item.name.slice(0,16)}`,x+24,rowY+6.5);
      }
    }
    fillEllipse(ctx,x+w-12,y+11,3,3,`rgba(100,223,199,${.55+Math.sin(t*2)*.25})`);
    // Shipment boxes accumulate without hiding Pip's tiny scale.
    const boxes=Math.min(3,business.callbacks.length+business.sales);
    for(let i=0;i<boxes;i+=1){
      const bx=this.width*(.46+i*.027),by=floorY-this.height*(.055+i*.025);
      rounded(ctx,bx,by,32,25,4);ctx.fillStyle=i%2?'#74503f':'#65465a';ctx.fill();ctx.strokeStyle='rgba(255,222,160,.22)';ctx.stroke();
      ctx.fillStyle='#efbf68';ctx.font='8px Georgia';ctx.fillText(i%2?'⌁':'◌',bx+12,by+16);
    }
    if(business.upgrades.includes('family-packing-table')){
      rounded(ctx,this.width*.34,floorY-this.height*.045,this.width*.19,12,5);ctx.fillStyle='#a36f4d';ctx.fill();
      for(const lx of [.355,.5]){rounded(ctx,this.width*lx,floorY-this.height*.03,7,this.height*.12,3);ctx.fillStyle='#563b37';ctx.fill();}
    }
    if(business.upgrades.includes('translation-seal')){
      ctx.strokeStyle='rgba(246,196,89,.62)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+w-18,y+h-18,9+Math.sin(t)*1.5,0,TAU);ctx.stroke();
      ctx.fillStyle='#f6c459';ctx.font='800 6px Consolas';ctx.textAlign='center';ctx.fillText('TRUE',x+w-18,y+h-16);ctx.textAlign='left';
    }
    if(business.upgrades.includes('portal-fulfilment')){
      const fx=this.width*.57,fy=this.height*.42;
      ctx.strokeStyle='rgba(255,121,215,.55)';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(fx,fy,18+Math.sin(t*1.7)*2,30,0,0,TAU);ctx.stroke();
      fillEllipse(ctx,fx,fy,11,22,'rgba(255,121,215,.08)');
    }
    if(business.branchId){
      rounded(ctx,x,y-18,w*.72,14,5);ctx.fillStyle='rgba(246,196,89,.12)';ctx.fill();ctx.strokeStyle='rgba(246,196,89,.25)';ctx.stroke();
      ctx.fillStyle='#efbf68';ctx.font='800 6px Consolas';ctx.fillText(business.branchId.replaceAll('-',' ').toUpperCase().slice(0,27),x+7,y-8);
    }
    const pet=state.pets.find(candidate=>candidate.id===business.assignedPetId);
    if(pet){
      const px=this.width*.555,py=floorY-this.height*.035+Math.sin(t*1.6)*2;
      fillEllipse(ctx,px,py-14,18,15,'rgba(246,196,89,.18)');
      ctx.fillStyle='#f6c459';ctx.font='25px Georgia';ctx.textAlign='center';ctx.fillText(pet.glyph,px,py-6);ctx.textAlign='left';
    }
    ctx.restore();
  }

  drawPortalMachine(ctx,t,x,y,charges) {
    ctx.save();ctx.translate(x,y);
    const glow=ctx.createRadialGradient(0,0,2,0,0,75);glow.addColorStop(0,'rgba(255,207,105,.75)');glow.addColorStop(.45,'rgba(94,220,203,.22)');glow.addColorStop(1,'rgba(94,220,203,0)');
    fillEllipse(ctx,0,0,75,75,glow);
    fillEllipse(ctx,0,0,48,42,'#263f46');
    ctx.strokeStyle='#7b9da0';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,48,42,0,0,TAU);ctx.stroke();
    const portal=ctx.createRadialGradient(0,0,2,0,0,31);portal.addColorStop(0,'#fff9bb');portal.addColorStop(.25,'#f9a24d');portal.addColorStop(.7,'#ac4359');portal.addColorStop(1,'#1c2834');fillEllipse(ctx,0,0,31,31,portal);
    ctx.strokeStyle='#ffe091';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,20+Math.sin(t*3)*2,0,TAU);ctx.stroke();
    for(let i=0;i<charges;i+=1) fillEllipse(ctx,-18+i*12,47,3,3,'#64dfc7');
    ctx.restore();
  }

  drawKitchen(ctx,t,state) {
    this.backdrop(ctx,'#6e3f43','#2d202d');
    const floorY=this.height*.72;
    ctx.fillStyle='#302532';ctx.fillRect(0,floorY,this.width,this.height-floorY);
    // Bulbous cabinets.
    for(let i=0;i<6;i+=1){
      const x=this.width*(.02+i*.18);const w=this.width*.15;
      rounded(ctx,x,this.height*.12,w,this.height*.22,24);ctx.fillStyle=i%2?'#714c50':'#5b3e4c';ctx.fill();
      fillEllipse(ctx,x+w*.5,this.height*.27,4,4,'#ffbf64');
    }
    // Family table.
    rounded(ctx,this.width*.25,floorY-this.height*.11,this.width*.52,this.height*.11,34);ctx.fillStyle='#8e6550';ctx.fill();
    for(const lx of [.31,.7]) {rounded(ctx,this.width*lx,floorY-this.height*.02,14,this.height*.2,7);ctx.fillStyle='#5a403a';ctx.fill();}
    // Dinner organism.
    const dinnerX=this.width*.5,dinnerY=floorY-this.height*.15;
    fillEllipse(ctx,dinnerX,dinnerY,56+Math.sin(t)*5,22+Math.cos(t*1.3)*3,'#d88369');
    for(let i=0;i<5;i+=1){fillEllipse(ctx,dinnerX-34+i*17,dinnerY-7+Math.sin(t+i)*4,3,5,'#ffe08c');}
    ctx.strokeStyle='rgba(255,255,255,.2)';ctx.beginPath();ctx.moveTo(dinnerX-50,dinnerY);ctx.quadraticCurveTo(dinnerX,dinnerY+30,dinnerX+50,dinnerY);ctx.stroke();
    // Heating organ.
    const hx=this.width*.12,hy=this.height*.57;
    for(let i=0;i<7;i+=1){ctx.strokeStyle=`rgba(255,154,92,${.22+i*.04})`;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(hx,hy);ctx.quadraticCurveTo(hx+Math.sin(t+i)*25,hy-i*9,hx+50,hy-i*7);ctx.stroke();}
    fillEllipse(ctx,hx,hy,32,38,'#86494d');
    if(state.home.upgrades.includes('heating-organ')){fillEllipse(ctx,hx,hy,16,20,'#ffb35c');}
    this.drawDistrictHouseMarks(ctx,t,state,'kitchen');
    this.drawParent(ctx,t,this.width*.67,floorY,'mom');
  }

  drawDistrictHouseMarks(ctx,t,state,location) {
    const marks=state.district?.houseMarks || [];
    if(!marks.length) return;
    if(marks.some(mark=>mark.visual==='thank-you-pennant')){
      const y=this.height*(location==='room' ? 0.11 : 0.39);
      ctx.strokeStyle='rgba(255,235,190,.38)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(this.width*.35,y);ctx.quadraticCurveTo(this.width*.5,y+10,this.width*.64,y);ctx.stroke();
      for(let i=0;i<5;i+=1){ctx.fillStyle=i%2?'#78d7b6':'#d591d7';ctx.beginPath();const x=this.width*(.38+i*.055);ctx.moveTo(x,y+2);ctx.lineTo(x+12,y+2);ctx.lineTo(x+7,y+15+Math.sin(t+i)*2);ctx.closePath();ctx.fill();}
    }
    if(marks.some(mark=>mark.visual==='parcel-periscope')){
      const x=this.width*(location==='room' ? 0.3 : 0.86),y=this.height*(location==='room' ? 0.2 : 0.28);
      ctx.strokeStyle='#8fb4d9';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y+42);ctx.lineTo(x,y);ctx.lineTo(x+28,y);ctx.stroke();
      fillEllipse(ctx,x+31,y,6,9,'#f0b766');
      ctx.strokeStyle=`rgba(143,180,217,${.35+Math.sin(t*1.4)*.12})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+31,y,15,0,TAU);ctx.stroke();
    }
    if(marks.some(mark=>mark.visual==='kettle-crate')){
      const x=this.width*(location==='room' ? .72 : .78),y=this.height*(location==='room' ? .59 : .66);
      ctx.fillStyle='#594451';rounded(ctx,x,y,56,38,8);ctx.fill();ctx.strokeStyle='#f0b766';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#f0b766';ctx.font='20px Georgia';ctx.fillText(DISTRICT_SUPPLIER.glyph,x+17,y+26);
      for(let i=0;i<3;i+=1){ctx.strokeStyle=`rgba(120,215,182,${.22+i*.08})`;ctx.beginPath();ctx.moveTo(x+20+i*7,y);ctx.quadraticCurveTo(x+11+i*9,y-12-Math.sin(t+i)*4,x+23+i*8,y-21);ctx.stroke();}
    }
    if(marks.some(mark=>mark.visual==='workbench-stamp')){
      const x=this.width*(location==='room' ? .12 : .55),y=this.height*(location==='room' ? .55 : .61);
      ctx.fillStyle='#614955';rounded(ctx,x,y,72,12,5);ctx.fill();
      ctx.strokeStyle='#78d7b6';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#ef8f78';rounded(ctx,x+24,y-26,24,25,7);ctx.fill();
      ctx.fillStyle='#171a2e';ctx.font='700 9px Consolas';ctx.textAlign='center';ctx.fillText(NEIGHBORHOOD_WORKS.glyph,x+36,y-9);ctx.textAlign='left';
    }
    if(marks.some(mark=>mark.visual==='heat-share-mobile')){
      const x=this.width*(location==='room' ? .53 : .42),y=this.height*(location==='room' ? .13 : .32);
      ctx.strokeStyle='rgba(239,159,190,.58)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-18);ctx.lineTo(x,y+2);ctx.moveTo(x-34,y+8);ctx.quadraticCurveTo(x,y+19,x+34,y+8);ctx.stroke();
      for(let i=0;i<4;i+=1){const mx=x-30+i*20,my=y+10+Math.sin(t*1.2+i)*3;ctx.strokeStyle=i%2?'#8fb4d9':'#ef9fbe';ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(mx,my+17);ctx.stroke();fillEllipse(ctx,mx,my+22,5,7,i%2?'#8fb4d9':'#f0b766');}
      fillEllipse(ctx,x,y+6,8,8,'#ef9fbe');
    }
    const governanceMark=marks.find(mark=>['common-valve-charter','hushglass-trust-deed','service-coop-license'].includes(mark.visual));
    if(governanceMark){
      const x=this.width*(location==='room'?.36:.31),y=this.height*(location==='room'?.25:.42);
      const glyph=governanceMark.visual==='common-valve-charter'?'ALL':governanceMark.visual==='hushglass-trust-deed'?'HG':'COOP';
      const color=governanceMark.visual==='common-valve-charter'?'#78d7b6':governanceMark.visual==='hushglass-trust-deed'?'#ef9fbe':'#b99aff';
      ctx.fillStyle='rgba(19,18,31,.9)';rounded(ctx,x-29,y-16,58,33,8);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle=color;ctx.font='700 9px Consolas';ctx.textAlign='center';ctx.fillText(glyph,x,y+3);ctx.textAlign='left';
      ctx.strokeStyle=`rgba(240,183,102,${.35+Math.sin(t*1.1)*.12})`;ctx.beginPath();ctx.moveTo(x-18,y+21);ctx.quadraticCurveTo(x,y+27,x+18,y+21);ctx.stroke();
    }
    const serviceMark=marks.find(mark=>['valve-rota-card','shop-relay-window','pet-valve-seal','shared-contract-stencil','exclusive-contract-stencil'].includes(mark.visual));
    if(serviceMark){
      const x=this.width*(location==='room'?.78:.68),y=this.height*(location==='room'?.22:.34);
      const exclusive=serviceMark.visual==='exclusive-contract-stencil';
      ctx.fillStyle='rgba(22,20,34,.88)';rounded(ctx,x-24,y-18,48,38,9);ctx.fill();ctx.strokeStyle=exclusive?'#ef8f78':serviceMark.visual==='pet-valve-seal'?'#f0b766':'#78d7b6';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle=ctx.strokeStyle;ctx.font='700 10px Consolas';ctx.textAlign='center';ctx.fillText(serviceMark.visual==='pet-valve-seal'?'PET':serviceMark.visual==='shop-relay-window'?'OWN':exclusive?'BID':'ROTA',x,y+4);ctx.textAlign='left';
      for(let i=0;i<3;i+=1){ctx.strokeStyle=`rgba(239,159,190,${.25+i*.1})`;ctx.beginPath();ctx.moveTo(x-16+i*16,y+20);ctx.quadraticCurveTo(x-11+i*16,y+28+Math.sin(t+i)*3,x-18+i*18,y+34);ctx.stroke();}
    }
  }

  drawParent(ctx,t,x,floorY,id) {
    const color=ACTORS[id].color;
    const bob=Math.sin(t*.8+(id==='mom'?1:0))*2;
    ctx.save();ctx.translate(x,floorY+bob);
    // Huge relative to Pip.
    fillEllipse(ctx,0,-76,33,40,color);
    ctx.fillStyle=color;rounded(ctx,-40,-43,80,72,32);ctx.fill();
    fillEllipse(ctx,-12,-83,5,7,'#25172a');fillEllipse(ctx,12,-83,5,7,'#25172a');
    fillEllipse(ctx,-10,-84,2,3,'#fff4c7');fillEllipse(ctx,14,-84,2,3,'#fff4c7');
    ctx.strokeStyle='#25172a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-68,10,.2,Math.PI-.2);ctx.stroke();
    ctx.fillStyle='#4c344f';rounded(ctx,-42,-30,84,60,28);ctx.fill();
    ctx.restore();
  }

  drawDistrict(ctx,t,state) {
    this.backdrop(ctx,'#23364b','#735066');
    const ground=this.height*.76;
    this.drawStars(ctx,t,28);
    // Tall homes lean together like gossiping filing cabinets.
    for(let i=0;i<9;i+=1){
      const x=this.width*(-.05+i*.135),w=this.width*.16,h=this.height*(.3+seeded(i+180)*.3);
      ctx.save();ctx.translate(x+w*.5,ground-h);ctx.rotate((i%2?1:-1)*(.018+seeded(i)*.035));
      const wall=ctx.createLinearGradient(0,0,0,h);wall.addColorStop(0,i%2?'#596075':'#72536d');wall.addColorStop(1,'#30273b');
      rounded(ctx,-w*.5,0,w,h+28,18);ctx.fillStyle=wall;ctx.fill();
      for(let row=0;row<3;row+=1){for(let col=0;col<2;col+=1){const wx=-w*.3+col*w*.34,wy=32+row*h*.2;rounded(ctx,wx,wy,w*.22,h*.1,8);ctx.fillStyle=`rgba(246,196,89,${.14+.18*Math.sin(t*.7+i+row+col)})`;ctx.fill();}}
      ctx.restore();
    }
    // The tram-lung inhales at one end of the lane and exhales commuters at the other.
    const lungX=this.width*.5,lungY=this.height*.25;
    fillEllipse(ctx,lungX,lungY,58+Math.sin(t*.8)*7,25+Math.cos(t*.8)*4,'rgba(120,215,182,.16)');
    ctx.strokeStyle='rgba(120,215,182,.45)';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(lungX,lungY,48+Math.sin(t*.8)*6,18+Math.cos(t*.8)*3,0,0,TAU);ctx.stroke();
    for(let i=0;i<7;i+=1){const x=((seeded(i+220)+t*(.012+seeded(i)*.008))%1.15-.08)*this.width;fillEllipse(ctx,x,ground-22-seeded(i)*30,5,7,i%2?'#f0b766':'#d591d7');}
    // Lampmoss and the articulated parcel spine visibly move without driving state.
    for(let i=0;i<24;i+=1){const x=i*this.width/23,y=ground-8-Math.sin(i*.8+t)*8;fillEllipse(ctx,x,y,4+seeded(i)*4,3,'rgba(120,215,182,.55)');}
    ctx.strokeStyle='rgba(240,183,102,.58)';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(this.width*.68,ground-78);for(let i=0;i<6;i+=1)ctx.lineTo(this.width*(.7+i*.035),ground-72+Math.sin(t*1.2+i)*10);ctx.stroke();
    fillEllipse(ctx,this.width*.9,ground-70+Math.sin(t*1.2+5)*10,15,12,'#765567');
    const phase=districtPhase(state.hour),supplierBand=districtSupplierBand(state),supplierOverrides=DISTRICT_SUPPLIER.scheduleOverrides[supplierBand.id]||{},householdBand=districtHouseholdBand(state),householdOverrides=NEIGHBORHOOD_COMMONS.scheduleOverrides[householdBand.id]||{},maintenance=districtMaintenanceProfile(state),maintenanceOverrides=maintenance.overrides,workBand=workPressureBand(state);
    // The Crooked Kettle household changes color, stock, and steam with its persistent standing band.
    const kettleX=this.width*.18,kettleY=ground-95;
    ctx.save();ctx.globalAlpha=.28;ctx.fillStyle=supplierBand.color;rounded(ctx,kettleX-48,kettleY-48,96,72,19);ctx.fill();ctx.restore();
    ctx.strokeStyle=supplierBand.color;ctx.lineWidth=3;ctx.stroke();
    fillEllipse(ctx,kettleX,kettleY-48,27,12,supplierBand.color);
    ctx.fillStyle='#171a2e';ctx.font='22px Georgia';ctx.textAlign='center';ctx.fillText(DISTRICT_SUPPLIER.glyph,kettleX,kettleY-12);ctx.textAlign='left';
    const steamCount=supplierBand.id==='flourishing'?5:supplierBand.id==='stocked'?4:supplierBand.id==='strained'?1:2;
    for(let i=0;i<steamCount;i+=1){ctx.strokeStyle=`rgba(120,215,182,${.2+i*.08})`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(kettleX-15+i*8,kettleY-56);ctx.quadraticCurveTo(kettleX-25+i*11,kettleY-77-Math.sin(t+i)*6,kettleX-12+i*9,kettleY-93);ctx.stroke();}
    // The rival employer's table changes posture with public pressure; this is visible state, not a hidden roll.
    const tableX=this.width*.77,tableY=ground-104;
    ctx.fillStyle='rgba(20,18,31,.72)';rounded(ctx,tableX-62,tableY-52,126,76,15);ctx.fill();ctx.strokeStyle=workBand.color;ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle=workBand.color;rounded(ctx,tableX-72,tableY+12,144,13,6);ctx.fill();
    ctx.fillStyle='#171a2e';ctx.font='700 11px Consolas';ctx.textAlign='center';ctx.fillText(NEIGHBORHOOD_WORKS.glyph,tableX,tableY+22);ctx.textAlign='left';
    const workerCount=workBand.id==='contested'?6:workBand.id==='watching'?4:3;
    for(let i=0;i<workerCount;i+=1){const wx=tableX-50+i*(100/Math.max(1,workerCount-1));fillEllipse(ctx,wx,tableY-7-Math.sin(t*1.2+i)*2,6,8,i%2?'#d591d7':'#8fb4d9');}
    if(state.work?.active){ctx.strokeStyle=`rgba(240,183,102,${.42+Math.sin(t*2)*.18})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(tableX,tableY-18,32+Math.sin(t)*3,0,TAU);ctx.stroke();}
    // Hushglass is a second household with a public heat state, not decorative backdrop.
    const hushX=this.width*.49,hushY=ground-116;
    ctx.fillStyle='rgba(18,20,36,.82)';rounded(ctx,hushX-48,hushY-76,96,96,30);ctx.fill();ctx.strokeStyle=householdBand.color;ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle=householdBand.color;ctx.font='700 14px Georgia';ctx.textAlign='center';ctx.fillText(NEIGHBORHOOD_COMMONS.glyph,hushX,hushY-48);ctx.textAlign='left';
    const litWindows=householdBand.id==='open'?4:householdBand.id==='shared'?3:householdBand.id==='rationing'?1:0;
    for(let i=0;i<4;i+=1){const wx=hushX-31+(i%2)*36,wy=hushY-34+Math.floor(i/2)*26;rounded(ctx,wx,wy,24,17,6);ctx.fillStyle=i<litWindows?householdBand.color:'rgba(143,180,217,.08)';ctx.globalAlpha=i < litWindows ? .58 : .35;ctx.fill();ctx.globalAlpha=1;}
    const heatLines=householdBand.id==='open'?5:householdBand.id==='shared'?4:householdBand.id==='rationing'?2:1;
    for(let i=0;i<heatLines;i+=1){ctx.strokeStyle=`rgba(239,159,190,${.2+i*.07})`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(hushX-28+i*14,hushY-80);ctx.quadraticCurveTo(hushX-38+i*18,hushY-94-Math.sin(t+i)*5,hushX-24+i*16,hushY-107);ctx.stroke();}
    if(maintenance.scheduleState){
      const plateColor=maintenance.overdue?'#ef8f78':maintenance.active?'#78d7b6':'#f0b766';
      ctx.strokeStyle=plateColor;ctx.lineWidth=3;ctx.setLineDash(maintenance.overdue?[5,5]:[]);ctx.beginPath();ctx.moveTo(hushX+48,hushY-22);ctx.quadraticCurveTo((hushX+tableX)/2,ground-178,tableX-64,tableY-12);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='rgba(19,18,31,.9)';rounded(ctx,hushX+36,hushY-72,70,24,8);ctx.fill();ctx.strokeStyle=plateColor;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=plateColor;ctx.font='700 8px Consolas';ctx.textAlign='center';ctx.fillText(maintenance.active?'IN SERVICE':maintenance.governanceRequired?'OWNER?':maintenance.overdue?'OVERDUE':'DUE',hushX+71,hushY-56);ctx.textAlign='left';
      if(maintenance.active){for(let i=0;i<3;i+=1)fillEllipse(ctx,hushX+52+i*13,hushY-86+Math.sin(t*1.8+i)*3,4,4,i%2?'#ef9fbe':'#78d7b6');}
      if(maintenance.fault){
        const fx=hushX+82,fy=hushY-96;
        ctx.strokeStyle='#ef8f78';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<5;i+=1){const px=fx+i*8,py=fy+(i%2?8:-1)+Math.sin(t*2+i)*2;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.stroke();
        ctx.fillStyle='#ef8f78';ctx.font='700 7px Consolas';ctx.textAlign='center';ctx.fillText(maintenance.fault.glyph||'FLT',fx+16,fy-5);ctx.textAlign='left';
      }
      if(maintenance.governanceModel){ctx.fillStyle='#b99aff';ctx.font='700 7px Consolas';ctx.textAlign='center';ctx.fillText(maintenance.governanceModel.shortLabel,hushX,hushY+34);ctx.textAlign='left';}
    }
    DISTRICT_RESIDENTS.forEach((resident,index)=>{
      const current=maintenanceOverrides[resident.id]||householdOverrides[resident.id]||supplierOverrides[resident.id]||resident.schedule[phase];
      this.drawDistrictResident(ctx,t,resident,index,current.x*this.width,ground);
    });
    // Pip's parents' window gains a small physical echo when the lane changes the house.
    rounded(ctx,this.width*.03,this.height*.19,this.width*.13,this.height*.19,20);ctx.fillStyle='#171a2e';ctx.fill();ctx.strokeStyle='rgba(143,180,217,.35)';ctx.stroke();
    if(state.district?.houseMarks?.length){fillEllipse(ctx,this.width*.075,this.height*.27,12,16,'#f19c7a');fillEllipse(ctx,this.width*.12,this.height*.27,12,16,'#9ecf8d');}
    ctx.fillStyle='#272333';ctx.fillRect(0,ground,this.width,this.height-ground);
    ctx.strokeStyle='rgba(120,215,182,.24)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,ground);ctx.quadraticCurveTo(this.width*.5,ground-12,this.width,ground);ctx.stroke();
  }

  drawDistrictResident(ctx,t,resident,index,x,ground) {
    const actor=ACTORS[resident.id],scale=.78+index*.09,bob=Math.sin(t*(.7+index*.08)+index)*3;
    ctx.save();ctx.translate(x,ground+bob);ctx.globalAlpha=.86;
    fillEllipse(ctx,0,-70*scale,25*scale,31*scale,actor.color);
    ctx.fillStyle=index%2?'#3d384e':'#344451';rounded(ctx,-31*scale,-45*scale,62*scale,67*scale,22*scale);ctx.fill();
    const eyes=resident.id==='oola'?4:resident.id==='nibbin'?3:2;
    for(let eye=0;eye<eyes;eye+=1)fillEllipse(ctx,(eye-(eyes-1)/2)*9*scale,-75*scale,3*scale,4*scale,'#fff0b0');
    ctx.fillStyle=actor.color;ctx.font=`${Math.round(18*scale)}px Georgia`;ctx.textAlign='center';ctx.fillText(resident.glyph,0,-25*scale);ctx.textAlign='left';ctx.globalAlpha=1;ctx.restore();
  }

  drawMarket(ctx,t,state) {
    this.backdrop(ctx,'#332144','#7d3d62');
    const ground=this.height*.75;
    // Layered crooked stalls.
    for(let i=0;i<7;i+=1){
      const x=this.width*(-.04+i*.17);const w=this.width*.18;const h=this.height*(.23+seeded(i)*.15);
      ctx.fillStyle=i%2?'#3c3350':'#523044';rounded(ctx,x,ground-h,w,h+20,12);ctx.fill();
      ctx.fillStyle=i%3===0?'#ff5fac':i%3===1?'#59d8d0':'#ffbf5e';ctx.fillRect(x,ground-h,w,4);
      for(let j=0;j<4;j+=1){fillEllipse(ctx,x+18+j*w*.22,ground-h+18,3,5,`rgba(255,211,120,${.45+.35*Math.sin(t*2+i+j)})`);}
    }
    // Moving crowd, all enormous.
    for(let i=0;i<14;i+=1){
      const speed=.012+seeded(i)*.018;const x=((seeded(i+20)+t*speed)%1.2-.1)*this.width;const scale=.55+seeded(i+50)*.65;const y=ground+seeded(i+70)*this.height*.12;
      ctx.globalAlpha=.28+seeded(i)*.35;
      fillEllipse(ctx,x,y-40*scale,20*scale,28*scale,i%2?'#d28b8c':'#7bb7ab');
      ctx.fillStyle=i%2?'#754b70':'#4b596c';rounded(ctx,x-25*scale,y-18*scale,50*scale,52*scale,18*scale);ctx.fill();
      ctx.globalAlpha=1;
    }
    // Auntie Grift foreground silhouette.
    this.drawParent(ctx,t,this.width*.72,ground,'mom');
    ctx.fillStyle='#b06bd1';ctx.beginPath();ctx.moveTo(this.width*.67,ground-120);ctx.lineTo(this.width*.72,ground-165);ctx.lineTo(this.width*.77,ground-120);ctx.fill();
    // Price oracle.
    const ox=this.width*.18,oy=this.height*.32;
    fillEllipse(ctx,ox,oy,48,48,'rgba(89,216,208,.18)');
    ctx.strokeStyle='#69e0d2';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ox,oy,34+Math.sin(t*1.4)*4,0,TAU);ctx.stroke();
    ctx.fillStyle='#ffe484';ctx.font='600 18px Georgia';ctx.fillText(`${(state.day*17)%97+3}₡?`,ox-22,oy+6);
  }

  drawStarspite(ctx,t,state) {
    this.backdrop(ctx,'#110b2b','#432454');
    this.drawStars(ctx,t,72);
    const floor=this.height*.77;

    // Vast observation glass: the home planet remains visible beneath every wager.
    const px=this.width*.18,py=this.height*.28;
    const planet=ctx.createRadialGradient(px-18,py-16,4,px,py,78);
    planet.addColorStop(0,'#b7f0d1');planet.addColorStop(.32,'#4b9ca5');planet.addColorStop(.7,'#334a7a');planet.addColorStop(1,'rgba(28,24,74,0)');
    fillEllipse(ctx,px,py,78,78,planet);
    ctx.strokeStyle='rgba(183,240,209,.25)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(px,py,66,23,-.32,0,TAU);ctx.stroke();
    for(let i=0;i<7;i+=1){fillEllipse(ctx,px-40+seeded(i+20)*78,py-30+seeded(i+32)*60,3+seeded(i)*8,2+seeded(i+6)*5,'rgba(125,217,177,.23)');}

    // Ribbed casino hull and transparent odds pylons.
    for(let i=0;i<9;i+=1){
      const x=this.width*(.02+i*.125);const h=this.height*(.25+seeded(i+90)*.26);
      ctx.strokeStyle=`rgba(185,154,255,${.08+i%3*.04})`;ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(x,floor);ctx.quadraticCurveTo(x-25,floor-h*.55,x+10,floor-h);ctx.stroke();
    }
    const tables=[
      {x:.42,label:'1 / 12',color:'#f2bd67',speed:1.1},
      {x:.62,label:'3 / 16',color:'#8bd9ef',speed:-.8},
      {x:.82,label:'1 / 2',color:'#8ce1bd',speed:1.5}
    ];
    tables.forEach((table,index)=>{
      const x=this.width*table.x,y=this.height*(.5+(index%2)*.045);
      ctx.save();ctx.translate(x,y);ctx.rotate(t*.18*table.speed);
      ctx.strokeStyle=table.color;ctx.lineWidth=3;ctx.globalAlpha=.62;
      ctx.beginPath();ctx.ellipse(0,0,42,17,.4,0,TAU);ctx.stroke();
      ctx.beginPath();ctx.ellipse(0,0,18,42,-.45,0,TAU);ctx.stroke();
      fillEllipse(ctx,Math.cos(t*table.speed)*38,Math.sin(t*table.speed)*14,4,4,table.color);
      ctx.restore();ctx.globalAlpha=1;
      rounded(ctx,x-39,y+49,78,24,8);ctx.fillStyle='rgba(15,10,34,.82)';ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.11)';ctx.stroke();
      ctx.fillStyle=table.color;ctx.font='800 12px Consolas';ctx.textAlign='center';ctx.fillText(table.label,x,y+65);ctx.textAlign='left';
    });

    // Giant patrons make Pip's scale absurd even in orbit.
    for(let i=0;i<6;i+=1){
      const x=this.width*(.34+i*.13),scale=.68+seeded(i+120)*.55;
      ctx.globalAlpha=.22+seeded(i+44)*.25;
      fillEllipse(ctx,x,floor-82*scale,24*scale,32*scale,i%2?'#c78ba8':'#80a6bd');
      ctx.fillStyle=i%2?'#593958':'#344765';rounded(ctx,x-31*scale,floor-54*scale,62*scale,67*scale,22*scale);ctx.fill();
      ctx.globalAlpha=1;
    }

    // Animated outcome ticker. It is decorative and never drives game state.
    rounded(ctx,this.width*.36,this.height*.13,this.width*.55,36,12);ctx.fillStyle='rgba(8,8,28,.72)';ctx.fill();
    ctx.strokeStyle='rgba(242,189,103,.25)';ctx.stroke();
    ctx.fillStyle='#f2bd67';ctx.font='800 11px Consolas';
    const ticker=`POSTED: 1/12 · RTP 91.667%   3/16 · RTP 93.75%   1/2 · RTP 100%   PLAYS ${state.starspite.gamesPlayed}`;
    const shift=(t*24)%(this.width*.55+ctx.measureText(ticker).width);
    ctx.save();ctx.beginPath();ctx.rect(this.width*.37,this.height*.13+2,this.width*.53,32);ctx.clip();ctx.fillText(ticker,this.width*.9-shift,this.height*.13+22);ctx.restore();

    ctx.fillStyle='#24182f';ctx.fillRect(0,floor,this.width,this.height-floor);
    ctx.strokeStyle='rgba(185,154,255,.25)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,floor);ctx.lineTo(this.width,floor);ctx.stroke();
    this.drawVesper(ctx,t,this.width*.73,floor);
  }

  drawVesper(ctx,t,x,floorY) {
    const bob=Math.sin(t*.9)*2;
    ctx.save();ctx.translate(x,floorY+bob);
    ctx.strokeStyle='#b99aff';ctx.lineWidth=6;ctx.lineCap='round';
    for(let i=0;i<5;i+=1){ctx.beginPath();ctx.arc(0,-92,22+i*8,.2+i*.12,Math.PI*1.8-i*.08);ctx.stroke();}
    fillEllipse(ctx,0,-91,25,31,'#684b8f');
    fillEllipse(ctx,-8,-94,4,7,'#f2bd67');fillEllipse(ctx,9,-94,4,7,'#f2bd67');
    ctx.fillStyle='#433158';rounded(ctx,-38,-60,76,90,26);ctx.fill();
    ctx.strokeStyle='rgba(242,189,103,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-24,-42);ctx.lineTo(25,8);ctx.moveTo(24,-42);ctx.lineTo(-25,8);ctx.stroke();
    ctx.restore();
  }

  drawLifeSituation(ctx,t,state) {
    const instance=state.life?.active?.find(thread=>thread.location===state.location);
    if(!instance) return;
    ctx.save();
    const pulse=.72+Math.sin(t*1.7)*.18;
    if(instance.definitionId==='dad-shelf-alibi') {
      const x=this.width*.48,y=this.height*.37;
      ctx.translate(x,y);ctx.rotate(-.12+Math.sin(t*.8)*.018);
      ctx.fillStyle='#9b6d4d';rounded(ctx,-72,-5,144,14,5);ctx.fill();
      ctx.strokeStyle=`rgba(255,196,93,${pulse})`;ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(-55,9);ctx.lineTo(-70,72);ctx.moveTo(52,9);ctx.lineTo(70,72);ctx.stroke();
      for(let i=0;i<4;i+=1){ctx.fillStyle=i%2?'#6de0cf':'#f6c459';ctx.font='18px Georgia';ctx.fillText(i%2?'◇':'✦',-48+i*29,-11-Math.sin(t+i)*3);}
    } else if(instance.definitionId==='dinner-personhood') {
      const x=this.width*.5,y=this.height*.48;
      for(let i=0;i<7;i+=1){
        ctx.save();ctx.translate(x+(i-3)*23,y-46+Math.sin(t*1.1+i)*7);ctx.rotate((i-3)*.08+Math.sin(t+i)*.03);
        ctx.fillStyle='rgba(255,239,190,.86)';rounded(ctx,-13,-18,26,36,3);ctx.fill();
        ctx.strokeStyle='rgba(89,53,66,.45)';ctx.lineWidth=1;for(let l=0;l<4;l+=1){ctx.beginPath();ctx.moveTo(-8,-9+l*6);ctx.lineTo(8,-9+l*6);ctx.stroke();}ctx.restore();
      }
      fillEllipse(ctx,x,y-48,5,5,`rgba(109,224,207,${pulse})`);
    } else if(instance.definitionId==='shellby-procession') {
      for(let i=0;i<5;i+=1){
        const x=this.width*(.43+i*.045),y=this.height*(.66+Math.sin(t*1.6+i)*.012);
        ctx.fillStyle='#27444b';for(let leg=0;leg<3;leg+=1){ctx.fillRect(x-10+leg*8,y+8,3,12);}
        fillEllipse(ctx,x,y,13,10,i%2?'#50737a':'#6c5d7c');
        fillEllipse(ctx,x-4,y-2,2,2,i%2?'#f6c459':'#6de0cf');
      }
    } else if(instance.definitionId==='oracle-memory-price') {
      const x=this.width*.4,y=this.height*.3;
      const glow=ctx.createRadialGradient(x,y,4,x,y,74);glow.addColorStop(0,`rgba(255,196,93,${.22*pulse})`);glow.addColorStop(1,'rgba(255,196,93,0)');fillEllipse(ctx,x,y,74,74,glow);
      ctx.strokeStyle=`rgba(109,224,207,${pulse})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,48+Math.sin(t)*5,25,Math.sin(t*.3)*.2,0,TAU);ctx.stroke();
      ctx.fillStyle='#fff0c7';ctx.font='600 16px Georgia';ctx.textAlign='center';ctx.fillText('ONE AFTERNOON',x,y-4);ctx.fillStyle='#f6c459';ctx.font='900 20px Consolas';ctx.fillText('45₡',x,y+20);ctx.textAlign='left';
    } else if(instance.definitionId==='hushglass-heat-hearing') {
      const x=this.width*.49,y=this.height*.46;
      ctx.strokeStyle=`rgba(239,159,190,${pulse})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,42+Math.sin(t)*4,0,TAU);ctx.stroke();
      for(let i=0;i<3;i+=1){const vx=x-28+i*28;ctx.strokeStyle=i===1?'#f0b766':'#8fb4d9';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(vx,y+25);ctx.lineTo(vx,y-28);ctx.stroke();fillEllipse(ctx,vx,y-30,7,9,i===1?'#f0b766':'#8fb4d9');}
      ctx.fillStyle='#171a2e';rounded(ctx,x-55,y+34,110,23,8);ctx.fill();ctx.strokeStyle='#ef9fbe';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#ef9fbe';ctx.font='700 10px Consolas';ctx.textAlign='center';ctx.fillText('ONE NIGHT / TWO CONTRACTS',x,y+50);ctx.textAlign='left';
    } else if(instance.definitionId==='starspite-streak-refugee') {
      const x=this.width*.91,y=this.height*.77;
      ctx.globalAlpha=.72;fillEllipse(ctx,x,y-122,45,55,'#77a7bd');ctx.fillStyle='#384d69';rounded(ctx,x-58,y-72,116,105,42);ctx.fill();
      ctx.globalAlpha=1;ctx.strokeStyle=`rgba(242,189,103,${pulse})`;ctx.lineWidth=2;
      for(let i=0;i<5;i+=1){const rx=x-95+Math.sin(t*.55+i)*12,ry=y-150+i*24;rounded(ctx,rx,ry,52,17,4);ctx.stroke();ctx.fillStyle='rgba(10,8,28,.72)';ctx.fill();}
      fillEllipse(ctx,x-16,y-132,7,10,'#17112a');fillEllipse(ctx,x+17,y-132,7,10,'#17112a');
    }
    ctx.restore();
  }

  drawPip(ctx,t,state,x,floorY) {
    const moving=Math.abs(x-this.currentPipX*this.width)>.5;
    const bounce=Math.sin(t*3.4)*2;
    const scale=Math.max(.78,Math.min(1.08,this.height/470));
    ctx.save();ctx.translate(x,floorY+bounce);ctx.scale(scale,scale);
    // Shadow emphasizes tiny scale.
    fillEllipse(ctx,0,5,23,6,'rgba(7,4,12,.35)');
    // Legs and oversized jacket.
    ctx.strokeStyle='#1c1624';ctx.lineWidth=5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-7,-15);ctx.lineTo(-9,2);ctx.moveTo(7,-15);ctx.lineTo(9,2);ctx.stroke();
    ctx.fillStyle='#4a3a43';rounded(ctx,-20,-44,40,36,12);ctx.fill();
    ctx.fillStyle='#d78364';ctx.fillRect(-2,-42,4,25);
    // Head, fin ears, eyes.
    ctx.fillStyle='#4e8990';
    ctx.beginPath();ctx.moveTo(-15,-69);ctx.lineTo(-34,-58);ctx.lineTo(-16,-50);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(15,-69);ctx.lineTo(34,-58);ctx.lineTo(16,-50);ctx.closePath();ctx.fill();
    fillEllipse(ctx,0,-64,24,26,'#568f94');
    fillEllipse(ctx,-9,-66,7,10,'#1b1520');fillEllipse(ctx,9,-66,7,10,'#1b1520');
    fillEllipse(ctx,-7,-69,2.5,4,'#ffc75e');fillEllipse(ctx,11,-69,2.5,4,'#ffc75e');
    ctx.strokeStyle='#26303a';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,-53,5,.2,Math.PI-.2);ctx.stroke();
    // Box follows during the introduction.
    if(!state.portal.unlocked){ctx.fillStyle='#755440';rounded(ctx,-40,-24,26,27,4);ctx.fill();ctx.strokeStyle='#b98e60';ctx.strokeRect(-36,-18,18,10);}
    ctx.restore();
  }

  drawForeground(ctx,t,location) {
    ctx.save();
    if(location==='shore'){
      for(let i=0;i<8;i+=1){const x=seeded(i+80)*this.width;const y=this.height*(.88+seeded(i+90)*.12);fillEllipse(ctx,x,y,8+seeded(i)*15,3+seeded(i+2)*7,i%2?'#52384f':'#334b55');}
    } else if(location==='starspite') {
      ctx.fillStyle='rgba(11,7,28,.78)';ctx.fillRect(0,this.height*.92,this.width,this.height*.08);
      ctx.strokeStyle='rgba(242,189,103,.35)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,this.height*.92);ctx.lineTo(this.width,this.height*.92);ctx.stroke();
      for(let i=0;i<10;i+=1) fillEllipse(ctx,i*this.width/9,this.height*.92,3,3,i%2?'#b99aff':'#f2bd67');
    } else {
      const grad=ctx.createLinearGradient(0,this.height*.9,0,this.height);grad.addColorStop(0,'rgba(9,5,14,0)');grad.addColorStop(1,'rgba(9,5,14,.46)');ctx.fillStyle=grad;ctx.fillRect(0,this.height*.85,this.width,this.height*.15);
    }
    ctx.restore();
  }
}
