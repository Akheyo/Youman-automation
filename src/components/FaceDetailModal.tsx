"use client";

/**
 * Modal-Dialog für eine einzelne Dachfläche.
 *
 * Wird geöffnet, wenn der User auf eine Dachfläche klickt, aber keinen Slot
 * trifft. Zeigt die wichtigsten Kennzahlen: Ausrichtung, Neigung, relative
 * Effizienz und Fläche. Erlaubt zudem, alle Module dieser Fläche per
 * Mülleimer-Icon zu entfernen (mit `confirm()` als Sicherheitsabfrage).
 */

import type { RoofFace } from "@/types/solar";
import { orientationLabel } from "@/lib/orientationLabel";
import { calculateEfficiency, efficiencyColor } from "@/lib/efficiency";
import { MAX_MODULES_PER_FACE } from "@/lib/constants";

type Props = {
  face: RoofFace;
  moduleCount: number;
  onClose: () => void;
  onClearFaceModules: () => void;
};

export default function FaceDetailModal({
  face,
  moduleCount,
  onClose,
  onClearFaceModules,
}: Props) {
  const efficiency = calculateEfficiency(face.azimuthDeg, face.pitchDeg);
  const color = efficiencyColor(efficiency);

  const handleClear = () => {
    if (moduleCount === 0) return;
    const yes = window.confirm(
      `Alle ${moduleCount} Module auf „${face.label}" entfernen?`,
    );
    if (yes) onClearFaceModules();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff",
          borderRadius: 12,
          width: 360,
          maxWidth: "calc(100vw - 32px)",
          boxShadow: "0 30px 80px rgba(15,23,42,0.35)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#1e50e0",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Dachfläche
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              {orientationLabel(face.azimuthDeg)}
            </h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleClear}
              disabled={moduleCount === 0}
              title="Alle Module auf dieser Fläche entfernen"
              style={{
                ...iconBtnStyle,
                color: moduleCount === 0 ? "#cbd5f5" : "#dc2626",
                cursor: moduleCount === 0 ? "not-allowed" : "pointer",
              }}
              aria-label="Module dieser Fläche entfernen"
            >
              🗑
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ ...iconBtnStyle, color: "#64748b" }}
              aria-label="Dialog schließen"
            >
              ✕
            </button>
          </div>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            padding: 16,
            background: "#f8fafc",
          }}
        >
          <Metric label="Neigung" value={`${face.pitchDeg.toFixed(0)}°`} />
          <Metric
            label="Effizienz"
            value={`${efficiency} %`}
            valueColor={color}
          />
          <Metric label="Fläche" value={`${face.areaM2.toFixed(0)} m²`} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderTop: "1px solid #e2e8f0",
            fontSize: 14,
          }}
        >
          <span style={{ color: "#64748b" }}>Module auf dieser Fläche</span>
          <span
            style={{
              fontWeight: 700,
              color:
                moduleCount >= MAX_MODULES_PER_FACE ? "#dc2626" : "#0f172a",
            }}
          >
            {moduleCount} / {MAX_MODULES_PER_FACE}
          </span>
        </div>

        <footer
          style={{
            padding: 16,
            display: "flex",
            justifyContent: "flex-end",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#1e50e0",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            OK
          </button>
        </footer>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "8px 4px",
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "#64748b",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: valueColor ?? "#0f172a",
        }}
      >
        {value}
      </span>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  background: "transparent",
  border: "none",
  borderRadius: 6,
  fontSize: 16,
  cursor: "pointer",
};
