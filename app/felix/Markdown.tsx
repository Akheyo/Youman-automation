'use client';

/**
 * Tiny, dependency-free Markdown renderer for Felix's replies.
 * Covers exactly what the model emits: headings, bold/italic, links, inline
 * code, and bullet/numbered lists — rendered as styled React elements so the
 * chat no longer shows raw `**`, `###` or `[text](url)` markup.
 */

import React from 'react';
import styles from './felix.module.css';

const INLINE_RE =
  /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|`([^`]+)`/g;

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[1] !== undefined) {
      const url = m[2] ?? '';
      const href = url.startsWith('http') ? url : `https://${url}`;
      nodes.push(
        <a key={key} href={href} target="_blank" rel="noreferrer noopener">
          {m[1]}
        </a>,
      );
    } else if (m[3] !== undefined) {
      nodes.push(<strong key={key}>{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      nodes.push(<strong key={key}>{m[4]}</strong>);
    } else if (m[5] !== undefined) {
      nodes.push(<em key={key}>{m[5]}</em>);
    } else if (m[6] !== undefined) {
      nodes.push(<code key={key}>{m[6]}</code>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let k = 0;

  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={`p${k++}`} className={styles.mdP}>
          {para.map((l, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <br />}
              {renderInline(l, `p${k}-${idx}`)}
            </React.Fragment>
          ))}
        </p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((it, idx) => (
        <li key={idx}>{renderInline(it, `li${k}-${idx}`)}</li>
      ));
      blocks.push(
        list.ordered ? (
          <ol key={`l${k++}`} className={styles.mdList}>
            {items}
          </ol>
        ) : (
          <ul key={`l${k++}`} className={styles.mdList}>
            {items}
          </ul>
        ),
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    const hr = /^\s*([-*_])\1{2,}\s*$/.test(line);

    if (line.trim() === '') {
      flushPara();
      flushList();
    } else if (hr) {
      flushPara();
      flushList();
      blocks.push(<hr key={`hr${k++}`} className={styles.mdHr} />);
    } else if (heading) {
      flushPara();
      flushList();
      const level = (heading[1] ?? '#').length;
      const cls = level <= 2 ? styles.mdH2 : styles.mdH3;
      blocks.push(
        <div key={`h${k++}`} className={cls}>
          {renderInline(heading[2] ?? '', `h${k}`)}
        </div>,
      );
    } else if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered;
      const item = ((bullet ? bullet[1] : numbered?.[1]) ?? '').trim();
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(item);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div className={styles.md}>{blocks}</div>;
}
