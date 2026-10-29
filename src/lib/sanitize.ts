import DOMPurify from "dompurify";

const OPTIONS = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "ul",
    "ol",
    "li",
    "a",
    "blockquote",
  ],
  ALLOWED_ATTR: ["href", "target", "rel"],
};

export function sanitizeHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, OPTIONS);
}
