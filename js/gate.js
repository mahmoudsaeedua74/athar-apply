const KEY = "athar-apply-form";
const FORMS = new Set(["brand-identity", "seo", "store-launch", "ui-improvement", "ads-management", "ugc"]);

function savedForm() {
  try {
    const saved = sessionStorage.getItem(KEY);
    return saved && FORMS.has(saved) ? saved : "";
  } catch {
    return "";
  }
}

export function rememberForm(slug) {
  if (!FORMS.has(slug)) return false;
  const saved = savedForm();
  if (saved && saved !== slug) {
    location.replace(`/${saved}`);
    return false;
  }
  try { sessionStorage.setItem(KEY, slug); } catch { /* the direct link still opens */ }
  return true;
}

export function returnToForm() {
  const saved = savedForm();
  if (!saved) return false;
  location.replace(`/${saved}`);
  return true;
}
