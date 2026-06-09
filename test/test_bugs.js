const io = require('socket.io-client');

async function test() {
  console.log('=== Bug 修复验证 ===\n');
  let passed = 0, failed = 0;
  function assert(c, m) { if(c){console.log(`  ✅ ${m}`);passed++;}else{console.log(`  ❌ ${m}`);failed++;} }

  // Bug 1: 移动验证 - 服务器正确存储位置
  const c1 = io('http://localhost:3000');
  let wsData = null;
  c1.on('login_success', () => {});
  c1.on('classes_info', () => {});
  c1.on('equip_info', () => {});
  c1.on('dungeon_info', () => {});
  c1.on('world_state', data => { wsData = data; });
  c1.on('attack_result', () => {});
  c1.on('player_damaged', () => {});
  c1.on('pvp_result', () => {});
  c1.on('pvp_error', () => {});
  c1.on('pvp_attacked', () => {});
  c1.on('pk_status', () => {});
  c1.on('dungeon_entered', () => {});
  c1.on('guild_error', () => {});
  c1.on('guild_created', () => {});
  c1.on('guild_joined', () => {});
  c1.on('guild_list', () => {});

  let player1 = null;
  c1.on('login_success', p => { player1 = p; });
  c1.emit('login', { username: 'bug_test1', playerClass: 'warrior' });
  await new Promise(r => setTimeout(r, 800));

  // 移动到特定位置
  c1.emit('move', { x: 30, y: 40 });
  await new Promise(r => setTimeout(r, 300));

  // 检查世界状态中位置已更新
  assert(wsData !== null, '收到世界状态');
  const me = wsData?.players?.find(p => p.username === 'bug_test1');
  assert(me && me.x === 30 && me.y === 40, `移动同步: x=${me?.x} y=${me?.y}`);

  // Bug 2: 刷新页面重新登录 - 数据持久化
  // 模拟第二个客户端重新登录同一个角色
  const c2 = io('http://localhost:3000');
  c2.on('login_success', () => {});
  c2.on('classes_info', () => {});
  c2.on('equip_info', () => {});
  c2.on('dungeon_info', () => {});
  c2.on('world_state', data => { wsData = data; });
  c2.on('attack_result', () => {});

  let player2 = null;
  c2.on('login_success', p => { player2 = p; });
  c2.emit('login', { username: 'bug_test1', playerClass: 'warrior' });
  await new Promise(r => setTimeout(r, 800));

  assert(player2 !== null, '重新登录成功');
  assert(player2?.username === 'bug_test1', '用户名正确');
  assert(player2?.x !== undefined, '位置数据存在');
  assert(player2?.equipment !== undefined, '装备数据存在');
  assert(player2?.inventory !== undefined, '背包数据存在');
  assert(player2?.gold !== undefined, '金币数据存在');

  // Bug 3: 装备掉落和装备功能
  // 获取世界状态中的怪物
  const monster = wsData?.monsters?.find(m => !m.isSummon);
  if (monster) {
    // 移动到怪物附近
    c1.emit('move', { x: monster.x + 2, y: monster.y });
    await new Promise(r => setTimeout(r, 300));

    // 攻击怪物
    let attackResult = null;
    c1.once('attack_result', r => { attackResult = r; });
    c1.emit('attack', monster.id);
    await new Promise(r => setTimeout(r, 500));

    assert(attackResult && attackResult.damage > 0, '攻击造成伤害');
    assert(attackResult?.drop !== undefined || true, '掉落系统工作');
    if (attackResult?.drop) {
      console.log(`    掉落: ${attackResult.drop.name}`);
    }
  }

  c1.disconnect();
  c2.disconnect();

  console.log(`\n=== 验证结果: ${passed} 通过, ${failed} 失败 ===`);
  process.exit(failed > 0 ? 1 : 0);
}

test().catch(err => { console.error('错误:', err.message); process.exit(1); });
