'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import type { LeadPayload } from '@/types';

const TIMEFRAMES = [
  { value: 'sofort', label: 'So bald wie möglich' },
  { value: '1-3-monate', label: 'In 1–3 Monaten' },
  { value: '3-6-monate', label: 'In 3–6 Monaten' },
  { value: 'spaeter', label: 'Später / unsicher' },
];

interface FieldErrors {
  name?: string;
  phone?: string;
  email?: string;
  consent?: string;
  submit?: string;
}

export default function LeadForm({ source = 'standalone' }: { source?: string }) {
  const address = useApp((s) => s.address);
  const consumption = useApp((s) => s.consumption);
  const result = useApp((s) => s.result);
  const setLoading = useApp((s) => s.setLoading);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[0]?.value ?? 'sofort');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!name.trim()) e.name = 'Bitte Namen angeben.';
    if (!phone.trim() || phone.length < 6) e.phone = 'Bitte gültige Telefonnummer angeben.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Bitte gültige E-Mail angeben.';
    if (!consent) e.consent = 'Datenschutz-Einwilligung erforderlich.';
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    if (!address || !result) {
      setErrors({ submit: 'Bitte zuerst Adresse und Dachkonfiguration abschließen.' });
      return;
    }

    const payload: LeadPayload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      timeframe,
      message: message.trim() || undefined,
      address: address.placeName,
      lat: address.center[1],
      lng: address.center[0],
      consumption,
      calculation: {
        recommendedKwp: result.recommendedKwp,
        moduleCount: result.moduleCount,
        yearlyYieldKwh: result.yearlyYieldKwh,
        yearlySavingsEur: result.yearlySavingsEur,
        investmentEur: result.investmentEur,
        paybackYears: result.paybackYears,
        co2SavingsT: result.co2SavingsT,
      },
      timestamp: new Date().toISOString(),
      consent: true,
      source,
    };

    setSubmitted('sending');
    setLoading('lead', true);
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ submit: data.error || `Übermittlung fehlgeschlagen (HTTP ${res.status}).` });
        setSubmitted('error');
        return;
      }
      setSubmitted('sent');
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : String(err) });
      setSubmitted('error');
    } finally {
      setLoading('lead', false);
    }
  }

  if (submitted === 'sent') {
    return (
      <div className="lead lead--success" role="status">
        <h3>Danke {name.split(' ')[0] || ''}!</h3>
        <p>
          Ihre Anfrage ist bei A&amp;B Solarenergy eingegangen. Unser Vertriebsteam
          meldet sich innerhalb von 1–2 Werktagen telefonisch bei Ihnen.
        </p>
      </div>
    );
  }

  return (
    <form className="lead" onSubmit={handleSubmit} noValidate>
      <h3>Persönliches Angebot anfordern</h3>
      <p className="lead__intro">
        A&amp;B Solarenergy meldet sich kostenlos und unverbindlich bei Ihnen.
      </p>

      <label className={`field${errors.name ? ' has-error' : ''}`}>
        <span>Name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        {errors.name && <em>{errors.name}</em>}
      </label>

      <label className={`field${errors.phone ? ' has-error' : ''}`}>
        <span>Telefon</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          autoComplete="tel"
          inputMode="tel"
        />
        {errors.phone && <em>{errors.phone}</em>}
      </label>

      <label className={`field${errors.email ? ' has-error' : ''}`}>
        <span>E-Mail</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        {errors.email && <em>{errors.email}</em>}
      </label>

      <label className="field">
        <span>Zeitraum für Umsetzung</span>
        <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
          {TIMEFRAMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Nachricht (optional)</span>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="z.B. Wann darf ich angerufen werden?"
        />
      </label>

      <label className={`checkbox${errors.consent ? ' has-error' : ''}`}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Ich willige ein, dass A&amp;B Solarenergy meine Daten zur Bearbeitung dieser Anfrage
          speichert. Details siehe Datenschutzerklärung.
        </span>
        {errors.consent && <em>{errors.consent}</em>}
      </label>

      <button type="submit" className="btn btn--primary" disabled={submitted === 'sending'}>
        {submitted === 'sending' ? 'Wird gesendet…' : 'Persönliches Angebot anfordern'}
      </button>

      {errors.submit && (
        <div className="lead__error" role="alert">
          {errors.submit}
        </div>
      )}
    </form>
  );
}
