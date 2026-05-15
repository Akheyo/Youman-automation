/**
 * Zentrale Three.js-Materialien für den 3D-Solarplaner.
 *
 * Damit die Visualisierung konsistent bleibt, werden Materialien einmal
 * erzeugt und wiederverwendet. Farben:
 *   - Gebäudewände: grau
 *   - Giebel-/Stirnwände: gleicher Ton wie Wände, DoubleSide für sichere
 *     Sicht unabhängig vom Triangle-Winding
 *   - Dachfläche (Basis): Anthrazit – wird IMMER gerendert
 *   - Dachfläche (Highlight): Blau, leicht transparent, mit polygonOffset
 *     als Overlay über der Anthrazit-Basis (PV-tauglich markiert)
 *   - Hover-Highlight: hellblau
 *   - PV-Modul: dunkelgrau / schwarz
 *   - Kantenlinien: dunkelgrau
 */

import * as THREE from "three";

export type Materials = {
  building: THREE.MeshStandardMaterial;
  gable: THREE.MeshStandardMaterial;
  roofBase: THREE.MeshStandardMaterial;
  roofHighlight: THREE.MeshStandardMaterial;
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

  // Giebel: gleiche Farbe wie die Wände, aber DoubleSide – das Triangle-Winding
  // der Gable-Dreiecke ergibt sich aus dem Footprint und dem Ridge-Apex und
  // ist nicht garantiert konsistent. DoubleSide rendert in jedem Fall korrekt.
  const gable = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.85,
    metalness: 0.0,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  // Anthrazit-Standard für alle Dachflächen.
  const roofBase = new THREE.MeshStandardMaterial({
    color: 0x3a4250,
    roughness: 0.7,
    metalness: 0.05,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  // Blaues Highlight als Overlay über roofBase. polygonOffset zieht das Mesh
  // im Depth-Test minimal nach vorne, sodass es immer über der Basis-Schräge
  // gezeichnet wird (kein Z-Fighting/Flackern beim 360°-Orbit).
  const roofHighlight = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.65,
    metalness: 0.05,
    flatShading: true,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  // Legacy-Materialien (für ThreeBuildingLayer im Map-Mode, falls noch genutzt).
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
    gable,
    roofBase,
    roofHighlight,
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
