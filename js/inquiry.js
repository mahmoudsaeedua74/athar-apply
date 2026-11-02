import { API_BASE } from "./config.js";

const form = document.querySelector("#inquiry-form");
const summary = document.querySelector("#inquiry-summary");
const status = document.querySelector("#inquiry-status");

const fields = [
  { name: "name", label: "الاسم", required: true },
  { name: "email", label: "البريد الإلكتروني", kind: "email" },
  { name: "phone", label: "رقم الجوال", required: true, kind: "tel" },
  { name: "website", label: "الموقع الإلكتروني", kind: "url" },
  { name: "message", label: "اترك رسالتك" },
];

function valueOf(name) {
  const input = form.elements[name];
  return input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement ? input.value.trim() : "";
}

function messageFor(field, value) {
  if (field.required && !value) return "هذا الحقل مطلوب";
  if (!value) return "";
  if (field.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "البريد غير صحيح";
  if (field.kind === "tel") {
    const digits = value.replace(/\D/g, "");
    if (!/^\+?[0-9][0-9\s-]{7,20}$/.test(value) || digits.length < 8 || digits.length > 15) return "رقم الجوال غير صحيح";
  }
  if (field.kind === "url" && !/^https?:\/\/\S+$/i.test(value)) return "الرابط لازم يبدأ بـ http:// أو https://";
  return "";
}

function setFieldError(name, message) {
  const input = form.elements[name];
  const slot = form.querySelector(`[data-error="${name}"]`);
  if (!(input instanceof HTMLElement) || !slot) return;
  slot.textContent = message;
  if (message) {
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", slot.id);
  } else {
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
  }
}

function showSummary(problems) {
  summary.replaceChildren();
  if (!problems.length) {
    summary.hidden = true;
    return;
  }
  const title = document.createElement("h3");
  title.id = "inquiry-summary-title";
  title.textContent = "راجع البيانات دي";
  const list = document.createElement("ul");
  for (const problem of problems) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${problem.name}`;
    link.textContent = `${problem.label}: ${problem.message}`;
    item.append(link);
    list.append(item);
  }
  summary.append(title, list);
  summary.hidden = false;
  summary.focus();
}

function collect() {
  const problems = [];
  const answers = {};
  for (const field of fields) {
    const value = valueOf(field.name);
    const message = messageFor(field, value);
    setFieldError(field.name, message);
    if (message) problems.push({ name: field.name, label: field.label, message });
    else if (value) answers[field.name] = value;
  }
  return { problems, answers };
}

function applyServerFields(serverFields) {
  const problems = [];
  for (const field of fields) {
    const message = typeof serverFields[field.name] === "string" ? serverFields[field.name] : "";
    setFieldError(field.name, message);
    if (message) problems.push({ name: field.name, label: field.label, message });
  }
  const known = new Set(fields.map((field) => field.name));
  const rest = Object.entries(serverFields).filter(([name]) => !known.has(name) && name !== "_form");
  if (problems.length) showSummary(problems);
  else summary.hidden = true;
  if (!problems.length) {
    status.textContent = typeof serverFields._form === "string"
      ? serverFields._form
      : rest.length
        ? String(rest[0][1])
        : "راجع الحقول وحاول مرة ثانية.";
  }
}

async function send(event) {
  event.preventDefault();
  status.textContent = "";
  const submit = form.querySelector("button[type=submit]");
  const { problems, answers } = collect();
  if (problems.length) {
    showSummary(problems);
    return;
  }
  summary.hidden = true;
  submit.disabled = true;
  form.setAttribute("aria-busy", "true");
  try {
    const response = await fetch(`${API_BASE}/api/public/applications/general_inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...answers,
        website_url_confirm: form.elements.website_url_confirm.value,
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
      applyServerFields(body.fields ?? {});
      if (!body.fields) status.textContent = typeof body.error === "string" ? body.error : "راجع الحقول وحاول مرة ثانية.";
      return;
    }
    status.textContent = "تعذر الإرسال. حاول مرة ثانية.";
  } catch {
    status.textContent = "تعذر الإرسال. حاول مرة ثانية.";
  } finally {
    submit.disabled = false;
    form.removeAttribute("aria-busy");
  }
}

if (form && summary && status) {
  form.addEventListener("submit", send);
  form.addEventListener("input", (event) => {
    const name = event.target instanceof HTMLElement ? event.target.getAttribute("name") : "";
    if (!name || !fields.some((field) => field.name === name)) return;
    setFieldError(name, "");
    summary.querySelector(`a[href="#${CSS.escape(name)}"]`)?.closest("li")?.remove();
    if (!summary.querySelector("li")) summary.hidden = true;
  });
}
