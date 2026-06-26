/**
 * Lina — the AI phone agent. This module turns the user-editable "Soul"
 * (agent_config row) into a Vapi assistant definition, including the two live
 * tools Lina uses during a call: checking calendar availability and booking.
 */

export interface AgentConfig {
  agent_name: string;
  language: string;
  voice: string;
  goal: string;
  opening_line: string;
  persona: string;
  guidelines: string;
  dos: string;
  donts: string;
  booking_link: string | null;
  max_duration: number;
  // Compliance
  record_calls: boolean;
  ai_disclosure: boolean;
  disclosure_text: string | null;
  // Warm transfer & voicemail
  transfer_number: string | null;
  voicemail_detection: boolean;
  voicemail_message: string | null;
}

export const DEFAULT_AGENT: AgentConfig = {
  agent_name: 'Lina',
  language: 'de',
  voice: 'mDRP1h6KfUD1XAUJxqr0', // Native deutsche ElevenLabs-Stimme (eigener Key in Vapi nötig)
  goal: 'Ein unverbindliches Kennenlern-Telefonat mit dem Geschäftsinhaber vereinbaren.',
  opening_line: 'Hallo, hier ist Lina von Youman Automation. Habe ich Sie gerade kurz erwischt?',
  persona:
    'Freundlich, professionell und respektvoll. Du klingst menschlich, nicht wie ein Verkäufer. Du hörst zu und gehst auf Antworten ein.',
  guidelines:
    'Stelle dich kurz vor. Erkläre in einem Satz den Nutzen. Frage nach Interesse an einem kurzen Termin. Sei nie aufdringlich.',
  dos: 'Höflich bleiben, Gesprächspartner ausreden lassen, Termin anbieten, Verfügbarkeit prüfen und Termin direkt buchen.',
  donts: 'Nicht drängen, nicht lügen, bei klarem Nein höflich verabschieden, keine Preise erfinden.',
  booking_link: null,
  max_duration: 240,
  record_calls: true,
  ai_disclosure: true,
  disclosure_text: null,
  transfer_number: null,
  voicemail_detection: true,
  voicemail_message: null,
};

/** Standard-Mailbox-Ansage, falls keine eigene hinterlegt ist. */
export function voicemailMessage(cfg: AgentConfig): string {
  return (
    (cfg.voicemail_message && cfg.voicemail_message.trim()) ||
    `Hallo, hier ist ${cfg.agent_name}. Ich habe Sie leider nicht erreicht und melde mich gern noch einmal. Schönen Tag!`
  );
}

/**
 * The mandatory compliance line spoken at the very start of every call. The AI
 * disclosure (EU AI Act / § 312a BGB) is ALWAYS present and cannot be switched
 * off; the recording notice (§ 201 StGB) is added when recording is active.
 */
export function disclosureLine(cfg: AgentConfig): string {
  if (cfg.disclosure_text && cfg.disclosure_text.trim()) return cfg.disclosure_text.trim();
  const ai = `Bevor wir starten, ein kurzer Hinweis: Ich bin ${cfg.agent_name}, eine digitale Sprach­assistentin.`;
  const rec = cfg.record_calls ? ' Dieses Gespräch wird zu Qualitätszwecken aufgezeichnet.' : '';
  return `${ai}${rec}`;
}

/** The first message Lina speaks — mandatory disclosure followed by the opening line. */
export function buildFirstMessage(cfg: AgentConfig): string {
  return `${disclosureLine(cfg)} ${cfg.opening_line}`;
}

export interface LeadContext {
  name?: string | null;
  company?: string | null;
  notes?: string | null;
  website?: string | null;
  anlass?: string | null;
}

