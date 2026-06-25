// components/Markdown.tsx
// Легкий рендер Markdown для AI-відповідей (заголовки, списки, **жирний**, *курсив*, `код`).
'use client';

import React from 'react';

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) nodes.push(<strong key={`${keyPrefix}-b${i}`} className="font-semibold text-gray-900">{m[2]}</strong>);
    else if (m[3] !== undefined) nodes.push(<em key={`${keyPrefix}-i${i}`}>{m[3]}</em>);
    else if (m[4] !== undefined) nodes.push(<code key={`${keyPrefix}-c${i}`} className="bg-gray-100 px-1 rounded text-xs">{m[4]}</code>);
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, idx) => <li key={idx}>{renderInline(it, `li${key}-${idx}`)}</li>);
    blocks.push(
      list.ordered
        ? <ol key={key++} className="list-decimal pl-5 space-y-1 my-2">{items}</ol>
        : <ul key={key++} className="list-disc pl-5 space-y-1 my-2">{items}</ul>
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const cls = h[1].length <= 2 ? 'text-base font-semibold mt-3 mb-1' : 'text-sm font-semibold mt-2 mb-1';
      blocks.push(<p key={key++} className={`${cls} text-gray-900`}>{renderInline(h[2], `h${key}`)}</p>);
      continue;
    }

    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ol) {
      if (!list || !list.ordered) { flush(); list = { ordered: true, items: [] }; }
      list.items.push(ol[1]);
      continue;
    }
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (ul) {
      if (!list || list.ordered) { flush(); list = { ordered: false, items: [] }; }
      list.items.push(ul[1]);
      continue;
    }

    flush();
    blocks.push(<p key={key++} className="my-1.5">{renderInline(line, `p${key}`)}</p>);
  }
  flush();

  return <div className={`text-sm text-gray-800 leading-relaxed ${className}`}>{blocks}</div>;
}
