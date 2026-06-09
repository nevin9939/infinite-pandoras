# 传奇网页版 - Agent 协作指南

## 项目概述

开发一款网页版传奇游戏，支持无限升级、多职业、装备系统、副本、公会、PK 等功能。

**游戏地址**：`http://localhost:3000`

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端渲染 | HTML + JavaScript + Canvas | 2D 俯视角游戏，零依赖 |
| 前端 UI | 原生 HTML/CSS | 血条、背包、技能栏等 UI 面板 |
| 后端 | Node.js + Express | RESTful API + WebSocket 实时通信 |
| 数据库 | SQLite (sql.js) | 轻量级，数据文件存储在 `server/data/game.db` |
| 通信 | WebSocket (socket.io) | 实时战斗、PK、聊天 |

## 文件结构

```
pandoras/
├── client/                 # 前端
│   ├── index.html          # 游戏主页面
│   ├── css/
│   │   └── game.css        # 游戏样式
│   ├── js/
│   │   └── game.js         # 游戏主逻辑（渲染、输入、Socket 事件、UI）
│   └── assets/
│       ├── tilesets/       # 地图瓦片图（待添加）
│       ├── sprites/        # 角色精灵图（待添加）
│       └── sounds/         # 音效（待添加）
├── server/                 # 后端
│   ├── index.js            # 服务入口（Express + Socket.IO）
│   ├── game/
│   │   ├── engine.js       # 游戏引擎核心（职业、装备、副本、公会、PK）
│   │   └── socket.js       # Socket 事件处理
│   ├── db/
│   │   └── database.js     # 数据库连接和初始化
│   └── data/
│       └── game.db         # SQLite 数据文件（⚠️ 不要删除！）
├── package.json
├── test_all.js             # 全量测试脚本
└── test_bugs.js            # Bug 修复验证脚本
```

## 已实现功能

### 阶段一：基础游戏框架 ✅
- 瓦片地图渲染（Canvas 2D 俯视角）
- WASD 键盘移动 + 鼠标点击移动
- 相机跟随玩家
- 怪物 AI（巡逻、追击玩家、攻击玩家）
- 战斗系统（点击怪物攻击、伤害计算、死亡判定）
- 无限升级系统（经验曲线：`exp = 100 × level^1.5`）
- 伤害数字飘字效果
- 数据持久化（SQLite 保存玩家数据）

### 阶段二：多职业系统 ✅
- **战士**：高 HP、近战、高防御，技能：烈火剑法、双龙斩、逐日剑法、狂暴之力
- **法师**：低 HP、高 MP、远程、强输出，技能：火球术、冰咆哮、雷电术、流星火雨
- **道士**：均衡、可治疗/召唤，技能：治愈术、施毒术、召唤神兽、灵魂火符
- 每 10 级自动解锁新技能
- 职业差异化成长率（HP/MP/攻击/防御）

### 阶段三：装备系统 ✅
- 6 个装备槽位：武器、衣服、头盔、项链、手镯、戒指
- 5 种品质：普通、优秀、精良、史诗、传说
- 怪物击杀掉落装备（掉落率随怪物等级提升）
- 背包系统（背包面板显示掉落装备）
- 装备穿戴/卸下，属性实时计算
- 装备等级要求限制

### 阶段四：副本系统 ✅
- 3 个副本：矿洞（Lv.5）、沃玛寺庙（Lv.15）、祖玛寺庙（Lv.25）
- 每个副本有 Boss 和普通怪物
- 等级不足无法进入副本
- Boss 掉落专属装备奖励

### 阶段五：公会系统 ✅
- 创建公会（需要 100 金币）
- 加入/退出公会
- 公会列表查看
- 会长转让/解散

### 阶段六：PK 系统 ✅
- 安全区（比奇城）禁止 PK
- 野外区域可以 PVP
- 红名系统（PK 点数累积）
- 击杀掠夺 10% 金币
- PK 状态查询

### 新增功能 ✅
- **连接状态指示器**：顶部 HUD 显示连接状态（绿=已连接，红=已断开）
- **人物属性面板**：左侧显示等级、攻击、防御、生命、魔法、经验、金币
- **横向技能栏**：底部横向排列技能按钮，支持快捷键 1-4
- **自动攻击**：点击怪物后持续自动攻击，直到怪物死亡
- **挂机模式**：一键开启，自动寻找怪物、自动移动、自动攻击、自动切换目标

## 启动服务器

