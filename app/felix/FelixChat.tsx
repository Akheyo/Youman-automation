'use client';

/**
 * Felix — chat UI. Talks to /api/felix/chat, renders the reply plus structured
 * company cards (highlighting leads without a website).
 */

import { useEffect, useRef, useState } from 'react';
import styles from './felix.module.css';
import Markdown from './Markdown';

interface Company {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  hasWebsite: boolean;
  descriptors: string[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  companies?: Company[];
}

const GREETING: Message = {
  role: 'assistant',
  content:
    'Hi, ich bin Felix — dein Lead-Scout. Sag mir Region und Branche, dann finde ich passende Unternehmen in Deutschland. Beispiel: „Friseure in Dortmund ohne Website" oder „Werbeagenturen in Münster".',
};

export default function FelixChat() {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const STARTERS = [
    'Restaurants in Borken ohne Website',
    'Dachdecker in Münster',
    'Friseure in Dortmund',
    'Werbeagenturen in Köln',
  ];

  async function send(preset?: string) {
    const text = (preset ?? input).trim();
    if (!text || loading) return;
    setError(null);
    const nextMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/felix/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages
            .filter((m) => m !== GREETING)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = [data.error, data.detail, data.action].filter(Boolean).join(' — ');
        setError(detail || `Fehler (HTTP ${res.status}).`);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply, companies: data.companies },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Netzwerkfehler.');
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>F</div>
        <div>
          <div className={styles.title}>Felix</div>
          <div className={styles.subtitle}>KI-Lead-Scout · Youman Automation</div>
        </div>
      </header>

      <div className={styles.thread} ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? styles.rowUser : styles.rowBot}>
            <div className={m.role === 'user' ? styles.bubbleUser : styles.bubbleBot}>
              {m.role === 'user' ? (
                <div className={styles.text}>{m.content}</div>
              ) : (
                <Markdown text={m.content} />
              )}
              {i === 0 && m.role === 'assistant' && messages.length === 1 && (
                <div className={styles.chips}>
                  {STARTERS.map((s) => (
                    <button key={s} className={styles.chip} onClick={() => void send(s)} disabled={loading}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {m.companies && m.companies.length > 0 && (
                <div className={styles.cards}>
                  {m.companies.map((c) => (
                    <CompanyCard key={c.id} c={c} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className={styles.rowBot}>
            <div className={styles.bubbleBot}>
              <span className={styles.typing}>
                <i /> <i /> <i />
              </span>
            </div>
          </div>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.composer}>
        <textarea
          className={styles.input}
          value={input}
          placeholder="Region + Branche, z. B. Restaurants in Köln ohne Website …"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
        />
        <button className={styles.sendBtn} onClick={() => void send()} disabled={loading || !input.trim()}>
          Senden
        </button>
      </div>
    </div>
  );
}

function CompanyCard({ c }: { c: Company }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardName}>{c.name}</span>
        {!c.hasWebsite ? (
          <span className={styles.badgeHot}>keine Website</span>
        ) : (
          <span className={styles.badgeOk}>Website</span>
        )}
      </div>
      {c.address && <div className={styles.cardLine}>{c.address}</div>}
      <div className={styles.cardLine}>
        {c.phone ? (
          <a href={`tel:${c.phone.replace(/\s+/g, '')}`}>{c.phone}</a>
        ) : (
          <span className={styles.muted}>kein Telefon</span>
        )}
        {c.website && (
          <>
            {' · '}
            <a href={c.website} target="_blank" rel="noreferrer noopener">
              Website
            </a>
          </>
        )}
      </div>
      {c.descriptors.length > 0 && <div className={styles.tags}>{c.descriptors.join(' · ')}</div>}
    </div>
  );
}
