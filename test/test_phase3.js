const io = require('socket.io-client');

async function test() {
  console.log('=== 阶段三：装备系统测试 ===\n');
  let passed = 0, failed = 0;

  function assert(condition, msg) {
    if (condition) { console.log(`  ✅ ${msg}`); passed++; }
    else { console.log(`  ❌ ${msg}`); failed++; }
  }

  const c = io('http://localhost:3000');
  let equipInfo = null;
  c.on('equip_info', info => { equipInfo = info; });

  const player = await new Promise((resolve) => {
    c.on('login_success', p => resolve(p));
    c.emit('login', { username: 'eq_test3', playerClass: 'warrior' });
  });

  assert(player.equipment && Object.keys(player.equipment).length === 0, '初始无装备');
  assert(player.inventory && player.inventory.length === 0, '初始背包空');

  await new Promise(r => setTimeout(r, 1000));
  assert(equipInfo !== null, '收到装备信息');
  assert(equipInfo.slots.length === 6, '6个装备槽位');
  assert(equipInfo.slots.includes('weapon'), '武器槽');
  assert(equipInfo.slots.includes('armor'), '衣服槽');
  assert(equipInfo.slots.includes('helmet'), '头盔槽');
  assert(equipInfo.slots.includes('necklace'), '项链槽');
  assert(equipInfo.slots.includes('bracelet'), '手镯槽');
  assert(equipInfo.slots.includes('ring'), '戒指槽');

  assert(equipInfo.qualityNames.common === '普通', '普通品质');
  assert(equipInfo.qualityNames.uncommon === '优秀', '优秀品质');
  assert(equipInfo.qualityNames.rare === '精良', '精良品质');
  assert(equipInfo.qualityNames.epic === '史诗', '史诗品质');
  assert(equipInfo.qualityNames.legendary === '传说', '传说品质');

  assert(equipInfo.qualityColors, '品质颜色映射');
  assert(equipInfo.qualityColors.legendary === '#ff8800', '传说颜色 #ff8800');
  assert(equipInfo.qualityColors.epic === '#cc44ff', '史诗颜色 #cc44ff');

  c.disconnect();
  console.log(`\n=== 阶段三测试结果: ${passed} 通过, ${failed} 失败 ===`);
  process.exit(failed > 0 ? 1 : 0);
}

test().catch(err => { console.error('测试出错:', err.message); process.exit(1); });
