'use client'

import { useId, useState } from 'react'

type Item = { q: string; a: string }

export function Accordion({ items }: { items: readonly Item[] }) {
  const baseId = useId()
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="accordion">
      {items.map((item, i) => {
        const isOpen = openIndex === i
        const panelId = `${baseId}-panel-${i}`
        const buttonId = `${baseId}-button-${i}`

        return (
          <div key={item.q} className={`accordion__item${isOpen ? ' is-open' : ''}`}>
            <h3 className="accordion__heading">
              <button
                id={buttonId}
                type="button"
                className="accordion__trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : i)}
              >
                <span>{item.q}</span>
                <span className="accordion__sign" aria-hidden="true" />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className="accordion__panel"
              hidden={!isOpen}
            >
              <p>{item.a}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
