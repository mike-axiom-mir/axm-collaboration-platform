'use strict';

const Raster=require('../asset-hands/raster-codec');
const Atlas=require('./atlas');

function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function project(point){return[(point[0]-point[2])*.78,-point[1]+(point[0]+point[2])*.34,(point[0]+point[2])*.5+point[1]*.08];}
function edge(a,b,x,y){return(x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]);}
function put(rgba,width,height,x,y,colour){if(x<0||y<0||x>=width||y>=height)return;const at=(y*width+x)*4;rgba[at]=colour[0];rgba[at+1]=colour[1];rgba[at+2]=colour[2];rgba[at+3]=255;}
function fillTriangle(rgba,width,height,points,colour){const minX=clamp(Math.floor(Math.min(...points.map(p=>p[0]))),0,width-1),maxX=clamp(Math.ceil(Math.max(...points.map(p=>p[0]))),0,width-1),minY=clamp(Math.floor(Math.min(...points.map(p=>p[1]))),0,height-1),maxY=clamp(Math.ceil(Math.max(...points.map(p=>p[1]))),0,height-1),area=edge(points[0],points[1],points[2][0],points[2][1]);if(Math.abs(area)<.001)return;for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const w0=edge(points[1],points[2],x+.5,y+.5),w1=edge(points[2],points[0],x+.5,y+.5),w2=edge(points[0],points[1],x+.5,y+.5);if((area>0&&w0>=0&&w1>=0&&w2>=0)||(area<0&&w0<=0&&w1<=0&&w2<=0))put(rgba,width,height,x,y,colour);}}
function background(rgba,width,height){for(let y=0;y<height;y++)for(let x=0;x<width;x++){const at=(y*width+x)*4,grid=(x%32===0||y%32===0)?8:0;rgba[at]=8+grid;rgba[at+1]=16+grid;rgba[at+2]=28+grid;rgba[at+3]=255;}}
const FONT={A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'101111111111101',O:'010101101101010',P:'110101110100100',Q:'010101101111011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110','4':'101101111001001','5':'111100110001110','6':'011100110101010','7':'111001010010010','8':'010101010101010','9':'010101011001110','-':'000000111000000','_':'000000000000111'};
function fillRect(rgba,width,height,x,y,w,h,colour){for(let py=Math.floor(y);py<Math.floor(y+h);py++)for(let px=Math.floor(x);px<Math.floor(x+w);px++)put(rgba,width,height,px,py,colour);}
function drawText(rgba,width,height,text,x,y,colour,scale){let cursor=Math.floor(x);for(const raw of String(text||'').toUpperCase()){const glyph=FONT[raw]||'000000000000000';for(let gy=0;gy<5;gy++)for(let gx=0;gx<3;gx++)if(glyph[gy*3+gx]==='1')fillRect(rgba,width,height,cursor+gx*scale,y+gy*scale,scale,scale,colour);cursor+=4*scale;}}
function render(meshes,profile,options){
  options=options||{};const width=options.width||1000,height=options.height||800,columns=options.columns||5,rows=Math.ceil(meshes.length/columns),cellW=width/columns,cellH=height/Math.max(1,rows),rgba=new Uint8Array(width*height*4);background(rgba,width,height);
  const cells=[];
  meshes.forEach((entry,index)=>{const col=index%columns,row=Math.floor(index/columns),projected=entry.mesh.triangles.flatMap(t=>t.points.map(project)),minX=Math.min(...projected.map(p=>p[0])),maxX=Math.max(...projected.map(p=>p[0])),minY=Math.min(...projected.map(p=>p[1])),maxY=Math.max(...projected.map(p=>p[1])),scale=Math.min((cellW-22)/Math.max(.1,maxX-minX),(cellH-52)/Math.max(.1,maxY-minY)),cx=col*cellW+cellW/2,cy=row*cellH+(cellH-20)/2,triangles=entry.mesh.triangles.map(t=>{const pts=t.points.map(project).map(p=>[(p[0]-(minX+maxX)/2)*scale+cx,(p[1]-(minY+maxY)/2)*scale+cy,p[2]]);return{points:pts,material:t.material,depth:pts.reduce((sum,p)=>sum+p[2],0)/3,normalShade:Math.max(.48,Math.min(1,.72+(t.points[0][1]+t.points[1][1]+t.points[2][1])*.012))};}).sort((a,b)=>a.depth-b.depth);
    triangles.forEach(t=>{const base=Atlas.rgb(profile.palette[t.material]||profile.palette.bark),shade=t.normalShade,colour=base.map(v=>clamp(Math.round(v*shade),0,255));fillTriangle(rgba,width,height,t.points,colour);});
    const familyColour=Atlas.rgb({building:'#68d9e7',road:'#8b8f9d',prop:'#85d49d',vehicle:'#edb56e',character:'#d18ed3'}[entry.category]);for(let x=Math.floor(col*cellW+6);x<Math.floor((col+1)*cellW-6);x++)for(let y=Math.floor(row*cellH+6);y<Math.floor(row*cellH+10);y++)put(rgba,width,height,x,y,familyColour);
    cells.push({assetId:entry.id,category:entry.category,column:col,row:row,bounds:{x:col*cellW,y:row*cellH,width:cellW,height:cellH}});
  });
  cells.forEach(cell=>{const familyColour=Atlas.rgb({building:'#68d9e7',road:'#8b8f9d',prop:'#85d49d',vehicle:'#edb56e',character:'#d18ed3'}[cell.category]),labelY=Math.floor((cell.row+1)*cellH-20),labelX=Math.floor(cell.column*cellW+6);fillRect(rgba,width,height,labelX,labelY,cellW-12,16,[5,10,18]);fillRect(rgba,width,height,labelX,labelY,4,16,familyColour);drawText(rgba,width,height,cell.assetId,labelX+9,labelY+3,[224,232,239],2);});
  const encoded=Raster.encodeRgba(width,height,rgba,{colourSpace:'srgb'});return{schema:'axm.game-asset-contact-sheet/v1',width,height,cells,png:encoded.bytes,dataUrl:encoded.dataUrl,inspection:encoded.inspection};
}

module.exports={render};
