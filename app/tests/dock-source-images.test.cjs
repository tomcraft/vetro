'use strict';
const assert=require('assert').strict,catalog=require('../service/dock-catalog.js');
const root=catalog.SOURCE_ICON_ROOT,native='/opt/usr/apps/device/shared/source.png';
const profiles={version:1,profiles:{console:{sourceType:13,label:'Console',icon:'console.png'}}};
const raw=['O|d/webapp@app','O|s/source.layer.hdmi@HDMI1',
 'S|'+Buffer.from(JSON.stringify({HDMI1:{IconPath:native},HDMI2:{IconPath:native}})).toString('base64'),
 'R|'+['app','App','app.id'].map(s=>Buffer.from(s).toString('hex')).join('|')+'|0'].join('\n');
const parsed=catalog.parse(raw);
for(const showHomeSources of [false,true]) for(const useSourceImages of [false,true]) {
 const b=catalog.build(parsed,{showHomeSources,useSourceImages,sourceProfiles:profiles});
 assert.deepEqual(b.entries.map(e=>e.appId),showHomeSources?['app.id','source:13']:['app.id']);
 assert.equal(b.inputs[1].label,'Console');
 assert.equal(b.inputs[1].icon,useSourceImages?root+'console.png':null);
 assert.equal(b.inputs[2].icon,useSourceImages?native:null);
 assert.equal(b.inputs[0].icon,null,'TV artwork stays generic');
 assert.deepEqual(b.inputs.map(e=>e.appId),['source:0','source:13','source:14','source:15','source:16']);
 if(showHomeSources) assert.equal(b.entries[1].icon,b.inputs[1].icon);
}
assert.equal(catalog.sourceEntries(parsed,{sourceProfiles:profiles})[1].icon,null,'generic images are the fresh default');
const moved={version:1,profiles:{console:{sourceType:16,label:'Console',icon:'console.png'}}};
assert.equal(catalog.sourceEntries(parsed,{useSourceImages:true,sourceProfiles:moved})[4].icon,root+'console.png');
assert.ok(!catalog.build(parsed,{showHomeSources:true,useSourceImages:true,sourceProfiles:moved}).entries.some(e=>e.appId==='source:16'),'an image profile never inserts a missing Home source');
const invalid={version:1,profiles:{bad:{sourceType:13,label:'A\tB',icon:'../secret.png'}}};
assert.equal(catalog.sourceEntries(parsed,{useSourceImages:true,sourceProfiles:invalid})[1].icon,native);
assert.equal(catalog.iconPathOk(root+'console.png'),true);
assert.equal(catalog.iconPathOk(root+'../secret.png'),false);
assert.equal(catalog.iconPathOk('/opt/usr/home/owner/share/secret.png'),false);
(async()=>{
 const b=await catalog.load(async cmd=>{
  const script=Buffer.from(cmd.split(' ')[1],'base64').toString();
  return {exit_code:0,stdout:script.includes('.appLayerCache')?raw:'OK|'+native+'\n'};
 },{showHomeSources:true,useSourceImages:true,sourceProfiles:profiles});
 assert.ok(b.tsv.includes(native)&&b.inputsTsv.includes(native),'missing custom image falls back on both pages');
 assert.ok(!b.tsv.includes(root)&&!b.inputsTsv.includes(root));
 console.log('PASS source artwork: four independent option combinations, profile reassignment, safe paths and missing-image fallback');
})().catch(e=>{console.error(e);process.exitCode=1});
