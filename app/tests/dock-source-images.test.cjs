'use strict';
const assert=require('assert').strict,catalog=require('../service/dock-catalog.js');
const root=catalog.SOURCE_ICON_ROOT,native='/opt/usr/apps/device/shared/source.png';
const profiles={version:1,profiles:{console:{sourceType:13,label:'Console',icon:'console.png'}}};
const raw=['O|d/webapp@app','O|s/source.layer.hdmi@HDMI1',
 'S|'+Buffer.from(JSON.stringify({HDMI1:{EditName:'Console from Samsung',IconPath:native},HDMI2:{IconPath:native}})).toString('base64'),
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
// #297: both Homes' source lists are read, the newer one wins key by key; Samsung's device pictures (canalysis, PNG) are used, its SVG type icons are not.
{
 const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64');
 const old={HDMI1:{SourceType:13},HDMI2:{SourceType:14,EditName:'Old box'}};
 const cur={'HDMI1/0':{SourceType:13,EditName:'PS5',LauncherUnfocusedIconPath:'/usr/share/canalysis/Icon/Launcher/2K/launcher_ps5_n.png'},
   HDMI4:{SourceType:16,EditName:'PC',IconPath:'/usr/apps/com.samsung.tv.theme-resource/shared/res/VD_ICONS/i_icon_device_m_pc.svg'}};
 for(const order of [['S|100|'+enc(old),'S|200|'+enc(cur)],['S|200|'+enc(cur),'S|100|'+enc(old)]]){
  const b=catalog.build(catalog.parse(order.join('\n')),{useSourceImages:true});
  assert.deepEqual(b.inputs.slice(1).map(e=>e.label),['PS5','Old box','HDMI 3','PC'],'the newer list wins, whatever the order');
  assert.equal(b.inputs[1].icon,'/usr/share/canalysis/Icon/Launcher/2K/launcher_ps5_n.png');
  assert.equal(b.inputs[4].icon,null,'an SVG is not drawable');
 }
 const both=catalog.parse('S|1|'+enc({HDMI1:{SourceType:13}, 'HDMI1/0':{SourceType:13,DetectedName:'Switch 2'}}));
 assert.equal(catalog.build(both,{}).inputs[1].label,'Switch 2','an entry with a name first');
 assert.equal(catalog.build(catalog.parse('S|'+enc({HDMI1:{EditName:'Box'}})),{}).inputs[1].label,'Box','the old one-field line still reads');
 assert.equal(catalog.build(catalog.parse('S|1|'+enc({HDMI1:{SourceType:13,IconPath:'/usr/share/canalysis/../x.png'}})),{useSourceImages:true}).inputs[1].icon,null);
}
console.log('PASS independent native source artwork option; #297 newer source list, canalysis pictures');
assert.equal(catalog.sourceEntries(parsed,{sourceProfiles:profiles})[1].icon,null,'generic images are the fresh default');
const moved={version:1,profiles:{console:{sourceType:16,label:'Console',icon:'console.png'}}};
assert.equal(catalog.sourceEntries(parsed,{useSourceImages:true,sourceProfiles:moved})[4].icon,root+'console.png');
assert.ok(!catalog.build(parsed,{showHomeSources:true,useSourceImages:true,sourceProfiles:moved}).entries.some(e=>e.appId==='source:16'),'an image profile never inserts a missing Home source');
const invalid={version:1,profiles:{bad:{sourceType:13,label:'A\tB',icon:'../secret.png'}}};
assert.equal(catalog.sourceEntries(parsed,{useSourceImages:true,sourceProfiles:invalid})[1].icon,native);
for (const label of ['\t ', {text:'Console'}, 8]) {
 const sourceProfiles={version:1,profiles:{console:{sourceType:13,label,icon:'console.png'}}};
 const entry=catalog.sourceEntries(parsed,{useSourceImages:true,sourceProfiles})[1];
 assert.equal(entry.label,'Console from Samsung','an invalid custom label leaves the native name');
 assert.equal(entry.icon,root+'console.png','the valid artwork is still used');
}
const duplicate={version:1,profiles:{...profiles.profiles,second:{sourceType:13},third:{sourceType:13,label:'Third'}}};
const conflicted=catalog.sourceEntries(parsed,{useSourceImages:true,sourceProfiles:duplicate})[1];
assert.equal(conflicted.label,'Console from Samsung','duplicates leave the native label');
assert.equal(conflicted.icon,native,'duplicates leave the native artwork');
assert.equal(catalog.iconPathOk(root+'console.png'),true);
assert.equal(catalog.iconPathOk(root+'../secret.png'),false);
assert.equal(catalog.iconPathOk(root+'sub/icon.png'),false);
assert.equal(catalog.iconPathOk(root+'.hidden.png'),false);
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
