/**
 * Zentrale Three.js-Materialien für den 3D-Solarplaner.
 *
 * Damit die Visualisierung konsistent bleibt, werden Materialien einmal
 * erzeugt und wiederverwendet. Farben:
 *   - Gebäudewände: grau
 *   - Dachfläche ausgewählt: blau (transluzent, Module sichtbar darüber)
 *   - Dachfläche nicht ausgewählt: hellgrau
 *   - Hover-Highlight: hellblau
 *   - PV-Modul: dunkelgrau / schwarz
 *   - Kantenlinien: dunkelgrau
 */

import * as THREE from "three";

export type Materials = {
  building: THREE.MeshStandardMaterial;
  roofSelected: THREE.MeshStandardMaterial;
  roofUnselected: THREE.MeshStandardMaterial;
  roofHover: THREE.MeshStandardMaterial;
  module: THREE.MeshStandardMaterial;
  edges: THREE.LineBasicMaterial;
};

export function createMaterials(): Materials {
  const building = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.85,
    metalness: 0.0,
    flatShading: true,
  });

  const roofSelected = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.7,
    metalness: 0.05,
    flatShading: true,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });

  const roofUnselected = new THREE.MeshStandardMaterial({
    // Deutlich heller als die Wand (slate-500, 0x9ca3af), damit die nicht
    // ausgewählten Walm-Flächen gegen die Wand klar erkennbar bleiben.
    color: 0xe5e7eb,
    roughness: 0.85,
    metalness: 0.0,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const roofHover = new THREE.MeshStandardMaterial({
    color: 0x60a5fa,
    roughness: 0.7,
    metalness: 0.0,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const moduleMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    roughness: 0.4,
    metalness: 0.1,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const edges = new THREE.LineBasicMaterial({
    color: 0x111827,
    transparent: true,
    opacity: 0.7,
  });

  return {
    building,
    roofSelected,
    roofUnselected,
    roofHover,
    module: moduleMat,
    edges,
  };
}

export function disposeMaterials(materials: Materials) {
  for (const m of Object.values(materials)) {
    m.dispose();
  }
}
