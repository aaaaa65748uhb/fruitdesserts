"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { BoxSpec } from "./layout";

/** Renders many static boxes as a single InstancedMesh (one draw call per material). */
export function InstancedBoxes({
  boxes,
  material,
}: {
  boxes: BoxSpec[];
  material: THREE.Material;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    boxes.forEach((b, i) => {
      m.compose(new THREE.Vector3(...b.pos), q, new THREE.Vector3(...b.size));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(b.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [boxes]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  if (!boxes.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, boxes.length]} frustumCulled={false} />;
}
