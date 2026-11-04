/* 生成「详细」面板用的扩展资料包
   ------------------------------------------------------------------
   数据源（放在 _data/dicts/，来自官方资源站 https://files.typewords.cc）：
     hb2025.json      2025 考研英语词汇红宝书（6702 词）
     hb2026.json      2026 考研英语 hongbaoshu（4770 词）
     ky2024.json      考研 2024（3731 词）
     CET4_T.json      CET-4（2607 词，仓库自带）
   按上面顺序取第一个命中的词条（红宝书优先，缺了才用别的库补）。

   每个词只保留四类内容，尽量省字节：
     e  词根 / 词源 & 记忆法（纯文本）
     p  词组 · 固定搭配  [[英文, 中文], ...]
     s  例句短句        [[英文, 中文], ...]
     r  同根词          { root: "词根/主词", ws: [[词, 中文], ...] }

   产出：
     assets/detail/manifest.json   ["abandon","absorb",...]  每个分片的首词，供二分查找
     assets/detail/0.json ...     分片，{ 单词: {e,p,s,r} }

   用法：node _data/build-detail.js
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DICT_DIR = path.join(__dirname, 'dicts');
const OUT_DIR = path.join(ROOT, 'assets', 'detail');
const CHUNK_BYTES = 200 * 1024;
const RES = 'https://files.typewords.cc/dicts/en/word/';

const SOURCES = ['hb2025.json', 'hb2026.json', 'ky2024.json', 'CET4_T.json'];

// 本地没有就从官方资源站拉一份（29MB，只拉一次）
function ensureDict(file) {
  const p = path.join(DICT_DIR, file);
  if (fs.existsSync(p) && fs.statSync(p).size > 10000) return true;
  if (!fs.existsSync(DICT_DIR)) fs.mkdirSync(DICT_DIR, { recursive: true });
  try {
    console.log('下载', file, '…');
    execSync('curl -s -L --max-time 180 -o "' + p + '" "' + RES + file + '"', { stdio: 'ignore' });
    return fs.existsSync(p) && fs.statSync(p).size > 10000;
  } catch (e) {
    return false;
  }
}


// 本站词表
global.window = {};
require(path.join(ROOT, 'assets', 'words.js'));
const ours = window.WORD_BANK.map(function (x) { return x.w; });

function norm(w) { return String(w || '').trim().toLowerCase(); }

function clip(s, n) {
  s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function readDict(file) {
  const p = path.join(DICT_DIR, file);
  if (!fs.existsSync(p)) return null;
  let arr;
  try { arr = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
  const map = new Map();
  arr.forEach(function (x) {
    const k = norm(x.word);
    if (k && !map.has(k)) map.set(k, x);
  });
  return map;
}

// 一个词条 → 精简记录
function pack(x) {
  const out = {};

  // 词根 / 词源
  const ety = Array.isArray(x.etymology) ? x.etymology : [];
  const texts = [];
  for (let i = 0; i < ety.length && texts.length < 2; i++) {
    const d = clip(ety[i] && ety[i].d, 400);
    if (d) texts.push(d);
  }
  if (texts.length) out.e = texts;

  // 词组 / 固定搭配
  const ph = Array.isArray(x.phrases) ? x.phrases : [];
  const ps = [];
  ph.forEach(function (p) {
    if (ps.length >= 6) return;
    const c = clip(p && p.c, 60), cn = clip(p && p.cn, 50);
    if (c) ps.push([c, cn]);
  });
  if (ps.length) out.p = ps;

  // 例句
  const st = Array.isArray(x.sentences) ? x.sentences : [];
  const ss = [];
  st.forEach(function (s) {
    if (ss.length >= 3) return;
    const c = clip(s && s.c, 120), cn = clip(s && s.cn, 80);
    if (c) ss.push([c, cn]);
  });
  if (ss.length) out.s = ss;

  // 同根词：同一个词可能在多个分组里重复出现，按小写词形去重
  const rw = x.relWords && Array.isArray(x.relWords.rels) ? x.relWords.rels : [];
  const ws = [];
  const seenRel = {};
  rw.forEach(function (g) {
    (g && Array.isArray(g.words) ? g.words : []).forEach(function (w) {
      if (ws.length >= 8) return;
      const c = clip(w && w.c, 30);
      if (!c) return;
      const key = c.toLowerCase();
      if (seenRel[key]) return;
      seenRel[key] = 1;
      ws.push([c, clip(w && w.cn, 40)]);
    });
  });
  if (ws.length) {
    out.r = { root: clip(x.relWords && x.relWords.root || x.word, 30), ws: ws };
  }

  return (out.e || out.p || out.s || out.r) ? out : null;
}

(function main() {
  const maps = [];
  SOURCES.forEach(function (f) {
    if (!ensureDict(f)) { console.log('跳过', f, '（拉不到）'); return; }
    const m = readDict(f);
    if (m) { maps.push({ file: f, map: m }); console.log('载入', f, m.size, '词'); }
    else console.log('跳过', f, '（解析失败）');
  });

  const packed = {};
  let hit = 0, miss = [];
  const fromWho = {};

  ours.forEach(function (w) {
    const k = norm(w);
    let rec = null, who = '';
    for (let i = 0; i < maps.length; i++) {
      const x = maps[i].map.get(k);
      if (x) {
        const p = pack(x);
        if (p) { rec = p; who = maps[i].file; break; }
      }
    }
    if (rec) {
      packed[k] = rec;
      hit++;
      fromWho[who] = (fromWho[who] || 0) + 1;
    } else {
      miss.push(w);
    }
  });

  // 按字母序排，分片，方便客户端二分定位
  const keys = Object.keys(packed).sort();
  if (fs.existsSync(OUT_DIR)) {
    fs.readdirSync(OUT_DIR).forEach(function (f) {
      if (/^(\d+\.json|manifest\.json)$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));
    });
  } else {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const manifest = [];
  const hash = crypto.createHash('md5');
  let buf = {}, bytes = 0, idx = 0, totalBytes = 0, maxOne = 0;

  function flush() {
    if (!Object.keys(buf).length) return;
    const s = JSON.stringify(buf);
    fs.writeFileSync(path.join(OUT_DIR, idx + '.json'), s);
    hash.update(s);
    totalBytes += Buffer.byteLength(s);
    idx++;
    buf = {};
    bytes = 0;
  }

  keys.forEach(function (k, i) {
    const s = JSON.stringify(packed[k]);
    maxOne = Math.max(maxOne, Buffer.byteLength(s));
    if (i === 0 || bytes + Buffer.byteLength(s) > CHUNK_BYTES) {
      flush();
      manifest.push(k);
    }
    buf[k] = packed[k];
    bytes += Buffer.byteLength(s);
  });
  flush();

  // manifest 带一个内容版本号：分片切法一变，前端请求分片的 URL 就跟着变，
  // 避免浏览器拿着旧分片配新首词表、二分定位失准。
  const ver = hash.digest('hex').slice(0, 8);
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ v: ver, c: manifest }));

  console.log('\n覆盖 ' + hit + ' / ' + ours.length + ' 词，缺 ' + miss.length + ' 个');
  console.log('来源分布', JSON.stringify(fromWho));
  if (miss.length) console.log('缺失：', miss.slice(0, 30).join(', '));
  console.log('分片 ' + idx + ' 个，合计 ' + (totalBytes / 1024 / 1024).toFixed(2) + ' MB，单条最大 '
    + (maxOne / 1024).toFixed(1) + ' KB');
})();
