const COMBINING_MARKS = /[̀-ͯ]/g;

export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}
