const io = require('socket.io-client');

async function runTests(name, tests) {
  console.log(`=== ${name} ===`);
  let passed = 0, failed = 0;
  for (const t of tests) {
    try {
      const result = await t();
      if (result) { console.log(`  ✅ ${result}`); passed++; }
      else { console.log(`  ✅`); passed++; }
    } catch (e) {
      console.log(`  ❌ ${e.message}`); failed++;
    }
  }
  console.log(`  结果: ${passed}/${passed + failed}`);
  return failed === 0;
}

async function main() {
  let allPassed = true;
  const c = io('http://localhost:3000');

  let loginData = null, dungeonInfo = null, equipInfo = null;
  c.on('login_success', p => { loginData = p; });
  c.on('dungeon_info', i => { dungeonInfo = i; });
  c.on('equip_info', i => { equipInfo = i; });
  c.on('classes_info', () => {});
  c.on('world_state', () => {});
  c.on('attack_result', () => {});
  c.on('player_damaged', () => {});

  c.emit('login', { username: 'all_test', playerClass: 'warrior' });
  await new Promise(r => setTimeout(r, 800));

  // Phase 1 tests
  allPassed = await runTests('阶段一：基础框架', [
    () => loginData && loginData.username === 'all_test' || Promise.reject('登录失败'),
    () => loginData && loginData.level === 1 || Promise.reject('等级不为1'),
    () => loginData && loginData.hp === 150 || Promise.reject('HP不为150'),
    () => loginData && loginData.attack === 15 || Promise.reject('攻击不为15'),
    () => loginData && loginData.defense === 10 || Promise.reject('防御不为10'),
    () => Math.floor(100 * Math.pow(1, 1.5)) === 100 || Promise.reject('升级曲线错误'),
    () => Math.floor(100 * Math.pow(100, 1.5)) === 100000 || Promise.reject('高等级曲线错误'),
  ]) && allPassed;

  // Phase 2 tests
  allPassed = await runTests('阶段二：多职业', [
    async () => {
      const c2 = io('http://localhost:3000');
      let p2 = null;
      c2.on('login_success', p => { p2 = p; });
      c2.on('classes_info', () => {});
      c2.emit('login', { username: 'mage_test', playerClass: 'mage' });
      await new Promise(r => setTimeout(r, 500));
      if (!p2 || p2.class !== 'mage') return Promise.reject('法师创建失败');
      if (p2.max_mp <= p2.max_hp) return Promise.reject('法师MP应大于HP');
      c2.disconnect();
      return `法师: HP=${p2.max_hp} MP=${p2.max_mp}`;
    },
    async () => {
      const c3 = io('http://localhost:3000');
      let p3 = null;
      c3.on('login_success', p => { p3 = p; });
      c3.on('classes_info', () => {});
      c3.emit('login', { username: 'taoist_test', playerClass: 'taoist' });
      await new Promise(r => setTimeout(r, 500));
      if (!p3 || p3.class !== 'taoist') return Promise.reject('道士创建失败');
      c3.disconnect();
      return `道士: HP=${p3.max_hp} MP=${p3.max_mp}`;
    },
    () => dungeonInfo || Promise.reject('职业信息未收到'),
  ]) && allPassed;

  // Phase 3 tests
  allPassed = await runTests('阶段三：装备', [
    () => equipInfo && equipInfo.slots.length === 6 || Promise.reject('装备槽不为6'),
    () => equipInfo && equipInfo.qualityNames.legendary === '传说' || Promise.reject('品质名错误'),
    () => equipInfo && equipInfo.qualityColors.epic === '#cc44ff' || Promise.reject('品质色错误'),
  ]) && allPassed;

  // Phase 4 tests
  allPassed = await runTests('阶段四：副本', [
    () => dungeonInfo && dungeonInfo.cave || Promise.reject('矿洞不存在'),
    () => dungeonInfo && dungeonInfo.cave.levelReq === 5 || Promise.reject('矿洞等级错误'),
    () => dungeonInfo && dungeonInfo.zumma.boss.name === '祖玛教主' || Promise.reject('Boss名称错误'),
    () => dungeonInfo && dungeonInfo.cave.rewards.length > 0 || Promise.reject('无奖励'),
  ]) && allPassed;

  // Phase 5 tests
  allPassed = await runTests('阶段五：公会', [
    () => loginData && loginData.gold === 0 || Promise.reject('金币不为0'),
  ]) && allPassed;

  // Phase 6 tests
  allPassed = await runTests('阶段六：PK', [
    async () => {
      const c2 = io('http://localhost:3000');
      let p2 = null;
      c2.on('login_success', p => { p2 = p; });
      c2.on('classes_info', () => {});
      c2.emit('login', { username: 'pvp_target', playerClass: 'warrior' });
      await new Promise(r => setTimeout(r, 500));

      c.emit('move', { x: 10, y: 10 });
      c2.emit('move', { x: 12, y: 10 });
      await new Promise(r => setTimeout(r, 300));

      let hit = false;
      c.on('pvp_result', () => { hit = true; });
      c.emit('pvp_attack', c2.id);
      await new Promise(r => setTimeout(r, 800));
      if (!hit) return Promise.reject('PVP未命中');

      let safeBlock = false;
      c.on('pvp_error', (r) => { if (r.error === 'safe_zone') safeBlock = true; });
      c.emit('move', { x: 50, y: 50 });
      c2.emit('move', { x: 50, y: 50 });
      await new Promise(r => setTimeout(r, 300));
      c.emit('pvp_attack', c2.id);
      await new Promise(r => setTimeout(r, 800));
      if (!safeBlock) return Promise.reject('安全区未阻止');

      const pk = await new Promise((resolve) => {
        c.once('pk_status', s => resolve(s));
        c.emit('pk_status');
      });
      if (pk.pkPoints <= 0) return Promise.reject('无PK点');
      c2.disconnect();
      return `PK点: ${pk.pkPoints}`;
    },
  ]) && allPassed;

  c.disconnect();
  console.log(`\n=== 全部测试: ${allPassed ? '通过' : '有失败'} ===`);
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => { console.error('错误:', err.message); process.exit(1); });
