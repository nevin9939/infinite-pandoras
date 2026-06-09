const io = require('socket.io-client');

async function test() {
  console.log('=== 副本+公会+PK 快速测试 ===\n');
  let passed = 0, failed = 0;
  function assert(c, m) { if(c){console.log(`  ✅ ${m}`);passed++;}else{console.log(`  ❌ ${m}`);failed++;} }

  const c1 = io('http://localhost:3000');
  let dungeonInfo = null;
  // 提前注册所有可能的事件
  c1.on('dungeon_info', info => { dungeonInfo = info; });
  c1.on('dungeon_entered', () => {});
  c1.on('guild_error', () => {});
  c1.on('guild_created', () => {});
  c1.on('guild_joined', () => {});
  c1.on('guild_list', () => {});
  c1.on('pvp_result', () => {});
  c1.on('pvp_error', () => {});
  c1.on('pvp_attacked', () => {});
  c1.on('pk_status', () => {});

  const p1 = await new Promise((resolve) => {
    c1.on('login_success', p => resolve(p));
    c1.emit('login', { username: 'test_user1', playerClass: 'warrior' });
  });
  await new Promise(r => setTimeout(r, 800));

  // 副本
  console.log('-- 副本 --');
  assert(dungeonInfo !== null, '副本信息');
  assert(dungeonInfo.cave.levelReq === 5, '矿洞Lv5');
  assert(dungeonInfo.zumma.boss.name === '祖玛教主', '祖玛Boss');
  assert(dungeonInfo.woma.rewards.length > 0, '沃玛奖励');

  // 公会
  console.log('-- 公会 --');
  assert(p1.gold === 0, '初始金币0');

  // PK
  console.log('-- PK --');
  const c2 = io('http://localhost:3000');
  const p2 = await new Promise((resolve) => {
    c2.on('login_success', p => resolve(p));
    c2.emit('login', { username: 'test_user2', playerClass: 'mage' });
  });
  await new Promise(r => setTimeout(r, 800));

  c1.emit('move', { x: 10, y: 10 });
  c2.emit('move', { x: 12, y: 10 });
  await new Promise(r => setTimeout(r, 500));

  let pvpOk = false;
  c1.once('pvp_result', () => { pvpOk = true; });
  c1.emit('pvp_attack', c2.id);
  await new Promise(r => setTimeout(r, 1000));
  assert(pvpOk, 'PVP攻击');

  let safeBlock = false;
  c1.on('pvp_error', (r) => { if (r.error === 'safe_zone') safeBlock = true; });
  c1.emit('move', { x: 50, y: 50 });
  c2.emit('move', { x: 50, y: 50 });
  await new Promise(r => setTimeout(r, 500));
  c1.emit('pvp_attack', c2.id);
  await new Promise(r => setTimeout(r, 1000));
  assert(safeBlock, '安全区阻止');

  const pk = await new Promise((resolve) => {
    c1.once('pk_status', s => resolve(s));
    c1.emit('pk_status');
  });
  assert(pk.pkPoints > 0, '有PK点');
  assert(pk.inSafeZone, '在安全区');

  c1.disconnect(); c2.disconnect();
  console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
  process.exit(failed > 0 ? 1 : 0);
}

test().catch(err => { console.error('错误:', err.message); process.exit(1); });
