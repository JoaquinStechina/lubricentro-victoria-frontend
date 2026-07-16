import { normalizeText } from "@/app/lib/text";

type HighlightTextProps = {
  text: string;
  query: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function HighlightText({ text, query }: HighlightTextProps) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;

  // Compara de forma insensible a acentos (normalizeText), pero conserva el
  // texto original en pantalla: cada carácter se normaliza por separado para
  // que los índices del match coincidan 1:1 con `text`.
  const chars = Array.from(text);
  const normalizedChars = chars.map((c) => normalizeText(c) || c);
  const normalizedText = normalizedChars.join("");
  const regex = new RegExp(escapeRegExp(normalizeText(trimmed)), "g");

  const parts: { value: string; match: boolean }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(normalizedText))) {
    if (match.index > lastIndex) {
      parts.push({
        value: chars.slice(lastIndex, match.index).join(""),
        match: false,
      });
    }
    parts.push({
      value: chars.slice(match.index, match.index + match[0].length).join(""),
      match: true,
    });
    lastIndex = match.index + match[0].length;
    if (match[0].length === 0) regex.lastIndex++;
  }
  if (lastIndex < chars.length) {
    parts.push({ value: chars.slice(lastIndex).join(""), match: false });
  }

  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="rounded-sm bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/40"
          >
            {part.value}
          </mark>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
  );
}
