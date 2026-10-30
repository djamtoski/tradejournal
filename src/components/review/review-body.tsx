import { Fragment } from "react";

/**
 * Renders the small markdown subset reviews use: ## / ### headings, "-" and
 * "1." lists, paragraphs, **bold** and `code`. Text is never parsed as HTML.
 */
export function ReviewBody({ content }: { content: string }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(" "))}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, i) => <li key={i}>{inline(item)}</li>);
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length} className="list-decimal space-y-1 pl-5">{items}</ol>
      ) : (
        <ul key={blocks.length} className="list-disc space-y-1 pl-5 marker:text-faint">{items}</ul>
      ),
    );
    list = null;
  };

  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      blocks.push(
        <h3 key={blocks.length} className="pt-2 font-sans text-[13px] font-medium tracking-normal text-foreground first:pt-0">
          {inline(heading[1])}
        </h3>,
      );
    } else if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (!line) {
      flushPara();
      flushList();
    } else if (list) {
      list.items[list.items.length - 1] += ` ${line}`; // wrapped list item
    } else {
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-muted-foreground">{blocks}</div>;
}

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-medium text-foreground">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="num rounded bg-muted px-1 text-[12px] text-foreground">{part.slice(1, -1)}</code>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
