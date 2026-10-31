import { API_BASE } from "./config.js";
import { CLOSING_LINE, OPENING_LINE, brandMark } from "./brand.js";

const root = document.querySelector("#app");
const slug = document.body.dataset.form;
let form;

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجا`;
}

function fillRich(node, value) {
  const parts = String(value).split("**");
  if (parts.length === 1) {
    node.append(document.createTextNode(value));
    return;
  }
  parts.forEach((part, index) => {
    if (!part) return;
    if (index % 2 === 1) {
      const strong = document.createElement("strong");
      strong.textContent = part;
      node.append(strong);
    } else node.append(document.createTextNode(part));
  });
}

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

const FILE_AND_LINK = Object.freeze({ conflict: true });
const uploadedCache = new WeakMap();

function fileLimitMessage(field) {
  const mb = Math.round((field.maxBytes ?? 10 * 1024 * 1024) / (1024 * 1024));
  return `الحد الأقصى للملف ${mb} ميجا`;
}

function isFileList(value) {
  return Array.isArray(value) && value.some((item) => item instanceof File);
}

function readValues(formNode) {
  const values = {};
  for (const field of form.sections.flatMap((section) => section.fields)) {
    const box = formNode.querySelector(`[data-field="${field.name}"]`);
    if (!box || box.hidden) continue;
    if (field.kind === "file_or_url") {
      const file = box.querySelector('input[type="file"]')?.files?.[0] ?? null;
      const link = box.querySelector('input[type="url"]')?.value.trim() ?? "";
      if (file && link) values[field.name] = FILE_AND_LINK;
      else if (file) values[field.name] = file;
      else if (link) values[field.name] = link;
    } else if (field.kind === "files") {
      const files = box._pickedFiles ?? [];
      if (files.length) values[field.name] = files;
    } else if (field.kind === "multi") {
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
    if (field.kind === "file_or_url") {
      const max = field.maxBytes ?? 10 * 1024 * 1024;
      if (value === FILE_AND_LINK) message = "اكتفِ بالملف أو برابط Drive";
      else if (value instanceof File) {
        if (value.size <= 0) message = "الملف فارغ";
        else if (value.size > max) message = fileLimitMessage(field);
      } else if (typeof value === "string" && !/^https?:\/\/\S+$/i.test(value)) message = "الرابط لازم يبدأ بـ http:// أو https://";
      else if (field.required && (value == null || value === "")) message = "ارفع ملف أو الصق رابط Drive";
    } else if (field.kind === "files") {
      const max = field.maxBytes ?? 10 * 1024 * 1024;
      const maxFiles = field.maxFiles ?? 1;
      const files = Array.isArray(value) ? value : [];
      if (files.length > maxFiles) message = "عدد الملفات أكبر من المسموح";
      else if (files.some((file) => !(file instanceof File) || file.size <= 0)) message = "الملف فارغ";
      else if (files.some((file) => file.size > max)) message = fileLimitMessage(field);
      else if (field.required && files.length === 0) message = "ارفع ملف";
    } else if (field.required && (value == null || value === "" || (Array.isArray(value) && value.length === 0))) message = "هذا الحقل مطلوب";
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
    if (value === FILE_AND_LINK) return false;
    if (value instanceof File) return value.size > 0 && value.size <= (field.maxBytes ?? 10 * 1024 * 1024);
    if (isFileList(value)) {
      const max = field.maxBytes ?? 10 * 1024 * 1024;
      const maxFiles = field.maxFiles ?? 1;
      return value.length > 0 && value.length <= maxFiles && value.every((file) => file instanceof File && file.size > 0 && file.size <= max);
    }
    return value != null && value !== "" && (!Array.isArray(value) || value.length > 0);
  }).length;
  return Math.round((done / fields.length) * 100);
}

function control(field) {
  const box = el("div", "question");
  box.dataset.field = field.name;
  const label = el("div");
  label.id = `label-${field.name}`;
  fillRich(label, field.label);
  if (field.required) label.append(el("span", "req", " *"));
  box.append(label);
  if (field.hint) box.append(el("p", "hint", field.hint));

  if (field.kind === "files") {
    const file = document.createElement("input");
    file.type = "file";
    if ((field.maxFiles ?? 1) > 1) file.multiple = true;
    file.setAttribute("aria-labelledby", label.id);
    const list = el("div", "file-list");
    box._pickedFiles = [];
    const paint = () => {
      list.replaceChildren();
      const max = field.maxBytes ?? 10 * 1024 * 1024;
      for (const picked of box._pickedFiles) {
        const row = el("div", "file-row");
        const text = picked.size > max
          ? `${picked.name} — ${fileLimitMessage(field)}`
          : `${picked.name} — ${formatSize(picked.size)}`;
        const remove = el("button", "file-remove", "حذف");
        remove.type = "button";
        remove.addEventListener("click", () => {
          box._pickedFiles = box._pickedFiles.filter((item) => item !== picked);
          uploadedCache.delete(picked);
          paint();
        });
        row.append(el("span", "", text), remove);
        list.append(row);
      }
      refresh();
    };
    file.addEventListener("change", () => {
      const maxFiles = field.maxFiles ?? 1;
      const next = [...box._pickedFiles];
      let overflow = false;
      for (const item of file.files ?? []) {
        if (next.length >= maxFiles) {
          overflow = true;
          break;
        }
        const same = next.some((existing) => existing.name === item.name && existing.size === item.size && existing.lastModified === item.lastModified);
        if (!same) next.push(item);
      }
      box._pickedFiles = next;
      file.value = "";
      paint();
      fieldError(box, overflow ? "عدد الملفات أكبر من المسموح" : "");
    });
    box.append(file, list);
    return box;
  }

  if (field.kind === "file_or_url") {
    const file = document.createElement("input");
    file.type = "file";
    file.setAttribute("aria-labelledby", label.id);
    const meta = el("p", "file-meta", "");
    const divider = el("p", "or", "أو");
    const linkHint = el("p", "hint", "رابط Drive");
    const link = document.createElement("input");
    link.type = "url";
    link.dir = "ltr";
    link.maxLength = field.maxLength ?? 500;
    link.placeholder = "https://drive.google.com/...";
    link.setAttribute("aria-label", "رابط Drive");
    const paint = () => {
      const picked = file.files?.[0];
      const max = field.maxBytes ?? 10 * 1024 * 1024;
      if (!picked) meta.textContent = "";
      else if (picked.size > max) meta.textContent = fileLimitMessage(field);
      else meta.textContent = `${picked.name} — ${formatSize(picked.size)}`;
      refresh();
    };
    file.addEventListener("change", () => {
      delete file.dataset.uploadedStamp;
      delete file.dataset.uploadedPath;
      delete file.dataset.uploadedName;
      paint();
    });
    link.addEventListener("input", refresh);
    box.append(file, meta, divider, linkHint, link);
    return box;
  }

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
    if (field.compact && input instanceof HTMLTextAreaElement) {
      input.rows = 1;
      input.className = "compact";
      const grow = () => {
        input.style.height = "auto";
        input.style.height = `${input.scrollHeight}px`;
      };
      input.addEventListener("input", () => {
        grow();
        refresh();
      });
      queueMicrotask(grow);
    } else input.addEventListener("input", refresh);
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
  sheet.append(el("h1", "form-title", form.titleAr));
  for (const paragraph of form.intro.split(/\n\s*\n/)) {
    const text = paragraph.trim();
    if (!text) continue;
    const node = el("p", "intro");
    fillRich(node, text);
    sheet.append(node);
  }
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
  formNode.append(sheet, brandMark(form.closing || CLOSING_LINE, "close"), actions);
  formNode.addEventListener("submit", (event) => send(event, submit));
  wrap.append(brandMark(form.opening || OPENING_LINE), formNode);
  root.append(wrap);
  refresh();
}

function sheetWait(parent, node) { parent.append(node); }

async function uploadApplicationFile(field, file) {
  const cached = uploadedCache.get(file);
  if (cached) return cached;
  const input = formNode.querySelector(`[data-field="${field.name}"] input[type="file"]`);
  const stamp = `${file.name}:${file.size}:${file.lastModified}`;
  if (field.kind === "file_or_url" && input?.dataset.uploadedStamp === stamp && input.dataset.uploadedPath && input.dataset.uploadedName) {
    return { path: input.dataset.uploadedPath, name: input.dataset.uploadedName };
  }
  const body = new FormData();
  body.append("file", file);
  body.append("field", field.name);
  const response = await fetch(`${API_BASE}/api/public/applications/${form.type}/file`, {
    method: "POST",
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.path !== "string" || typeof payload.name !== "string") {
    const message = response.status === 413
      ? (typeof payload.error === "string" ? payload.error : fileLimitMessage(field))
      : response.status === 429
        ? "حاول بعد شوية"
        : typeof payload.error === "string" && payload.error.length < 120
          ? payload.error
          : "تعذر رفع الملف. حاول مرة ثانية.";
    const error = new Error(message);
    error.field = field.name;
    throw error;
  }
  const uploaded = { path: payload.path, name: payload.name };
  uploadedCache.set(file, uploaded);
  if (field.kind === "file_or_url" && input) {
    input.dataset.uploadedStamp = stamp;
    input.dataset.uploadedPath = payload.path;
    input.dataset.uploadedName = payload.name;
  }
  return uploaded;
}

async function send(event, submit) {
  event.preventDefault();
  const values = readValues(formNode);
  status.textContent = "";
  if (!validate(formNode, values)) return;
  submit.disabled = true;
  let stage = "send";
  try {
    const answers = {};
    for (const [key, value] of Object.entries(values)) {
      if (value instanceof File || value === FILE_AND_LINK || isFileList(value)) continue;
      answers[key] = value;
    }
    for (const field of form.sections.flatMap((section) => section.fields)) {
      const value = values[field.name];
      const files = field.kind === "files" && Array.isArray(value)
        ? value.filter((item) => item instanceof File)
        : field.kind === "file_or_url" && value instanceof File
          ? [value]
          : [];
      if (!files.length) continue;
      stage = "upload";
      status.textContent = files.length > 1 ? "جاري رفع الملفات…" : "جاري رفع الملف…";
      const uploaded = [];
      for (const file of files) uploaded.push(await uploadApplicationFile(field, file));
      if ((field.maxFiles ?? 1) <= 1) {
        answers[field.name] = uploaded[0].path;
        answers[`${field.name}_name`] = uploaded[0].name;
      } else {
        answers[field.name] = uploaded.map((item) => item.path);
        answers[`${field.name}_name`] = uploaded.map((item) => item.name);
      }
      stage = "send";
    }
    status.textContent = "";
    const response = await fetch(`${API_BASE}/api/public/applications/${form.type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...answers,
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
        const box = formNode.querySelector(`[data-field="${name.replace(/_(other|name)$/, "")}"]`);
        if (!box) continue;
        fieldError(box, String(message));
        if (!first) first = box;
      }
      if (first) {
        const fileInput = first.querySelector('input[type="file"]');
        if (fileInput) {
          delete fileInput.dataset.uploadedStamp;
          delete fileInput.dataset.uploadedPath;
          delete fileInput.dataset.uploadedName;
        }
        for (const file of first._pickedFiles ?? []) uploadedCache.delete(file);
        first.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (!first) status.textContent = typeof body.error === "string" ? body.error : "راجع الحقول وحاول مرة ثانية.";
      return;
    }
    status.textContent = "تعذر الإرسال. حاول مرة ثانية.";
  } catch (error) {
    const fieldName = error instanceof Error ? error.field : "";
    const box = fieldName ? formNode.querySelector(`[data-field="${fieldName}"]`) : null;
    if (box && error instanceof Error) {
      fieldError(box, error.message);
      box.scrollIntoView({ behavior: "smooth", block: "center" });
      status.textContent = "";
    } else {
      status.textContent = stage === "upload" ? "تعذر رفع الملف. حاول مرة ثانية." : "تعذر الإرسال. حاول مرة ثانية.";
    }
  } finally {
    submit.disabled = false;
  }
}

if (root && slug) {
  const loaded = await import(`./forms/${slug}.js`).catch(() => null);
  form = loaded?.form;
  if (form?.slug === slug) render();
}
