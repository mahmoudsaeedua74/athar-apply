import { API_BASE } from "./config.js";
import { CLOSING_LINE, OPENING_LINE, brandMark } from "./brand.js";
import { rememberForm } from "./gate.js";

const root = document.querySelector("#app");
const slug = document.body.dataset.form;
let form;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function fieldError(node, message) {
  const next = node.querySelector(".error");
  if (next) next.remove();
  const input = node.querySelector("input, textarea, select");
  if (!message) {
    if (input) input.removeAttribute("aria-invalid");
    return;
  }
  if (input) input.setAttribute("aria-invalid", "true");
  node.append(el("p", "error", message));
}

function visible(field, values) {
  if (!field.showWhen) return true;
  return values[field.showWhen.field] === field.showWhen.equals;
}

function readValues(formNode) {
  const values = {};
  for (const field of form.sections.flatMap((section) => section.fields)) {
    const box = formNode.querySelector(`[data-field="${field.name}"]`);
    if (!box || box.hidden) continue;
    if (field.kind === "multi") {
      values[field.name] = [...box.querySelectorAll("input:checked")].map((input) => input.value);
    } else if (field.kind === "select") {
      const picked = box.querySelector("input:checked");
      if (picked) values[field.name] = picked.value;
    } else {
      const input = box.querySelector("input, textarea");
      if (input && input.value.trim()) values[field.name] = input.value.trim();
    }
    if ((values[field.name] === "other" || (Array.isArray(values[field.name]) && values[field.name].includes("other")))) {
      const other = box.querySelector("[data-other]");
      if (other && other.value.trim()) values[`${field.name}_other`] = other.value.trim();
    }
  }
  return values;
}

