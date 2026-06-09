import { chromium } from 'playwright';

(async () => {
  console.log('启动浏览器...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // 1. 访问游戏页面
  console.log('访问 http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  // 2. 登录
  console.log('步骤1: 登录游戏...');
  
  // 输入角色名
  const nameInput = page.locator('#player-name-input, .login-box input[type="text"], .login-box input').first();
  await nameInput.fill('TestUser');
  
  // 选择战士（已默认选中）
  // 点击开始游戏
  const startBtn = page.locator('.login-box button');
  await startBtn.click();
  
  // 等待游戏加载
  await page.waitForTimeout(3000);
  
  // 3. 检查游戏界面
  const gameScreen = page.locator('#game-screen');
  const gameVisible = await gameScreen.isVisible();
  console.log(`  游戏界面加载: ${gameVisible ? '✅' : '❌'}`);
  
  if (!gameVisible) {
    await page.screenshot({ path: '/tmp/test_login.png', fullPage: true });
    console.log('登录截图: /tmp/test_login.png');
    await browser.close();
    process.exit(1);
  }
  
  // 4. 检查回收按钮
  console.log('\n步骤2: 查找回收按钮...');
  const recycleBtn = page.locator('#recycle-btn');
  const btnVisible = await recycleBtn.isVisible();
  console.log(`  回收按钮可见: ${btnVisible ? '✅' : '❌'}`);
  
  if (!btnVisible) {
    await page.screenshot({ path: '/tmp/test_nobtn.png', fullPage: true });
    console.log('截图: /tmp/test_nobtn.png');
    await browser.close();
    process.exit(1);
  }
  
  // 5. 点击回收按钮
  console.log('\n步骤3: 点击回收按钮...');
  await recycleBtn.click();
  await page.waitForTimeout(500);
  
  const panel = page.locator('#recycle-panel');
  const panelVisible = await panel.isVisible();
  console.log(`  回收面板弹出: ${panelVisible ? '✅' : '❌'}`);
  
  if (!panelVisible) {
    await page.screenshot({ path: '/tmp/test_nopanel.png', fullPage: true });
    await browser.close();
    process.exit(1);
  }
  
  // 6. 检查面板元素
  console.log('\n步骤4: 检查面板元素...');
  const checks = [
    ['#recycle-equip-filters', '装备筛选区域'],
    ['#recycle-material-filters', '材料筛选区域'],
    ['#recycle-level-filter', '等级下拉框'],
    ['#recycle-items', '物品列表'],
    ['#recycle-confirm', '确认按钮'],
    ['#recycle-close', '关闭按钮'],
  ];
  
  for (const [selector, name] of checks) {
    const el = page.locator(selector);
    const visible = await el.isVisible();
    console.log(`  ${visible ? '✅' : '❌'} ${name}`);
  }
  
  // 7. 类型切换
  console.log('\n步骤5: 类型切换...');
  const matBtn = page.locator('.recycle-type-btn[data-type="material"]');
  await matBtn.click();
  await page.waitForTimeout(300);
  
  const equipHidden = !(await page.locator('#recycle-equip-filters').isVisible());
  const matVisible = await page.locator('#recycle-material-filters').isVisible();
  console.log(`  切换到材料模式 - 装备筛选隐藏: ${equipHidden ? '✅' : ''}, 材料筛选显示: ${matVisible ? '✅' : '❌'}`);
  
  const equipBtn = page.locator('.recycle-type-btn[data-type="equip"]');
  await equipBtn.click();
  await page.waitForTimeout(300);
  
  // 8. 品质筛选
  console.log('\n步骤6: 品质筛选...');
  const checks2 = page.locator('#recycle-equip-filters input[type="checkbox"]');
  const qCount = await checks2.count();
  console.log(`  品质复选框数量: ${qCount}`);
  
  const defaults = await checks2.evaluateAll(els => 
    els.map(el => ({ quality: el.dataset.quality, checked: el.checked }))
  );
  const defaultChecked = defaults.filter(d => d.checked).map(d => d.quality);
  console.log(`  默认选中: ${defaultChecked.join(', ')}`);
  
  // 9. 等级筛选
  console.log('\n步骤7: 等级筛选选项...');
  const levelOptions = await page.locator('#recycle-level-filter option').allTextContents();
  console.log(`  选项: ${levelOptions.join(', ')}`);
  
  // 10. 关闭面板
  console.log('\n步骤8: 关闭面板...');
  await page.locator('#recycle-close').click();
  await page.waitForTimeout(300);
  const panelClosed = !(await panel.isVisible());
  console.log(`  面板关闭: ${panelClosed ? '✅' : '❌'}`);
  
  await page.screenshot({ path: '/tmp/test_final.png', fullPage: true });
  console.log('\n最终截图: /tmp/test_final.png');
  
  await browser.close();
  console.log('\n=== 测试完成 ===');
})().catch(err => {
  console.error('测试异常:', err.message);
  console.error(err.stack);
  process.exit(1);
});
