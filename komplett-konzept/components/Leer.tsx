export function Leer({ titel, text }: { titel: string; text?: string }) {
  return (
    <div className="leer">
      <strong>{titel}</strong>
      {text ? <span>{text}</span> : null}
    </div>
  )
}
