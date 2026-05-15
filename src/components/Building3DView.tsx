"use client";

/**
 * Building3DView
 *
 * Freistehende Three.js-Szene, die das Gebäude entkoppelt von der Karte
 * rendert. Nutzt denselben Geometrie-Builder wie ThreeBuildingLayer
 * (`buildBuildingGroup`), damit beide Ansichten zwingend dieselbe
 * Geometrie zeigen.
 *
 * Koordinatensystem: X = Ost, Y = Nord, Z = Höhe. Damit OrbitControls,
 * Kamera und Schatten sich daran orientieren, ist `camera.up = (0,0,1)`.
 *
 * Lifecycle:
 *   - 1× Mount: Scene, PerspectiveCamera, WebGLRenderer, OrbitControls,
 *     Sonne (mit Shadow-Map), AmbientLight, Bodenplane, RAF-Loop,
 *     ResizeObserver.
 *   - building-Prop wechselt: alte Building-Group disposen, neue über
 *     `buildBuildingGroup({ mode: "local" })` aufbauen, in die Szene
 *     hängen, Kamera-Target an die Building-Höhe anpassen.
 *   - Unmount: RAF stop, Controls dispose, Renderer dispose, alle
 *     Geometrien + Materialien disposen.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type {
  DetectedBuilding,
  ModuleSettings,
  RoofFace,
  Vec3,
} from "@/types/solar";
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
import {
  createModuleAtFacePoint,
  findModuleAtPoint3D,
  validatePlacementAtFacePoint,
} from "@/lib/geometry/manualModulePlacement";

type Building3DViewProps = {
  building: DetectedBuilding | null;
  /** Wenn false, pausiert der RAF-Loop (Tab nicht sichtbar). */
  active: boolean;
  /** Aktiviert Hover-Geist, Klick-Platzierung und Rechtsklick-Entfernen. */
  manualPlacementMode: boolean;
  moduleSettings: ModuleSettings;
  onPlaceAtFacePoint: (point: Vec3, face: RoofFace) => void;
  onRemoveModule: (id: string) => void;
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
  manualPlacementMode,
  moduleSettings,
  onPlaceAtFacePoint,
  onRemoveModule,
}: Building3DViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const buildingGroupRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<Materials | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const buildingRef = useRef<DetectedBuilding | null>(building);
  buildingRef.current = building;
  const manualPlacementRef = useRef(manualPlacementMode);
  manualPlacementRef.current = manualPlacementMode;
  const moduleSettingsRef = useRef(moduleSettings);
  moduleSettingsRef.current = moduleSettings;
  const onPlaceRef = useRef(onPlaceAtFacePoint);
  onPlaceRef.current = onPlaceAtFacePoint;
  const onRemoveRef = useRef(onRemoveModule);
  onRemoveRef.current = onRemoveModule;
  const ghostMeshRef = useRef<THREE.Mesh | null>(null);

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

    // Scene + Kamera (Z-up).
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f1f5f9");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);
    camera.up.set(0, 0, 1);
    camera.position.copy(DEFAULT_CAM_POSITION);
    camera.lookAt(DEFAULT_CAM_TARGET);
    cameraRef.current = camera;

    // Renderer mit Schatten.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lichter.
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

    // Bodenplane als Shadow-Receiver.
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

    // OrbitControls.
    // - Azimuth (Drehung um die Up-Achse) explizit auf -Infinity..Infinity:
    //   keine Begrenzung, der User kann das Haus unendlich oft umrunden.
    // - Polar von ~5,7° (0,1 rad) bis knapp π/2: nicht ganz von senkrecht oben
    //   und nicht unter den Boden, sonst flippt das Bild.
    // - Damping aktiv, RAF-Loop ruft jeden Frame controls.update() auf.
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

    // Materialien.
    const materials = createMaterials();
    materialsRef.current = materials;

    // Ghost-Mesh für Hover-Vorschau bei manueller Modulplatzierung.
    // 4 Vertices (quad), 2 Triangles via Index. Position-Attribute wird pro
    // Mausbewegung neu gesetzt; Material-Farbe wechselt grün ↔ rot.
    const ghostGeom = new THREE.BufferGeometry();
    ghostGeom.setIndex([0, 1, 2, 0, 2, 3]);
    ghostGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(12), 3),
    );
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ghost = new THREE.Mesh(ghostGeom, ghostMat);
    ghost.visible = false;
    ghost.userData = { kind: "ghost" };
    ghost.renderOrder = 10;
    scene.add(ghost);
    ghostMeshRef.current = ghost;

    // RAF-Loop.
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      if (!activeRef.current) return;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize-Observer.
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
      scene.remove(ghost);
      ghostGeom.dispose();
      ghostMat.dispose();
      ghostMeshRef.current = null;
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

    // Kamera-Target auf etwa halbe Firsthöhe.
    if (controls) {
      const ridge = estimateRidgeHeight(building);
      controls.target.set(0, 0, ridge / 2 || 4);
      controls.update();
    }
  }, [building]);

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

  /* Ghost ausblenden, sobald der manuelle Modus aus ist (oder das Building
   * sich ändert). Auch das Highlight wird zurückgesetzt, weil das Info-Panel
   * im Manuellen-Modus die UX stört. */
  useEffect(() => {
    if (!manualPlacementMode) {
      const ghost = ghostMeshRef.current;
      if (ghost) ghost.visible = false;
    } else {
      setSelectedFace(null);
      applyHighlight(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualPlacementMode, building]);

  /* ------------------------------------------------------------------ */
  /* Pointer-Events: Klick / Hover / Rechtsklick                        */
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

    const setMouseFromEvent = (e: { clientX: number; clientY: number }) => {
      const rect = dom.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(mouse, camera);
    };

    const hideGhost = () => {
      const ghost = ghostMeshRef.current;
      if (ghost) ghost.visible = false;
    };

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
      if (dx > 4 || dy > 4) return; // Drag, kein Klick

      const group = buildingGroupRef.current;
      const b = buildingRef.current;
      if (!group || !b) return;
      setMouseFromEvent(e);
      const hits = ray.intersectObject(group, true);
      const roofHit = hits.find(
        (h) =>
          (h.object as THREE.Mesh).isMesh &&
          h.object.userData?.kind === "roof",
      );

      if (manualPlacementRef.current) {
        if (!roofHit) return;
        const ud = roofHit.object.userData as { roofFaceId: string };
        const face = b.roofFaces.find((f) => f.id === ud.roofFaceId);
        if (!face) return;
        onPlaceRef.current(
          {
            x: roofHit.point.x,
            y: roofHit.point.y,
            z: roofHit.point.z,
          },
          face,
        );
        return;
      }

      if (!roofHit) {
        setSelectedFace(null);
        applyHighlight(null);
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
      applyHighlight(ud.roofFaceId);
    };

    const onMove = (e: PointerEvent) => {
      if (!manualPlacementRef.current) {
        hideGhost();
        return;
      }
      const group = buildingGroupRef.current;
      const b = buildingRef.current;
      const ghost = ghostMeshRef.current;
      if (!group || !b || !ghost) return;
      setMouseFromEvent(e);
      const hits = ray.intersectObject(group, true);
      const roofHit = hits.find(
        (h) =>
          (h.object as THREE.Mesh).isMesh &&
          h.object.userData?.kind === "roof",
      );
      if (!roofHit) {
        ghost.visible = false;
        return;
      }
      const ud = roofHit.object.userData as { roofFaceId: string };
      const face = b.roofFaces.find((f) => f.id === ud.roofFaceId);
      if (!face || !face.selected) {
        ghost.visible = false;
        return;
      }
      const point: Vec3 = {
        x: roofHit.point.x,
        y: roofHit.point.y,
        z: roofHit.point.z,
      };
      const settings = moduleSettingsRef.current;
      const candidate = createModuleAtFacePoint(point, face, settings);
      if (!candidate) {
        ghost.visible = false;
        return;
      }
      const result = validatePlacementAtFacePoint(point, face, b, settings);
      const positionsAttr = (ghost.geometry as THREE.BufferGeometry).getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      for (let i = 0; i < 4; i++) {
        const v = candidate.vertices3d[i]!;
        positionsAttr.setXYZ(i, v.x, v.y, v.z);
      }
      positionsAttr.needsUpdate = true;
      ghost.geometry.computeVertexNormals();
      (ghost.material as THREE.MeshBasicMaterial).color.set(
        result.ok ? 0x22c55e : 0xef4444,
      );
      ghost.visible = true;
    };

    const onLeave = () => {
      hideGhost();
    };

    const onContextMenu = (e: MouseEvent) => {
      if (!manualPlacementRef.current) return;
      e.preventDefault();
      const group = buildingGroupRef.current;
      const b = buildingRef.current;
      if (!group || !b) return;
      setMouseFromEvent(e);
      const hits = ray.intersectObject(group, true);
      const moduleHit = hits.find(
        (h) =>
          (h.object as THREE.Mesh).isMesh &&
          h.object.userData?.kind === "module",
      );
      if (moduleHit) {
        const ud = moduleHit.object.userData as { moduleId: string };
        onRemoveRef.current(ud.moduleId);
        return;
      }
      // Fallback: nearest module along raycast (greift Module, deren Mesh
      // an der Stelle nicht direkt getroffen wird).
      const roofHit = hits.find(
        (h) => (h.object as THREE.Mesh).isMesh && h.object.userData?.kind === "roof",
      );
      if (!roofHit) return;
      const point: Vec3 = {
        x: roofHit.point.x,
        y: roofHit.point.y,
        z: roofHit.point.z,
      };
      const mod = findModuleAtPoint3D(point, b.modules);
      if (mod) onRemoveRef.current(mod.id);
    };

    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerleave", onLeave);
    dom.addEventListener("contextmenu", onContextMenu);
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerleave", onLeave);
      dom.removeEventListener("contextmenu", onContextMenu);
    };
  }, []);

  /** Setzt Emissive auf dem markierten Roof-Mesh, entfernt es auf allen anderen. */
  function applyHighlight(activeId: string | null) {
    const group = buildingGroupRef.current;
    if (!group) return;
    group.traverse((obj) => {
      if (obj.userData?.kind !== "roof") return;
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat || !("emissive" in mat)) return;
      // Wir clonen das Material on-demand, damit das Highlight nicht
      // alle anderen Flächen mit demselben gemeinsamen Material mit-färbt.
      if (obj.userData.roofFaceId === activeId) {
        if (!mesh.userData.__origMat) {
          mesh.userData.__origMat = mat;
          mesh.material = mat.clone();
        }
        const m = mesh.material as THREE.MeshStandardMaterial;
        m.emissive = new THREE.Color(0x2563eb);
        m.emissiveIntensity = 0.45;
      } else if (mesh.userData.__origMat) {
        (mesh.material as THREE.Material).dispose();
        mesh.material = mesh.userData.__origMat as THREE.Material;
        delete mesh.userData.__origMat;
      }
    });
  }

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
            minWidth: 200,
            maxWidth: 260,
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
            {selectedFace.label}
          </p>
          <Row label="Fläche" value={`${selectedFace.areaM2.toFixed(1)} m²`} />
          <Row label="Neigung" value={`${selectedFace.pitchDeg.toFixed(0)}°`} />
          <Row
            label="Ausrichtung"
            value={`${selectedFace.azimuthDeg.toFixed(0)}°`}
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
          <div
            style={{
              marginTop: 4,
              height: 4,
              background: "#e2e8f0",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.min(100, (selectedFace.moduleCount / MAX_MODULES_PER_FACE) * 100)}%`,
                height: "100%",
                background:
                  selectedFace.moduleCount >= MAX_MODULES_PER_FACE
                    ? "#e11d48"
                    : "#1e50e0",
                transition: "width 200ms ease",
              }}
            />
          </div>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 10,
              color: "#94a3b8",
              userSelect: "all",
            }}
          >
            ID: {selectedFace.id}
          </p>
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
