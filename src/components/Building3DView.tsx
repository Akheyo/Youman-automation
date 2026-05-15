"use client";

/**
 * Building3DView
 *
 * Freistehende Three.js-Szene mit dem Gebäude. Slot-basierte Platzierung:
 * leere Modul-Slots werden als helle, semi-transparente Quads gezeichnet
 * und sind klickbar. Klick auf einen Slot setzt oder entfernt das Modul,
 * Klick auf eine Dachfläche außerhalb der Slots öffnet das Detail-Modal.
 *
 * Koordinatensystem: X = Ost, Y = Nord, Z = Höhe. `camera.up = (0, 0, 1)`.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { DetectedBuilding, ModuleSlot } from "@/types/solar";
import {
  buildBuildingGroup,
  disposeBuildingGroup,
  estimateRidgeHeight,
} from "@/lib/buildingGeometry";
import {
  createMaterials,
  disposeMaterials,
  type Materials,
} from "@/lib/map/materials";
import { MAX_MODULES_PER_FACE } from "@/lib/constants";
import { calculateEfficiency, efficiencyColor } from "@/lib/efficiency";
import { orientationLabel } from "@/lib/orientationLabel";
import { buildSlotGroup, disposeSlotGroup } from "@/lib/slotGeometry";

type Building3DViewProps = {
  building: DetectedBuilding | null;
  /** Wenn false, pausiert der RAF-Loop (Tab nicht sichtbar). */
  active: boolean;
  slots: ModuleSlot[];
  occupiedSlotIds: Set<string>;
  onToggleSlot: (slotId: string) => void;
  onOpenFaceModal: (faceId: string) => void;
};

type SelectedFaceInfo = {
  id: string;
  label: string;
  areaM2: number;
  pitchDeg: number;
  azimuthDeg: number;
  moduleCount: number;
};

const DEFAULT_CAM_POSITION = new THREE.Vector3(22, -22, 18);
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 0, 4);