function validate(formNode, values) {
  let first = null;
  for (const field of form.sections.flatMap((section) => section.fields)) {
    const box = formNode.querySelector(`[data-field="${field.name}"]`);
    if (!box) continue;
    let message = "";
    const value = values[field.name];
    if (!visible(field, values)) {
      fieldError(box, "");
      continue;
    }
    if (field.required && (value == null || value === "" || (Array.isArray(value) && value.length === 0))) message = "هذا الحقل مطلوب";
    else if (typeof value === "string" && field.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = "البريد غير صحيح";
    else if (typeof value === "string" && field.kind === "tel" && !/^\+?[0-9][0-9\s-]{7,20}$/.test(value)) message = "رقم الجوال غير صحيح";
    else if (typeof value === "string" && field.kind === "url" && !/^https?:\/\/\S+$/i.test(value)) message = "الرابط لازم يبدأ بـ http:// أو https://";
    else if ((value === "other" || (Array.isArray(value) && value.includes("other"))) && !values[`${field.name}_other`]) message = "اكتب التفاصيل";
    fieldError(box, message);
    if (message && !first) first = box;
  }
  if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  return !first;
}

function progressValue(values) {
  const fields = form.sections.flatMap((section) => section.fields).filter((field) => field.required && visible(field, values));
  if (!fields.length) return 0;
  const done = fields.filter((field) => {
    const value = values[field.name];
    return value != null && value !== "" && (!Array.isArray(value) || value.length > 0);
  }).length;
  return Math.round((done / fields.length) * 100);
}

function control(field) {
  const box = el("div", "question");
  box.dataset.field = field.name;
  const label = el("div");
  label.id = `label-${field.name}`;
  label.append(document.createTextNode(field.label));
  if (field.required) label.append(el("span", "req", " *"));
  box.append(label);
  if (field.hint) box.append(el("p", "hint", field.hint));

  if (field.kind === "select" || field.kind === "multi") {
    const choices = el("div", "choices");
    for (const option of field.options ?? []) {
      const choice = el("label", "choice");
      const input = document.createElement("input");
      input.type = field.kind === "multi" ? "checkbox" : "radio";
      input.name = field.name;
      input.value = option.value;
      const text = el("span");
      text.textContent = option.label;
      choice.append(input, text);
      choices.append(choice);
    }
    box.append(choices);
    const other = document.createElement("input");
    other.type = "text";
    other.dataset.other = "true";
    other.maxLength = 200;
    other.hidden = true;
    other.setAttribute("aria-label", "تفاصيل أخرى");
    box.append(other);
    choices.addEventListener("change", () => {
      const values = readValues(box.closest("form"));
      const picked = values[field.name] === "other" || (Array.isArray(values[field.name]) && values[field.name].includes("other"));
      other.hidden = !picked;
      refresh();
    });
  } else {
    const input = document.createElement(field.kind === "textarea" ? "textarea" : "input");
    if (input instanceof HTMLInputElement) {
      input.type = field.kind === "tel" ? "tel" : field.kind === "email" ? "email" : field.kind === "url" ? "url" : "text";
    }
    input.maxLength = field.maxLength ?? (field.kind === "textarea" ? 3000 : 200);
    input.required = false;
    input.setAttribute("aria-labelledby", label.id);
    input.addEventListener("input", refresh);
    box.append(input);
  }
  return box;
}

let formNode;
let bar;
let status;

function refresh() {
  if (!formNode || !bar) return;
  for (const field of form.sections.flatMap((section) => section.fields)) {
    const box = formNode.querySelector(`[data-field="${field.name}"]`);
    if (!box) continue;
    const values = readValues(formNode);
    box.hidden = !visible(field, values);
  }
  bar.value = progressValue(readValues(formNode));
}

function render() {
  const wrap = el("main", "wrap stack");
  formNode = document.createElement("form");
  formNode.className = "stack";
  formNode.noValidate = true;
  const sheet = el("div", "sheet");
  sheet.append(el("h1", "form-title", form.titleAr), el("p", "intro", form.intro));
  bar = document.createElement("progress");
  bar.className = "bar";
  bar.max = 100;
  bar.value = 0;
  bar.setAttribute("aria-label", "تقدم التعبئة");
  sheet.append(bar);
  const trap = document.createElement("input");
  trap.type = "text";
  trap.name = "website_url_confirm";
  trap.tabIndex = -1;
  trap.autocomplete = "off";
  trap.className = "hp";
  trap.setAttribute("aria-hidden", "true");
  sheet.append(trap);
  for (const section of form.sections) {
    if (section.title) sheetWait(sheet, el("h2", "section", section.title));
    if (section.intro) sheet.append(el("p", "intro", section.intro));
    if (section.copyValue) {
      const row = el("div", "copy");
      const text = el("span", "", section.copyValue);
      const button = el("button", "", "نسخ");
      button.type = "button";
      button.addEventListener("click", () => navigator.clipboard.writeText(section.copyValue).catch(() => undefined));
      row.append(el("span", "", section.copyLabel || "البريد"), text, button);
      sheet.append(row);
    }
    if (section.notice) sheet.append(el("p", "notice", section.notice));
    for (const field of section.fields) sheet.append(control(field));
  }
  status = el("p", "status");
  status.setAttribute("role", "status");
  const submit = el("button", "submit", "إرسال");
  submit.type = "submit";
  const actions = el("div", "actions");
  actions.append(status, submit);
  formNode.append(sheet, brandMark(CLOSING_LINE, "close"), actions);
  formNode.addEventListener("submit", (event) => send(event, submit));
  wrap.append(brandMark(OPENING_LINE), formNode);
  root.append(wrap);
  refresh();
}

function sheetWait(parent, node) { parent.append(node); }

async function send(event, submit) {
  event.preventDefault();
  const values = readValues(formNode);
  status.textContent = "";
  if (!validate(formNode, values)) return;
  submit.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/api/public/applications/${form.type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        website_url_confirm: formNode.elements.website_url_confirm.value,
      }),
    });
    if (response.status === 201) {
      window.location.href = "/thanks";
      return;
    }
    if (response.status === 429) {
      status.textContent = "حاول بعد شوية";
      return;
    }
    if (response.status === 400) {
      const body = await response.json().catch(() => ({}));
      const fields = body.fields ?? {};
      let first = null;
      for (const [name, message] of Object.entries(fields)) {
        const box = formNode.querySelector(`[data-field="${name.replace(/_other$/, "")}"]`);
        if (!box) continue;
        fieldError(box, String(message));
        if (!first) first = box;
      }
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      if (!first) status.textContent = typeof body.error === "string" ? body.error : "راجع الحقول وحاول مرة ثانية.";
      return;
    }
    status.textContent = "تعذر الإرسال. حاول مرة ثانية.";
  } catch {
    status.textContent = "تعذر الإرسال. حاول مرة ثانية.";
  } finally {
    submit.disabled = false;
  }
}

if (root && slug && rememberForm(slug)) {
  const loaded = await import(`./forms/${slug}.js`).catch(() => null);
  form = loaded?.form;
  if (form?.slug === slug) render();
}
