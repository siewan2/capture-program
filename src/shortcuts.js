const modes = ['region', 'window', 'fixed', 'gallery'];
function applyShortcuts(api, shortcuts, trigger) {
  api.unregisterAll();
  const result = {};
  for (const mode of modes) {
    const key = shortcuts?.[mode];
    if (key === '') { result[mode] = '사용 안 함'; continue; }
    if (typeof key !== 'string' || key.length > 80) { result[mode] = '잘못된 단축키'; continue; }
    try { result[mode] = api.register(key, () => trigger(mode)) ? '등록됨' : '등록 실패 · 다른 앱 또는 다른 기능과 중복될 수 있습니다.'; }
    catch { result[mode] = '잘못된 단축키 형식'; }
  }
  return result;
}
module.exports = {applyShortcuts};