export default function Building3DView({
  building,
  active,
  slots,
  occupiedSlotIds,
  onToggleSlot,
  onOpenFaceModal,
}: Building3DViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const buildingGroupRef = useRef<THREE.Group | null>(null);
  const slotsGroupRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<Materials | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const buildingRef = useRef<DetectedBuilding | null>(building);
  buildingRef.current = building;
  const onToggleSlotRef = useRef(onToggleSlot);
  onToggleSlotRef.current = onToggleSlot;
  const onOpenFaceModalRef = useRef(onOpenFaceModal);
  onOpenFaceModalRef.current = onOpenFaceModal;

  const [showModules, setShowModules] = useState(true);
  const [selectedFace, setSelectedFace] = useState<SelectedFaceInfo | null>(
    null,
  );

  /* ------------------------------------------------------------------ */
  /* Init – einmaliger Setup der Three-Szene                            */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f1f5f9");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);
    camera.up.set(0, 0, 1);
    camera.position.copy(DEFAULT_CAM_POSITION);
    camera.lookAt(DEFAULT_CAM_TARGET);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(15, -20, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.95,
        metalness: 0,
      }),
    );
    ground.receiveShadow = true;
    ground.userData = { kind: "ground" };
    scene.add(ground);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = 0.1;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.minDistance = 6;
    controls.maxDistance = 120;
    controls.target.copy(DEFAULT_CAM_TARGET);
    controls.update();
    controlsRef.current = controls;

    const materials = createMaterials();
    materialsRef.current = materials;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      if (!activeRef.current) return;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const ro = new ResizeObserver(() => {
      const w2 = mount.clientWidth || 1;
      const h2 = mount.clientHeight || 1;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    });
    ro.observe(mount);

    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      controls.dispose();
      if (buildingGroupRef.current) {
        scene.remove(buildingGroupRef.current);
        disposeBuildingGroup(buildingGroupRef.current);
        buildingGroupRef.current = null;
      }
      if (slotsGroupRef.current) {
        scene.remove(slotsGroupRef.current);
        disposeSlotGroup(slotsGroupRef.current);
        slotsGroupRef.current = null;
      }
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      disposeMaterials(materials);
      renderer.dispose();
      try {
        mount.removeChild(renderer.domElement);
      } catch {
        /* ignore */
      }
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      materialsRef.current = null;
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Building rebuild bei Datenänderung                                 */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const scene = sceneRef.current;
    const controls = controlsRef.current;
    const materials = materialsRef.current;
    if (!scene || !materials) return;

    if (buildingGroupRef.current) {
      scene.remove(buildingGroupRef.current);
      disposeBuildingGroup(buildingGroupRef.current);
      buildingGroupRef.current = null;
    }
    setSelectedFace(null);

    if (!building) return;

    const group = buildBuildingGroup(building, materials, {
      mode: "local",
      includeWalls: true,
      showEdges: true,
    });
    scene.add(group);
    buildingGroupRef.current = group;

    if (controls) {
      const ridge = estimateRidgeHeight(building);
      controls.target.set(0, 0, ridge / 2 || 4);
      controls.update();
    }
  }, [building]);

  /* ------------------------------------------------------------------ */
  /* Slots rendern (nur leere Slots; besetzte versteckt der Module-Mesh)*/
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const scene = sceneRef.current;
    const materials = materialsRef.current;
    if (!scene || !materials) return;
    if (slotsGroupRef.current) {
      scene.remove(slotsGroupRef.current);
      disposeSlotGroup(slotsGroupRef.current);
      slotsGroupRef.current = null;
    }
    if (slots.length === 0) return;
    const group = buildSlotGroup(slots, occupiedSlotIds, materials);
    scene.add(group);
    slotsGroupRef.current = group;
  }, [slots, occupiedSlotIds]);

  /* ------------------------------------------------------------------ */
  /* Module ein-/ausblenden                                             */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const group = buildingGroupRef.current;
    if (!group) return;
    group.traverse((obj) => {
      if (obj.userData?.kind === "module") {
        obj.visible = showModules;
      }
    });
  }, [showModules, building]);

  /* ------------------------------------------------------------------ */
  /* Pointer-Events: Klick auf Slot / Modul / Roof                       */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return;
    const dom = renderer.domElement;
    const ray = new THREE.Raycaster();

    let downX = 0;
    let downY = 0;
    let isDown = false;

    const onDown = (e: PointerEvent) => {
      isDown = true;
      downX = e.clientX;
      downY = e.clientY;
    };

    const onUp = (e: PointerEvent) => {
      if (!isDown) return;
      isDown = false;
      const dx = Math.abs(e.clientX - downX);
      const dy = Math.abs(e.clientY - downY);
      if (dx > 4 || dy > 4) return;

      const group = buildingGroupRef.current;
      const slotGroup = slotsGroupRef.current;
      const b = buildingRef.current;
      if (!b) return;
      const rect = dom.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(mouse, camera);

      // Slot hat höchste Priorität (liegt knapp über dem Dach).
      if (slotGroup) {
        const slotHits = ray.intersectObject(slotGroup, true);
        const slotHit = slotHits.find(
          (h) => (h.object as THREE.Mesh).isMesh,
        );
        if (slotHit) {
          const slotId = slotHit.object.userData?.slotId as
            | string
            | undefined;
          if (slotId) {
            onToggleSlotRef.current(slotId);
            return;
          }
        }
      }

      if (!group) return;
      const hits = ray.intersectObject(group, true);
      const moduleHit = hits.find(
        (h) =>
          (h.object as THREE.Mesh).isMesh &&
          h.object.userData?.kind === "module",
      );
      if (moduleHit) {
        const slotId = moduleHit.object.userData?.slotId as string | undefined;
        if (slotId) {
          onToggleSlotRef.current(slotId);
          return;
        }
      }
      const roofHit = hits.find(
        (h) =>
          (h.object as THREE.Mesh).isMesh &&
          h.object.userData?.kind === "roof",
      );
      if (!roofHit) {
        setSelectedFace(null);
        return;
      }
      const ud = roofHit.object.userData as {
        roofFaceId: string;
        label: string;
        areaM2: number;
        pitchDeg: number;
        azimuthDeg: number;
      };
      const moduleCount = b.modules.filter(
        (m) => m.roofFaceId === ud.roofFaceId,
      ).length;
      setSelectedFace({
        id: ud.roofFaceId,
        label: ud.label,
        areaM2: ud.areaM2,
        pitchDeg: ud.pitchDeg,
        azimuthDeg: ud.azimuthDeg,
        moduleCount,
      });
      // Detail-Modal aufrufen.
      onOpenFaceModalRef.current(ud.roofFaceId);
    };

    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointerup", onUp);
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointerup", onUp);
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Reset-View                                                         */
  /* ------------------------------------------------------------------ */
  function resetView() {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.copy(DEFAULT_CAM_POSITION);
    const ridge = building ? estimateRidgeHeight(building) : 0;
    controls.target.set(0, 0, ridge / 2 || 4);
    camera.lookAt(controls.target);
    controls.update();
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        background: "#f1f5f9",
      }}
    >
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {!building && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            padding: "16px 20px",
            background: "rgba(255,255,255,0.95)",
            color: "#475569",
            borderRadius: 10,
            boxShadow: "0 6px 24px rgba(15,23,42,0.10)",
            fontSize: 14,
            maxWidth: 360,
            textAlign: "center",
          }}
        >
          <strong style={{ color: "#0f172a", display: "block", marginBottom: 4 }}>
            Noch kein Gebäude
          </strong>
          Bitte zuerst eine Adresse eingeben und das Dach erkennen lassen
          oder selbst zeichnen.
        </div>
      )}

      {building && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "flex",
            gap: 8,
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={() => setShowModules((v) => !v)}
            style={toolbarBtnStyle(showModules)}
          >
            {showModules ? "Module aus" : "Module an"}
          </button>
          <button
            type="button"
            onClick={resetView}
            style={toolbarBtnStyle(false)}
          >
            Ansicht zurücksetzen
          </button>
        </div>
      )}

      {selectedFace && (
        <div
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            zIndex: 10,
            padding: "10px 14px",
            background: "rgba(255,255,255,0.96)",
            borderRadius: 10,
            boxShadow: "0 6px 20px rgba(15,23,42,0.14)",
            fontSize: 12,
            minWidth: 220,
            maxWidth: 280,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "#1d4ed8",
              fontWeight: 600,
            }}
          >
            Dachfläche
          </p>
          <p
            style={{
              margin: "2px 0 6px",
              fontSize: 14,
              fontWeight: 600,
              color: "#0f172a",
            }}
          >
            {orientationLabel(selectedFace.azimuthDeg)}
          </p>
          <Row label="Neigung" value={`${selectedFace.pitchDeg.toFixed(0)}°`} />
          <Row label="Fläche" value={`${selectedFace.areaM2.toFixed(1)} m²`} />
          <Row
            label="Effizienz"
            value={`${calculateEfficiency(selectedFace.azimuthDeg, selectedFace.pitchDeg)} %`}
            valueColor={efficiencyColor(
              calculateEfficiency(
                selectedFace.azimuthDeg,
                selectedFace.pitchDeg,
              ),
            )}
          />
          <Row
            label="Module"
            value={`${selectedFace.moduleCount} / ${MAX_MODULES_PER_FACE}`}
            valueColor={
              selectedFace.moduleCount >= MAX_MODULES_PER_FACE
                ? "#e11d48"
                : "#0f172a"
            }
          />
        </div>
      )}
    </div>
  );
}

function Row({
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
        justifyContent: "space-between",
        gap: 8,
        lineHeight: 1.5,
      }}
    >
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: valueColor ?? "#0f172a", fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

function toolbarBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    background: active ? "#1e50e0" : "rgba(255,255,255,0.96)",
    color: active ? "#ffffff" : "#1e3a8a",
    border: active ? "none" : "1px solid #bfdbfe",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
  };
}
