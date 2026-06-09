const { chromium } = require('playwright');

(async () => {
  console.log('=== 副本怪物过滤测试 ===\n');
  let passed = 0, failed = 0;

  function assert(condition, msg) {
    if (condition) { console.log(`  ✅ ${msg}`); passed++; }
    else { console.log(`  ❌ ${msg}`); failed++; }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));

  // 登录（使用 will 账号，等级已经很高）
  console.log('--- 登录游戏 ---');
  await page.goto('http://localhost:3000', { timeout: 10000 });
  await page.fill('#username', 'will');
  await page.click('#login-btn');
  await page.waitForSelector('#game-screen', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(1000);

  // 确认等级
  const level = await page.evaluate(() => window.state?.player?.level);
  console.log(`  当前等级: ${level}`);
  assert(level >= 5, `等级 >= 5（满足矿洞要求）`);

  // 设置 dungeon_exited 捕获
  await page.evaluate(() => {
    window.socket.on('dungeon_exited', (r) => {
      window.__exitResult = r;
    });
  });

  // 记录原地图怪物
  console.log('\n--- 原地图怪物 ---');
  const worldMonsters = await page.evaluate(() => {
    return window.state?.monsters?.map(m => ({ id: m.id, name: m.name, mapId: m.mapId })) || [];
  });
  console.log(`  原地图怪物数量: ${worldMonsters.length}`);
  const chickenCount = worldMonsters.filter(m => m.name === '鸡').length;
  console.log(`  鸡的数量: ${chickenCount}`);

  // 打开副本面板并点击矿洞副本
  console.log('\n--- 进入矿洞副本 ---');
  await page.click('#dungeon-btn');
  await page.waitForTimeout(500);

  const dungeonEntry = page.locator('.dungeon-entry', { hasText: '矿洞' });
  const isLocked = await dungeonEntry.evaluate(el => el.classList.contains('locked'));
  if (isLocked) {
    console.log('  ❌ 副本仍然锁定');
    assert(false, '副本入口可点击');
  } else {
    console.log('  副本入口可点击');
    await dungeonEntry.click();
  }
  await page.waitForTimeout(1000);

  // 检查副本中的怪物
  console.log('\n--- 副本内怪物 ---');
  const currentMap = await page.evaluate(() => window.state?.currentMap);
  console.log(`  当前地图: ${currentMap}`);
  assert(currentMap === 'dungeon_cave', `地图ID为 dungeon_cave`);

  const dungeonMonsters = await page.evaluate(() => {
    return window.state?.monsters?.map(m => ({ id: m.id, name: m.name, mapId: m.mapId })) || [];
  });
  console.log(`  副本怪物数量: ${dungeonMonsters.length}`);

  const dungeonChickenCount = dungeonMonsters.filter(m => m.name === '鸡').length;
  console.log(`  鸡的数量: ${dungeonChickenCount}`);
  assert(dungeonChickenCount === 0, '副本中没有鸡（不应该出现比奇城的怪物）');

  if (dungeonMonsters.length > 0) {
    const dungeonMapIds = [...new Set(dungeonMonsters.map(m => m.mapId))];
    console.log(`  怪物地图分布: ${dungeonMapIds.join(', ')}`);
    const allCorrect = dungeonMapIds.every(id => id === 'dungeon_cave');
    assert(allCorrect, '所有怪物的 mapId 都是 dungeon_cave');

    const dungeonNames = [...new Set(dungeonMonsters.map(m => m.name))];
    console.log(`  怪物种类: ${dungeonNames.join(', ')}`);
    const hasBoss = dungeonNames.some(n => n.includes('僵尸王'));
    assert(hasBoss, '副本中有BOSS矿洞僵尸王');
  }

  await page.waitForTimeout(500);
  const afterSyncMonsters = await page.evaluate(() => {
    return window.state?.monsters?.map(m => ({ name: m.name, mapId: m.mapId })) || [];
  });
  const afterSyncChickenCount = afterSyncMonsters.filter(m => m.name === '鸡').length;
  assert(afterSyncChickenCount === 0, 'world_state 同步后仍然没有鸡');

  // 退出副本
  console.log('\n--- 退出副本 ---');

  await page.evaluate(() => {
    window.socket.emit('exit_dungeon');
  });
  await page.waitForTimeout(2000);

  const exitResult = await page.evaluate(() => window.__exitResult);

  const exitMap = await page.evaluate(() => window.state?.currentMap);
  console.log(`  退出后地图: ${exitMap}`);
  assert(exitMap === 'bichon', '退出后回到比奇城');

  await page.waitForTimeout(500);
  const afterExitMonsters = await page.evaluate(() => {
    return window.state?.monsters?.map(m => ({ name: m.name, mapId: m.mapId })) || [];
  });
  console.log(`  返回后怪物数量: ${afterExitMonsters.length}`);
  const afterExitChickenCount = afterExitMonsters.filter(m => m.name === '鸡').length;
  console.log(`  鸡的数量: ${afterExitChickenCount}`);
  assert(afterExitChickenCount > 0, '返回原地图后重新显示鸡');

  const dungeonMonsterCount = afterExitMonsters.filter(m => m.mapId && m.mapId.startsWith('dungeon_')).length;
  assert(dungeonMonsterCount === 0, '原地图中不应该有副本怪物');

  // 清理
  await browser.close();

  console.log(`\n=== 测试结果：${passed} 通过，${failed} 失败 ===`);
  process.exit(failed > 0 ? 1 : 0);
})();
