/* 把 assets/hand-both.svg 内联成 assets/hands.js。
   源文件是逆向出来的原始素材（58 个姿势图层，每层 = 一整只手的静态画）。
   这里只做四件事：去掉 XML 头和 <style>、给 id 加 hb- 前缀防冲突、压缩空白、包成 JS 字符串。
   图层的显示/隐藏由 app.js 的 focusHand() 负责，跟原站一致。 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'assets/hand-both.svg'), 'utf8');

let s = src;
// 1. 去掉 XML 声明和 Illustrator 注释
s = s.replace(/<\?xml[\s\S]*?\?>/g, '');
s = s.replace(/<!--[\s\S]*?-->/g, '');
// 2. 去掉自带 <style>：里面的 .st0~.st5 是全局类名，会污染页面，改由 style.css 收口
s = s.replace(/<style[\s\S]*?<\/style>/g, '');
// 3. id 打前缀，避免 key="y" / key="space" 这类短 id 和页面元素撞车
s = s.replace(/\bid="([^"]+)"/g, 'id="hb-$1"');
// 4. 去掉 SVG 根上的内联 style，尺寸完全交给 CSS
s = s.replace(/\sstyle="enable-background:[^"]*"/g, '');
s = s.replace(/\sxml:space="preserve"/g, '');
// 压缩空白（path 的 d 属性内容不受影响）
s = s.replace(/\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

const out = `/* 自动生成，勿手改：_data/build-hands.js ← assets/hand-both.svg
   58 个图层：neutral-left / neutral-right 是放松姿势，其余每个键一层。
   运行时同时显示左右手各一层（display:block），其余 display:none。 */
window.HANDS_SVG = ${JSON.stringify(s)};
`;
fs.writeFileSync(path.join(root, 'assets/hands.js'), out, 'utf8');

const layers = [...s.matchAll(/<g id="hb-([^"]+)"/g)].map(m => m[1]);
console.log('layers:', layers.length);
console.log('size:', (out.length / 1024).toFixed(0) + ' KB');
console.log('head:', s.slice(0, 140));
