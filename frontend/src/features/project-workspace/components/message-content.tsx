type MessageContentProps = {
  content: string;
  fallback?: string;
};

export function MessageContent({ content, fallback }: MessageContentProps) {
  const normalized = normalizeContent(content || fallback || "");
  const blocks = parseBlocks(normalized);

  return (
    <div className="space-y-3 text-sm leading-6 text-foreground">
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}

type Block =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

function normalizeContent(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/\r\n/g, "\n")
    .trim();
}

function parseBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (/^#{2,3}\s+/.test(line)) {
      blocks.push({
        type: "heading",
        level: line.startsWith("###") ? 3 : 2,
        text: line.replace(/^#{2,3}\s+/, ""),
      });
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const tableLines: string[] = [];
      while (index < lines.length && isTableLine(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }
      const table = parseTable(tableLines);
      if (table) blocks.push(table);
      continue;
    }

    if (/^(?:[-*]\s+|\d+[.)]\s+)/.test(line)) {
      const ordered = /^\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        const matches = ordered
          ? /^\d+[.)]\s+/.test(current)
          : /^[-*]\s+/.test(current);
        if (!matches) break;
        items.push(current.replace(/^(?:[-*]|\d+[.)])\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (
        !current ||
        /^#{2,3}\s+/.test(current) ||
        isTableStart(lines, index) ||
        /^(?:[-*]\s+|\d+[.)]\s+)/.test(current)
      ) {
        break;
      }
      paragraph.push(current);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function isTableStart(lines: string[], index: number) {
  return (
    isTableLine(lines[index]) &&
    Boolean(
      lines[index + 1]?.match(
        /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/,
      ),
    )
  );
}

function isTableLine(line = "") {
  return line.trim().startsWith("|") && line.includes("|");
}

function parseTable(lines: string[]): Block | null {
  if (lines.length < 2) return null;
  const rows = lines
    .filter((line, index) => index !== 1)
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    );
  const [headers, ...body] = rows;
  if (!headers?.length || body.length === 0) return null;
  return { type: "table", headers, rows: body };
}

function renderBlock(block: Block, index: number) {
  if (block.type === "heading") {
    const Tag = block.level === 2 ? "h2" : "h3";
    return (
      <Tag key={index} className="pt-1 text-base font-semibold leading-6">
        {renderInline(block.text)}
      </Tag>
    );
  }

  if (block.type === "list") {
    const Tag = block.ordered ? "ol" : "ul";
    return (
      <Tag
        key={index}
        className={
          block.ordered
            ? "list-decimal space-y-1 pl-5"
            : "list-disc space-y-1 pl-5"
        }
      >
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderInline(item)}</li>
        ))}
      </Tag>
    );
  }

  if (block.type === "table") {
    return (
      <div key={index} className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[560px] border-collapse text-left text-xs">
          <thead className="bg-muted/70 text-foreground">
            <tr>
              {block.headers.map((header, headerIndex) => (
                <th
                  key={headerIndex}
                  className="border-b px-3 py-2 font-semibold align-top"
                >
                  {renderInline(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b last:border-b-0">
                {block.headers.map((_, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="px-3 py-2 align-top text-muted-foreground"
                  >
                    {renderInline(row[cellIndex] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <p key={index} className="text-muted-foreground">
      {renderInline(block.text)}
    </p>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
