'use strict';

const Raster=require('../asset-hands/raster-codec');
const Atlas=require('./atlas');
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function put(pixels,w,h,x,y,c){x=x|0;y=y|0;if(x<0||y<0||x>=w||y>=h)return;const i=(y*w+x)*4;pixels[i]=c[0];pixels[i+1]=c[1];pixels[i+2]=c[2];pixels[i+3]=255;}
function line(pixels,w,h,a,b,c){let x0=a[0]|0,y0=a[1]|0,x1=b[0]|0,y1=b[1]|0,dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,e=dx+dy;for(;;){put(pixels,w,h,x0,y0,c);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}}
function edge(a,b,x,y){return(x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]);}
function fillTri(pixels,depthBuffer,w,h,p,c){
  const x0=clamp(Math.floor(Math.min(...p.map(v=>v[0]))),0,w-1),x1=clamp(Math.ceil(Math.max(...p.map(v=>v[0]))),0,w-1),y0=clamp(Math.floor(Math.min(...p.map(v=>v[1]))),0,h-1),y1=clamp(Math.ceil(Math.max(...p.map(v=>v[1]))),0,h-1),area=edge(p[0],p[1],p[2][0],p[2][1]);
  if(Math.abs(area)<.001)return;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const a=edge(p[1],p[2],x+.5,y+.5),b=edge(p[2],p[0],x+.5,y+.5),d=edge(p[0],p[1],x+.5,y+.5),inside=(area>0&&a>=0&&b>=0&&d>=0)||(area<0&&a<=0&&b<=0&&d<=0);
    if(!inside)continue;
    const z=(a*p[0][2]+b*p[1][2]+d*p[2][2])/area,index=y*w+x;
    if(z>=depthBuffer[index]){depthBuffer[index]=z;put(pixels,w,h,x,y,c);}
  }
}
function ellipse(pixels,w,h,cx,cy,rx,ry,c){for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)put(pixels,w,h,x,y,c);}
function normal(points){const a=points[0],b=points[1],c=points[2],u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;return n.map(v=>v/l);}
function render(entries,layout,profile,options){
  const width=options&&options.width||1600,height=options&&options.height||900,pixels=new Uint8Array(width*height*4),depthBuffer=new Float64Array(width*height),horizon=Math.floor(height*.52),byId=new Map(entries.map(item=>[item.id,item]));depthBuffer.fill(-Infinity);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;if(y<horizon){const t=y/horizon;pixels[i]=Math.round(22+28*t);pixels[i+1]=Math.round(40+36*t);pixels[i+2]=Math.round(68+38*t);}else{const n=((x*13+y*7)%41)/41;pixels[i]=Math.round(39+n*6);pixels[i+1]=Math.round(45+n*6);pixels[i+2]=Math.round(48+n*7);}pixels[i+3]=255;}
  const yaw=-.62,pitch=.48,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),scale=17.5,project=p=>{const rx=p[0]*cy-p[2]*sy,rz=p[0]*sy+p[2]*cy,ry=p[1]*cp-rz*sp,depth=p[1]*sp+rz*cp;return[width*.5+rx*scale,height*.66-ry*scale,depth];};
  for(let n=-40;n<=40;n+=4){line(pixels,width,height,project([n,0,-40]),project([n,0,40]),[55,64,68]);line(pixels,width,height,project([-40,0,n]),project([40,0,n]),[55,64,68]);}
  const triangles=[];for(const instance of layout.instances){const entry=byId.get(instance.assetId);if(!entry)continue;const angle=Number(instance.rotationY)||0,c=Math.cos(angle),s=Math.sin(angle),position=instance.position||[0,0,0],transform=p=>[p[0]*c-p[2]*s+position[0],p[1]+position[1],p[0]*s+p[2]*c+position[2]],centre=project(position),radius={building:65,road:18,prop:13,vehicle:27,character:8}[entry.category]||18;ellipse(pixels,width,height,centre[0]+9,centre[1]+6,radius,radius*.28,[22,27,30]);for(const source of entry.mesh.triangles){const world=source.points.map(transform),screen=world.map(project),nrm=normal(world),light=clamp(.6+nrm[0]*-.18+nrm[1]*.28+nrm[2]*-.12,.32,1.05);triangles.push({screen,depth:screen.reduce((sum,p)=>sum+p[2],0)/3,material:source.material,light});}}
  triangles.sort((a,b)=>a.depth-b.depth);for(const item of triangles){const base=Atlas.rgb(profile.palette[item.material]||profile.palette.concrete),colour=base.map(v=>clamp(Math.round(v*item.light),0,255));fillTri(pixels,depthBuffer,width,height,item.screen,colour);}
  const encoded=Raster.encodeRgba(width,height,pixels,{colourSpace:'srgb'});return{schema:'axm.game-asset-scene-proof/v1',width,height,instances:layout.instances.length,triangles:triangles.length,png:encoded.bytes,dataUrl:encoded.dataUrl,inspection:encoded.inspection};
}
module.exports={render};
