export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
}


// Helper to normalize markdown for comparison
export function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\s+/g, ' ')
    .replace(/\s+$/gm, '')
    .trim();
}