const NON_DISPLAY = /[a-zA-Z가-힯东动预约摊图]/;
const CHINESE_ONLY = new Set(['漫展', '同人展']);

export function isDisplayTag(tag: string): boolean {
  if (NON_DISPLAY.test(tag)) return false;
  if (CHINESE_ONLY.has(tag)) return false;
  return true;
}
