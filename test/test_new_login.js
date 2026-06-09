const { chromium } = require('playwright');

(async () => {
  console.log('=== 新登录流程测试 ===\n');
  let passed = 0, failed = 0;

  function assert(condition, msg) {
    if (condition) { console.log(`  ✅ ${msg}`); passed++; }
    else { console.log(`  ❌ ${msg}`); failed++; }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));

  try {
    // 测试 1：注册新账号
    console.log('\n--- 测试 1：注册新账号 ---');
    await page.goto('http://localhost:3000', { timeout: 10000 });
    await page.waitForSelector('#login-step-account', { state: 'visible', timeout: 5000 });
    assert(true, '显示账号登录界面');

    await page.fill('#login-username', 'testuser_new');
    await page.fill('#login-password', 'test1234');
    await page.click('#register-btn');

    // 等待注册结果
    await page.waitForTimeout(1000);
    const regError = await page.$eval('#login-error', el => el.textContent);
    assert(regError.includes('注册成功'), `注册结果: ${regError}`);

    // 测试 2：登录并进入角色选择
    console.log('\n--- 测试 2：登录并进入角色选择 ---');
    await page.fill('#login-username', 'testuser_new');
    await page.fill('#login-password', 'test1234');
    await page.click('#login-btn');

    await page.waitForTimeout(1000);
    const charScreenVisible = await page.$('#login-step-character');
    assert(charScreenVisible !== null, '显示角色选择界面');

    const welcome = await page.$eval('#account-welcome', el => el.textContent);
    assert(welcome.includes('testuser_new'), `欢迎信息: ${welcome}`);

    // 检查角色列表为空时显示创建提示
    const charList = await page.$('#character-list');
    const hasNoCharText = await page.$eval('#character-list', el => el.textContent.includes('暂无角色'));
    assert(hasNoCharText, '空角色列表显示创建提示');

    // 测试 3：创建角色
    console.log('\n--- 测试 3：创建角色 ---');
    const createDivVisible = await page.$('#character-create');
    assert(createDivVisible !== null, '显示角色创建表单');

    await page.fill('#char-name', '测试战士');
    // 默认选择战士，点击确认
    await page.click('#create-char-btn');
    await page.waitForTimeout(1000);

    // 角色应出现在列表中
    const hasCharCard = await page.$('.char-card');
    assert(hasCharCard !== null, '角色卡片显示在列表中');

    if (hasCharCard) {
      const charName = await page.$eval('.char-card .char-name', el => el.textContent);
      assert(charName === '测试战士', `角色名称: ${charName}`);
    }

    // 测试 4：创建第二个角色
    console.log('\n--- 测试 4：创建第二个角色（法师） ---');
    await page.click('#character-list button'); // 点击"+ 创建新角色"
    await page.waitForTimeout(500);
    await page.fill('#char-name', '测试法师');
    // 选择法师职业
    await page.click('.class-option[data-class="mage"]');
    await page.click('#create-char-btn');
    await page.waitForTimeout(1000);

    const charCards = await page.$$('.char-card');
    assert(charCards.length === 2, `角色列表有2个角色: ${charCards.length}`);

    // 测试 5：选择角色进入游戏
    console.log('\n--- 测试 5：选择角色进入游戏 ---');
    await page.click('.char-card:first-child');
    await page.waitForTimeout(2000);

    const gameScreen = await page.$('#game-screen');
    assert(gameScreen !== null, '游戏界面已显示');

    const loginScreen = await page.$('#login-screen');
    const loginHidden = await loginScreen.evaluate(el => el.style.display === 'none');
    assert(loginHidden, '登录界面已隐藏');

    // 检查游戏元素
    const playerName = await page.$('#player-name');
    if (playerName) {
      const name = await playerName.textContent();
      assert(name.length > 0, `玩家名称显示: ${name}`);
    }

    // 测试 6：退出后重新登录
    console.log('\n--- 测试 6：重新登录 ---');
    await page.reload({ timeout: 10000 });
    // reload 后可能在角色选择界面，需要先返回登录
    await page.waitForSelector('#login-step-account', { state: 'visible', timeout: 3000 }).catch(() => {});
    const charStepVisible = await page.$('#login-step-character');
    if (charStepVisible && await charStepVisible.evaluate(el => el.style.display !== 'none')) {
      await page.click('#back-to-login-btn');
      await page.waitForTimeout(500);
    }
    await page.waitForSelector('#login-username', { state: 'visible', timeout: 5000 });

    await page.fill('#login-username', 'testuser_new');
    await page.fill('#login-password', 'test1234');
    await page.click('#login-btn');
    await page.waitForTimeout(1000);

    const charCards2 = await page.$$('.char-card');
    assert(charCards2.length === 2, `重新登录后角色列表仍有2个角色: ${charCards2.length}`);

    // 返回登录界面
    await page.click('#back-to-login-btn');
    await page.waitForTimeout(500);
    await page.waitForSelector('#login-username', { state: 'visible', timeout: 5000 });

    // 测试 7：错误密码登录
    console.log('\n--- 测试 7：错误密码 ---');
    await page.fill('#login-username', 'testuser_new');
    await page.fill('#login-password', 'wrongpass');
    await page.click('#login-btn');
    await page.waitForTimeout(500);
    const errText = await page.$eval('#login-error', el => el.textContent);
    assert(errText.includes('密码'), `错误提示: ${errText}`);

    // 测试 8：不存在的用户名
    console.log('\n--- 测试 8：不存在的用户名 ---');
    await page.fill('#login-username', 'nonexistent_user');
    await page.fill('#login-password', 'test1234');
    await page.click('#login-btn');
    await page.waitForTimeout(500);
    const errText2 = await page.$eval('#login-error', el => el.textContent);
    assert(errText2.includes('不存在') || errText2.includes('错误'), `错误提示: ${errText2}`);

    // 总结
    console.log(`\n=== 测试完成: ${passed} 通过, ${failed} 失败 ===`);

  } catch (e) {
    console.log('测试异常:', e.message);
    console.log('Console logs:', logs.slice(-20).join('\n'));
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