```bash
cd /Users/wch/Documents/work_self/pandoras
./restart.sh
```

**⚠️ 重要规则：重启服务器时绝对不能删除 `server/data/` 目录！**

```bash
# ✅ 正确做法 - 使用重启脚本（推荐）
./restart.sh

# ✅ 手动重启（正确做法）
kill $(lsof -ti :3000) 2>/dev/null; sleep 1 && node server/index.js &

# ❌ 错误做法（会删除所有玩家数据！）
kill $(lsof -ti :3000); rm -rf server/data; node server/index.js
```

**防护机制**：
1. `restart.sh` 脚本：封装正确的重启流程
2. `server/index.js` 启动时自动创建 `server/data/` 目录（如果不存在）
3. `.gitignore` 排除 `server/data/` 防止误提交
```

## 测试

```bash
# 全量测试（6 个阶段所有功能）
node test_all.js

# Bug 修复验证
node test_bugs.js
```

## 游戏操作

| 操作 | 说明 |
|------|------|
| WASD / 方向键 | 移动角色 |
| 鼠标点击怪物 | 选择目标并攻击，启动自动攻击 |
| 鼠标点击空地 | 移动到该位置，停止自动攻击 |
| 数字键 1-4 | 使用对应技能 |
| 双击背包装备 | 装备物品 |
| 单击已装备物品 | 卸下装备 |
| 顶部"挂机"按钮 | 开启/关闭挂机模式 |

## Bug 根因分析与预防规则

### 🔴 绝对禁止（Severity: Critical）

| # | 规则 | 原因 | 案例 |
|---|------|------|------|
| 1 | **永远不要 `rm -rf server/data`** | 删除所有玩家数据，不可恢复 | 多次测试中误删导致数据丢失 |
| 2 | **永远不要用 `sed` 编辑 JS/JSON 文件** | 转义符处理不当导致语法错误，难以排查 | 添加 BOSS 怪物时 sed 产生 `U0001f451` 乱码 |

### 🟠 动态 DOM 事件绑定（Severity: High）

**问题**：`world_state` 每 100ms 触发一次 `updateInventory()`，会 `innerHTML = ''` 重建整个背包 DOM，导致之前绑定的 `click`/`dblclick` 事件监听器丢失。

**预防规则**：
- ✅ 使用 `pointerdown` 事件代替 `click`（响应更快，兼容性更好）
- ✅ 或者使用**事件委托**——在父容器上绑定监听器，通过 `e.target.closest()` 查找触发元素
- ✅ 记录操作索引（如 `lastEquipIndex`），通过服务器响应索引删除，不依赖 DOM 引用

```javascript
// ❌ 错误：直接绑定到元素，DOM 重建后丢失
div.addEventListener('click', () => socket.emit('equip', idx));

// ✅ 正确：使用 pointerdown + 索引追踪
div.addEventListener('pointerdown', e => { e.preventDefault(); socket.emit('equip', idx); });
```

### 🟠 对象引用比较（Severity: High）

**问题**：服务器返回的对象和客户端 `inventory` 中的对象不是同一个引用，`item !== r.equipped` 永远为 true。

**预防规则**：
- ✅ 使用**索引**删除：发送请求时记录索引，响应时按索引 `splice(index, 1)`
- ✅ 或使用**属性匹配**：`item.name === eq.name && item.slot === eq.slot`
- ❌ 永远不要用 `!==` 比较来自不同源的对象

```javascript
// ❌ 错误：对象引用比较
state.player.inventory = state.player.inventory.filter(item => item !== r.equipped);

