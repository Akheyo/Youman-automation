'use client'

import { useState, type FormEvent } from 'react'
import { site } from '@/lib/site'
import { Icon } from './Icon'

const serviceOptions = [
  'KI-Automation',
  'KI-Chatbot',
  'Website',
  'E-Commerce',
  'Etwas anderes',
]

const budgetOptions = [
  'Unter 500 €',
  '500 € – 1.000 €',
  '1.000 € – 3.000 €',
  '3.000 € – 5.000 €',
  'Über 5.000 €',
  'Noch unklar',
]

type Errors = Partial<Record<'name' | 'email' | 'service' | 'message', string>>

/**
 * No backend in this project yet: the form validates client-side and then hands
 * off to the visitor's mail client with a prefilled message. Swap `buildMailto`
 * for a POST to an API route once an endpoint exists.
 */
export function ContactForm() {
  const [errors, setErrors] = useState<Errors>({})

  function validate(data: FormData): Errors {
    const next: Errors = {}
    const name = String(data.get('name') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    const service = String(data.get('service') ?? '').trim()
    const message = String(data.get('message') ?? '').trim()

    if (name.length < 2) next.name = 'Bitte gib deinen Namen an.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      next.email = 'Bitte gib eine gültige E-Mail-Adresse an.'
    if (!service) next.service = 'Bitte wähle einen Bereich aus.'
    if (message.length < 10)
      next.message = 'Beschreibe dein Vorhaben bitte in mindestens einem Satz.'

    return next
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const found = validate(data)
    setErrors(found)

    if (Object.keys(found).length > 0) {
      const firstKey = Object.keys(found)[0]
      form.querySelector<HTMLElement>(`[name="${firstKey}"]`)?.focus()
      return
    }

    const body = [
      `Name: ${data.get('name')}`,
      `E-Mail: ${data.get('email')}`,
      `Unternehmen: ${data.get('company') || '—'}`,
      `Bereich: ${data.get('service')}`,
      `Budget: ${data.get('budget') || '—'}`,
      '',
      String(data.get('message') ?? ''),
    ].join('\n')

    window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(
      `Anfrage: ${data.get('service')}`,
    )}&body=${encodeURIComponent(body)}`
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <div className="form__row">
        <Field
          label="Name"
          name="name"
          required
          error={errors.name}
          autoComplete="name"
        />
        <Field
          label="E-Mail"
          name="email"
          type="email"
          required
          error={errors.email}
          autoComplete="email"
        />
      </div>

      <div className="form__row">
        <Field
          label="Unternehmen"
          name="company"
          hint="Optional"
          autoComplete="organization"
        />
        <SelectField
          label="Worum geht es?"
          name="service"
          required
          options={serviceOptions}
          error={errors.service}
        />
      </div>

      <SelectField
        label="Budgetrahmen"
        name="budget"
        hint="Optional — hilft mir, realistisch einzuschätzen"
        options={budgetOptions}
      />

      <div className="field">
        <label className="field__label" htmlFor="message">
          Dein Vorhaben <span className="field__req">*</span>
        </label>
        <p className="field__hint" id="message-hint">
          Was läuft heute manuell, und wie sähe das ideale Ergebnis aus?
        </p>
        <textarea
          id="message"
          name="message"
          rows={6}
          className={`field__input${errors.message ? ' field__input--error' : ''}`}
          aria-describedby={errors.message ? 'message-error' : 'message-hint'}
          aria-invalid={errors.message ? true : undefined}
        />
        {errors.message ? (
          <p className="field__error" id="message-error">
            {errors.message}
          </p>
        ) : null}
      </div>

      <button type="submit" className="btn btn--primary btn--block">
        Anfrage senden
        <Icon name="arrow" size={16} />
      </button>

      <p className="form__note">
        Deine Angaben öffnen eine vorbereitete E-Mail in deinem Mailprogramm. Antwort
        kommt innerhalb von {site.responseTime}.
      </p>
    </form>
  )
}

type FieldProps = {
  label: string
  name: string
  type?: string
  required?: boolean
  hint?: string
  error?: string
  autoComplete?: string
}

function Field({ label, name, type = 'text', required, hint, error, autoComplete }: FieldProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={name}>
        {label} {required ? <span className="field__req">*</span> : null}
      </label>
      {hint ? (
        <p className="field__hint" id={`${name}-hint`}>
          {hint}
        </p>
      ) : null}
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        className={`field__input${error ? ' field__input--error' : ''}`}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p className="field__error" id={`${name}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function SelectField({
  label,
  name,
  options,
  required,
  hint,
  error,
}: {
  label: string
  name: string
  options: string[]
  required?: boolean
  hint?: string
  error?: string
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={name}>
        {label} {required ? <span className="field__req">*</span> : null}
      </label>
      {hint ? (
        <p className="field__hint" id={`${name}-hint`}>
          {hint}
        </p>
      ) : null}
      <select
        id={name}
        name={name}
        defaultValue=""
        className={`field__input field__select${error ? ' field__input--error' : ''}`}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        aria-invalid={error ? true : undefined}
      >
        <option value="" disabled>
          Bitte wählen …
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error ? (
        <p className="field__error" id={`${name}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
