# 项目约定（长期）

## 改完之后主动问发布

- 每次完成会影响网站行为的改动（`index.html` / `assets/*.js` / `assets/*.css` / 素材）后，
  **在回复末尾主动问一句「是否要同步网站」**，不要等用户想起来，也不要自行发布。
- 只有用户当轮明确说「同步 / 发布 / 上线 / 更新线上」时才调用发布工具；
  发布是覆盖，链接保持不变。
- 发布后核对线上文件是否真的换版（例如拉 `assets/app.js` 查新函数名/新文案），并提醒 Ctrl+F5 强刷缓存。

## 当前线上地址

- https://word-type-drill.app.workbuddy.host/?sharecode=O2R53LFMQD
- 应用管理：设置—数据管理—应用

## Git

- 远程：https://github.com/123jklskv/-.git（main）
- 系统代理 `127.0.0.1:4274` 出站失效时，git 走 `127.0.0.1:7897`：
  `git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push`
- 只提交影响网站功能的文件；`_data/re/`（验证脚本、截图）已在 .gitignore 中。
