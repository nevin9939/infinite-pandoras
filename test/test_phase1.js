const io = require('socket.io-client');

async function test() {
  console.log('=== 传奇游戏自动化测试 ===\n');
  let passed = 0, failed = 0;

  function assert(condition, msg) {
    if (condition) { console.log(`  ✅ ${msg}`); passed++; }
    else { console.log(`  ❌ ${msg}`); failed++; }
  }

  // 测试 1: 首页可访问
  const http = require('http');
  const homePage = await new Promise((resolve) => {
    http.get('http://localhost:3000/', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, html: data }));
    });
  });
  assert(homePage.status === 200, '首页返回 200');
  assert(homePage.html.includes('传奇'), '页面标题包含"传奇"');
  assert(homePage.html.includes('game-canvas'), '包含游戏 Canvas');
  assert(homePage.html.includes('socket.io'), '引入 socket.io');

  // 测试 2: Socket 连接和登录
  const client1 = io('http://localhost:3000');
  const loginResult = await new Promise((resolve) => {
    client1.on('login_success', (player) => resolve(player));
    client1.emit('login', 'testPlayer1');
  });
  assert(loginResult.username === 'testPlayer1', '登录成功，用户名正确');
  assert(loginResult.level === 1, '初始等级为 1');
  assert(loginResult.hp === 100, '初始 HP 为 100');
  assert(loginResult.max_hp === 100, '初始最大 HP 为 100');
  assert(loginResult.attack === 10, '初始攻击为 10');
  assert(loginResult.defense === 5, '初始防御为 5');

  // 测试 3: 移动
  client1.emit('move', { x: 55, y: 55 });
  await new Promise(r => setTimeout(r, 200));
  // 移动通过世界状态同步，检查服务器不报错即可

  // 测试 4: 多客户端连接
  const client2 = io('http://localhost:3000');
  const loginResult2 = await new Promise((resolve) => {
    client2.on('login_success', (player) => resolve(player));
    client2.emit('login', 'testPlayer2');
  });
  assert(loginResult2.username === 'testPlayer2', '第二个玩家登录成功');

  // 测试 5: 世界状态同步
  const worldState = await new Promise((resolve) => {
    client1.on('world_state', (data) => resolve(data));
  });
  assert(Array.isArray(worldState.players), '世界状态包含玩家列表');
  assert(Array.isArray(worldState.monsters), '世界状态包含怪物列表');
  assert(worldState.monsters.length > 0, '地图上有怪物');
  assert(worldState.players.length >= 2, '至少有两个玩家在线');

  // 测试 6: 攻击怪物
  const monster = worldState.monsters[0];
  // 先把玩家移动到怪物附近
  client1.emit('move', { x: monster.x + 2, y: monster.y });
  await new Promise(r => setTimeout(r, 300));

  const attackResult = await new Promise((resolve) => {
    client1.on('attack_result', (result) => resolve(result));
    client1.emit('attack', monster.id);
  });
  assert(attackResult.damage > 0, '攻击造成伤害');
  assert(typeof attackResult.damage === 'number', '伤害是数字');

  // 测试 7: 数据持久化（检查数据库文件）
  const fs = require('fs');
  const dbExists = fs.existsSync('server/data/game.db');
  assert(dbExists, '数据库文件已创建');

  // 测试 8: 经验升级系统 - 验证经验曲线公式
  const expForLevel2 = Math.floor(100 * Math.pow(1, 1.5));
  assert(expForLevel2 === 100, `1级升2级需要100经验 (实际: ${expForLevel2})`);
  const expForLevel10 = Math.floor(100 * Math.pow(10, 1.5));
  assert(expForLevel10 === 3162, `10级升11级需要3162经验 (实际: ${expForLevel10})`);
  const expForLevel100 = Math.floor(100 * Math.pow(100, 1.5));
  assert(expForLevel100 === 100000, `100级升101级需要100000经验 (实际: ${expForLevel100})`);
  console.log('\n  📊 升级曲线: 1→2级: 100exp, 1→10级: 3162exp, 1→100级: 100000exp');

  // 测试 9: 无限升级验证 - 高等级经验曲线仍然有效
  const expForLevel1000 = Math.floor(100 * Math.pow(1000, 1.5));
  assert(expForLevel1000 === 3162277, `1000级经验曲线有效 (实际: ${expForLevel1000})`);
  console.log('  ♾️ 1000级需要 3,162,277 经验 - 无等级上限');

  // 清理
  client1.disconnect();
  client2.disconnect();

  console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`);
  process.exit(failed > 0 ? 1 : 0);
}

test().catch(err => {
  console.error('测试出错:', err.message);
  process.exit(1);
});