// ✅ 正确：按索引删除
if (lastEquipIndex >= 0 && state.player.inventory.length > lastEquipIndex) {
  state.player.inventory.splice(lastEquipIndex, 1);
}
```

### 🟠 `world_state` 覆盖客户端本地状态（Severity: High）

**问题**：`world_state` 从服务器同步 HP/经验/等级，与客户端本地累积逻辑冲突，导致经验条不更新、血条跳动。

**预防规则**：
- ✅ `world_state` **只同步**：装备、属性（attack/defense）、金币
- ✅ **不在 `world_state` 中同步**：exp、level、HP、MP、inventory
- ✅ exp/level 只在 `attack_result.killed` 事件中本地更新
- ✅ HP/MP 只在受伤事件和自动恢复中本地更新

```javascript
// ✅ 正确：world_state 中不同步经验/等级/金币
if (me) {
  state.player.equipment = me.equipment || {};
  state.player.attack = me.attack;
  state.player.defense = me.defense;
  // 经验、等级、HP、MP、金币不在这里同步！
}
```

### 🟡 移动和攻击的时序问题（Severity: Medium）

**问题**：客户端移动和攻击通过 Socket.IO 发送到服务器，存在微小延迟。当攻击请求到达时，服务器可能还没处理完移动请求。

**预防规则**：
- ✅ 服务器攻击范围要足够大（>5 格），给移动同步留出缓冲
- ✅ 客户端移动间隔 >= 50ms，攻击间隔 >= 200ms
- ✅ 挂机时先移动再攻击，中间留出至少 1 帧间隔
- ✅ 移动和攻击不在同一个循环迭代中同时执行

### 🟡 商店物品缺少 `slot` 属性（Severity: Medium）

**问题**：商店物品只有 `type`（weapon/armor/jewelry），没有 `slot`（weapon/armor/necklace），导致装备到 `undefined` 槽位。

**预防规则**：
- ✅ 商店物品定义时**必须包含 `slot` 属性**
- ✅ 或在购买时自动推导：`const typeToSlot = {weapon:'weapon',armor:'armor',jewelry:'necklace'}`
- ✅ 服务器 `equipItem` 中兜底：如果没有 `slot`，从 `type` 推导

```javascript
// ✅ 服务器端兜底
function equipItem(player, item) {
  if (!item.slot && item.type) {
    item.slot = {weapon:'weapon',armor:'armor',jewelry:'necklace'}[item.type] || 'necklace';
  }
  // ...
}
```

### 🟡 Tooltip 定位溢出屏幕（Severity: Medium）

**问题**：背包面板在屏幕右侧，Tooltip 使用 `position: absolute; left: 105%` 会推出屏幕外。

**预防规则**：
- ✅ 屏幕右侧的面板：Tooltip 用 `right: 105%`（向左弹出）
- ✅ 或使用 `position: fixed` 固定在屏幕内的安全位置
- ✅ 添加 `pointer-events: none` 防止 Tooltip 拦截鼠标事件

### 🟡 新增函数未定义（Severity: Medium）

**问题**：在渲染中调用了 `renderParticles()` 但没有定义该函数。

**预防规则**：
- ✅ 修改代码后必须运行 `node -c client/js/game.js` 检查语法
- ✅ 新增函数调用前确保函数已定义
- ✅ 使用 `grep -n "function renderParticles"` 确认存在

### 🟢 浏览器缓存旧代码（Severity: Low）

**问题**：修改 JS 后浏览器仍然加载旧版本。

**预防规则**：
- ✅ 在 `<script>` 标签中添加版本号：`<script src="/js/game.js?v=N"></script>`
- ✅ 每次修改 JS 后递增版本号
- ✅ 提醒用户使用 `Cmd + Shift + R` 硬刷新
- ✅ 服务器配置 `Cache-Control: no-cache` 响应头

## 协作注意事项

### 数据库安全
- **永远不要执行** `rm -rf server/data` 或任何删除数据库的操作
- 数据库文件 `server/data/game.db` 包含所有玩家数据
- 测试时如需清理数据，应先与用户确认

### 前端缓存
- 浏览器可能缓存旧的 JavaScript 文件
- 修改代码后提醒用户硬刷新（Cmd+Shift+R）
- 服务器已配置 `Cache-Control: no-cache` 响应头

### Socket 通信
- 客户端通过 Socket.IO 与服务器通信
- 事件：`login`（登录）、`move`（移动）、`attack`（攻击）、`equip`（装备）、`skill`（技能）等
- 服务器通过 `world_state` 广播玩家和怪物状态

### 装备系统注意事项
- `equip` 事件通过 `socket.emit('equip', itemIndex)` 发送
- 背包物品索引从 0 开始
- 装备成功后会更新玩家的 `equipment` 对象，并从 `inventory` 中移除
- 装备属性（攻击/防御/HP/MP）会影响角色总属性

### 挂机功能
- 挂机模式下会自动寻找最近怪物、移动过去、攻击、切换目标
- 挂机定时器间隔为 1000ms
- 点击空地或怪物可停止挂机

## 已知问题 / 待优化

- 装备/精灵图等视觉素材尚未添加，当前使用 Canvas 绘制简单图形
- 音效系统尚未实现
- 多人在线同屏战斗优化
- 副本独立实例化（当前副本为共享世界状态）
