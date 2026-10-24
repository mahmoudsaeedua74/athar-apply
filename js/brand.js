export const OPENING_LINE = "أثر... لأن النجاح له أثر";
export const CLOSING_LINE = "أثر... نتائج تُرى";

export function brandMark(tagline, variant) {
  const banner = document.createElement("div");
  banner.className = variant === "close" ? "mast mast-close" : "mast mast-open";
  const text = document.createElement("p");
  text.textContent = tagline;
  const logo = document.createElement("img");
  logo.src = "/assets/athar-logo.png";
  logo.alt = "ATHAR.ads";
  if (variant === "close") {
    const rule = document.createElement("span");
    rule.className = "mast-rule";
    rule.setAttribute("aria-hidden", "true");
    banner.append(text, rule, logo);
  } else {
    banner.append(text, logo);
  }
  return banner;
}