/** The system prompt Lina runs on, woven from the Soul config + this lead. */
export function buildSystemPrompt(cfg: AgentConfig, lead: LeadContext, ownerName: string): string {
  const who = [lead.name && `Ansprechpartner: ${lead.name}`, lead.company && `Firma: ${lead.company}`, lead.website && `Website: ${lead.website}`]
    .filter(Boolean)
    .join('\n');

  const disclosure = disclosureLine(cfg);

  return [
    `Du bist ${cfg.agent_name}, eine KI-Telefonassistentin für ${ownerName}.`,
    `Du sprichst Deutsch, natürlich und in ganzen Sätzen (keine Aufzählungen, keine Emojis — das wird vorgelesen).`,
    ``,
    disclosure && `## Pflicht-Hinweis (rechtlich, zwingend)`,
    disclosure &&
      `Sage GANZ AM ANFANG des Gesprächs wortgetreu: "${disclosure}" Erst danach beginnst du mit deinem Eröffnungssatz. Wenn die Person der Aufzeichnung oder dem Gespräch widerspricht, verabschiede dich höflich und beende das Gespräch.`,
    disclosure ? `` : undefined,
    `## Deine Persönlichkeit`,
    cfg.persona,
    ``,
    `## Dein Ziel`,
    cfg.goal,
    ``,
    `## Gesprächsleitfaden`,
    cfg.guidelines,
    ``,
    `## Das solltest du tun`,
    cfg.dos,
    ``,
    `## Das solltest du NICHT tun`,
    cfg.donts,
    ``,
    who && `## Dieser Kontakt`,
    who,
    lead.notes ? `Notizen: ${lead.notes}` : '',
    lead.anlass ? `Anlass des Anrufs (sachlicher Aufhänger — natürlich einbauen, nicht wörtlich vorlesen): ${lead.anlass}` : '',
    ``,
    `## Termin vereinbaren`,
    `Wenn Interesse besteht, frage nach einem passenden Zeitraum. Nutze dann das Werkzeug "verfuegbarkeit_pruefen", um echte freie Slots aus dem Kalender zu holen, und schlage 2–3 davon vor.`,
    `Sobald sich der Kontakt auf einen Slot festlegt, buche ihn sofort mit dem Werkzeug "termin_buchen" und bestätige den Termin mündlich.`,
    `Frage nach einer E-Mail-Adresse für die Einladung, wenn möglich.`,
    ``,
    cfg.transfer_number ? `## Weiterleitung an einen Menschen` : undefined,
    cfg.transfer_number
      ? `Wenn der Kontakt ausdrücklich eine echte Person sprechen möchte ODER sehr großes, konkretes Interesse zeigt, leite das Gespräch sofort live weiter — nutze dafür das Werkzeug "transferCall". Kündige es kurz an ("Einen Moment, ich verbinde Sie mit einem Kollegen.").`
      : undefined,
    cfg.transfer_number ? `` : undefined,
    `## Wichtig`,
    `Beginne das Gespräch mit: "${cfg.opening_line}"`,
    `Halte dich kurz. Wenn die Person kein Interesse hat oder keine Zeit, verabschiede dich höflich und beende das Gespräch.`,
  ]
    .filter((l) => l !== undefined)
    .join('\n');
}

/** Tool/function definitions exposed to Vapi during the call. */
export function callTools() {
  return [
    {
      type: 'function',
      function: {
        name: 'verfuegbarkeit_pruefen',
        description:
          'Holt echte freie Termin-Slots aus dem Google-Kalender des Inhabers. Nutze dies, bevor du einen Termin vorschlägst.',
        parameters: {
          type: 'object',
          properties: {
            zeitraum: {
              type: 'string',
              description: 'Optionaler Wunschzeitraum des Kontakts, z. B. "nächste Woche" oder "Donnerstagnachmittag".',
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'termin_buchen',
        description: 'Bucht einen konkreten Termin im Kalender des Inhabers. Nur aufrufen, wenn sich der Kontakt festgelegt hat.',
        parameters: {
          type: 'object',
          properties: {
            start_iso: { type: 'string', description: 'Startzeit des Termins im ISO-8601-Format (mit Zeitzone).' },
            name: { type: 'string', description: 'Name des Kontakts.' },
            email: { type: 'string', description: 'E-Mail-Adresse des Kontakts für die Kalendereinladung (falls genannt).' },
          },
          required: ['start_iso'],
        },
      },
    },
  ];
}

/**
 * Map a short voice key to a Vapi voice config (11labs German-capable voices).
 *
 * The voice settings are tuned for natural, human-sounding outbound calls:
 * - eleven_turbo_v2_5 = multilingual + low latency (critical on the phone — any
 *   delay before answering instantly sounds robotic).
 * - stability 0.45    = expressive, not monotone (higher = flatter).
 * - similarityBoost .8 = stays close to the voice's natural timbre.
 * - style 0.35        = a touch of liveliness without over-acting.
 * - useSpeakerBoost   = clearer, fuller voice over a phone line.
 * - optimizeStreamingLatency 3 = snappy turn-taking so replies feel immediate.
 */
export function voiceConfig(voice: string) {
  return {
    provider: '11labs',
    voiceId: voice || 'sarah',
    model: 'eleven_turbo_v2_5',
    stability: 0.45,
    similarityBoost: 0.8,
    style: 0.35,
    useSpeakerBoost: true,
    optimizeStreamingLatency: 3,
  };
}
