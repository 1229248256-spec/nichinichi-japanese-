// Installation is optional; learning and backups remain available in the browser.
(() => {
  let installPrompt = null;
  let checkSequence = 0;
  const isFile = () => location.protocol === 'file:';
  const standalone = () => navigator.standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;
  const previousSettings = settings;
  settings = function () {
    previousSettings();
    $('#modal-content').innerHTML += `<section class="mobile-help-entry section-gap"><h3>带到手机上学习</h3><p class="subtext">桌面图标、离线准备与学习记录迁移。</p><button class="button secondary" data-action="mobile-help">手机使用指南</button></section>`;
  };

  function showMobileHelp() {
    modal('在手机上继续学习', `<div class="mobile-guide">
      <div class="notice">${isFile() ? '当前打开的是电脑本地文件。手机无法打开这条电脑地址；请在网站发布后使用 HTTPS 网址。' : '请用手机的系统浏览器打开本站。若网页要求登录，请使用拥有本站访问权限的账号。'}</div>
      <section><h3>1 · 放到手机桌面</h3>${standalone() ? '<p class="subtext">当前已在独立窗口中打开。</p>' : '<p class="subtext">安卓 Chrome：菜单 → 添加到主屏幕，或“安装并创建快捷方式”。<br>iPhone Safari：分享 → 添加到主屏幕；如有“作为网页 App 打开”，可以开启。</p>'}
      <button class="button" data-action="mobile-install" id="mobile-install-button" ${!installPrompt || isFile() || standalone() ? 'hidden' : ''}>添加日日到桌面</button>
      <p class="panel-note">按钮是否出现取决于浏览器支持。也可以一直在浏览器里学习。</p></section>
      <section><h3>2 · 把原来的进度带过来</h3><ol><li>在原来的电脑网页中，打开设置，导出学习备份。</li><li>把下载的 JSON 文件传到手机并保存。</li><li>从手机桌面的日日图标打开网站，在设置里导入该文件；核对内容后确认替换。</li></ol><p class="subtext">手机与电脑不会自动同步。导入会替换当前记录，不合并两台设备的进度。自行导入的个人录音需另外保存和重新导入。</p><div class="button-row"><button class="button secondary" data-action="export">导出当前学习备份</button><button class="button ghost" data-action="settings">回到设置导入</button></div></section>
      <section><h3>3 · 出门前准备离线内容</h3><p class="subtext" id="mobile-offline-status" role="status">正在检查这台设备的离线资源…</p><button class="button ghost" data-action="mobile-check-offline">重新检查</button><p class="panel-note">缓存完成后，可断网试开一次。内置词库、微课和 220 条真人词音随网站缓存；外部教材与音频需要网络，合成语音的离线可用性取决于设备。清理浏览器数据可能同时清掉学习记录，请保留备份。</p></section>
      <p class="panel-note">操作参考：<a href="https://support.google.com/chrome/answer/15085120?co=GENIE.Platform%3DAndroid&amp;hl=zh-Hans" target="_blank" rel="noopener noreferrer">Chrome 官方说明</a> · <a href="https://support.apple.com/zh-cn/guide/iphone/iphea86e5236/ios" target="_blank" rel="noopener noreferrer">Apple 官方说明</a></p>
    </div>`);
    checkOffline();
  }

  async function checkOffline() {
    const sequence = ++checkSequence;
    const target = $('#mobile-offline-status');
    if (!target) return;
    let message = '尚未检测到完整的离线内容。联网打开本站后稍等片刻，再点“重新检查”。';
    if (isFile()) message = '当前是本地文件版，无法启用网站的离线缓存；发布后通过 HTTPS 网址使用。';
    else if (!('caches' in window) || !('serviceWorker' in navigator)) message = '当前浏览器未提供离线缓存支持，请保持联网使用。';
    else {
      try {
        // Only inspect an existing cache: opening a nonexistent cache would create it.
        const cacheName = 'nichinichi-v10';
        if ((await window.caches.keys()).includes(cacheName)) {
          const cache = await window.caches.open(cacheName);
          const essential = ['index.html','style.css','content.js','audio-data.js','pronunciation.js','materials.js','vocabulary.js','lesson-data.js','app.js','academy.js','mobile.js'];
          const ready = (await Promise.all(essential.map(path => cache.match(new URL('./'+path, location.href).href)))).every(Boolean);
          if (ready && navigator.serviceWorker.controller) message = '本机学习资源已缓存。建议断网试开一次，确认手机能继续学习和播放内置词音。';
          else if (ready) message = '资源已下载；请保持联网刷新一次，让离线功能接管当前页面，然后再检查。';
        }
      } catch { message = '无法读取离线缓存。请保持联网使用，换用系统浏览器后重试。'; }
    }
    // A delayed result must not overwrite another dialog or a newer check.
    if (sequence === checkSequence && $('#mobile-offline-status') === target) target.textContent = message;
  }

  window.addEventListener('beforeinstallprompt', event => {
    if (isFile() || standalone()) return;
    event.preventDefault();
    installPrompt = event;
    const button = $('#mobile-install-button');
    if (button) button.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    const button = $('#mobile-install-button');
    if (button) button.hidden = true;
    toast('桌面入口已添加。请从桌面打开，再确认学习记录。');
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'mobile-help') showMobileHelp();
    if (button.dataset.action === 'mobile-check-offline') checkOffline();
    if (button.dataset.action !== 'mobile-install' || !installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    button.hidden = true;
    try { await prompt.prompt(); } catch { toast('请使用浏览器菜单中的“添加到主屏幕”。'); }
  });
})();
