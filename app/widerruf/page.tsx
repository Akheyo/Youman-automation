import Link from 'next/link';

export const metadata = {
  title: 'Widerrufsrecht — Youman Automation',
  robots: { index: true, follow: true },
};

export default function WiderrufPage() {
  return (
    <main className="legal">
      <Link href="/" className="legal__back">← Zurück zur Startseite</Link>
      <h1>Widerrufsrecht</h1>
      <p className="legal__notice">
        ⚠️ <strong>Entwurf.</strong> Bitte vor dem Launch rechtlich bestätigen lassen — vor allem,
        ob dein Angebot wirklich rein B2B bleibt.
      </p>
      <p className="legal__updated">Stand: Juni 2026</p>

      <p>
        Youman Automation richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB. Ein
        gesetzliches Widerrufsrecht steht nur Verbrauchern (§ 13 BGB) zu. Da unsere Leistungen
        ausschließlich für unternehmerische Zwecke bereitgestellt und ausschließlich an Unternehmer
        verkauft werden, besteht <strong>kein gesetzliches Widerrufsrecht</strong> nach §§ 312g, 355 BGB.
      </p>
      <p>
        Sollte wider Erwarten ein Verbraucher einen Vertrag abschließen, gilt das gesetzliche
        14-tägige Widerrufsrecht; in diesem Fall ist vor der Buchung eine gesonderte
        Widerrufsbelehrung &amp; ein Muster-Widerrufsformular bereitzustellen. (→ mit Anwält:in klären,
        ob ein Verbraucher-Ausschluss bei der Registrierung technisch abgesichert werden soll.)
      </p>
      <p>
        Fragen zu deinem Vertrag? Schreib uns an
        {' '}<a href="mailto:[kontakt@youman-automation.com]">[kontakt@youman-automation.com]</a>.
      </p>
    </main>
  );
}
