import * as THREE from 'three';
import { WEAPON_SKINS } from '../data/weapons';
import { Faction, GrenadeId, SkinId, WeaponId } from '../types/game';

/**
 * Builds a multi-part composite 3D weapon group (6-11 parts) with realistic PBR
 * roughness/metalness contrast and dynamic skin finish.
 * Oriented pointing along -Z (forward in FPS camera space).
 */
export function buildWeaponModel(weaponId: WeaponId, skinId: SkinId, includeHands = false): THREE.Group {
  const root = new THREE.Group();
  const skin = WEAPON_SKINS[skinId];

  const primaryMat = new THREE.MeshStandardMaterial({
    color: skin.primaryHex,
    metalness: skin.metalness,
    roughness: skin.roughness,
  });

  const secondaryMat = new THREE.MeshStandardMaterial({
    color: skin.secondaryHex,
    metalness: Math.max(0.1, skin.metalness - 0.35),
    roughness: Math.min(0.9, skin.roughness + 0.3),
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1e242d,
    metalness: 0.88,
    roughness: 0.24,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: skin.accentHex,
    metalness: 0.55,
    roughness: 0.3,
  });

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    rx = 0
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    if (rx !== 0) mesh.rotation.x = rx;
    mesh.castShadow = true;
    root.add(mesh);
    return mesh;
  };

  const addCyl = (
    rt: number,
    rb: number,
    len: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    rx = Math.PI / 2,
    seg = 12
  ) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, len, seg), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    mesh.castShadow = true;
    root.add(mesh);
    return mesh;
  };

  if (weaponId === WeaponId.AK47) {
    // Receiver
    addBox(0.062, 0.082, 0.34, 0, 0, 0.02, primaryMat);
    // Dust cover rib
    addBox(0.056, 0.026, 0.28, 0, 0.048, 0.03, darkSteelMat);
    // Handguard
    addBox(0.058, 0.068, 0.24, 0, 0.004, -0.27, secondaryMat);
    // Gas tube
    addCyl(0.012, 0.012, 0.25, 0, 0.044, -0.28, darkSteelMat);
    // Barrel & muzzle brake
    addCyl(0.011, 0.013, 0.38, 0, 0.018, -0.48, darkSteelMat);
    addCyl(0.017, 0.017, 0.055, 0, 0.018, -0.68, accentMat);
    // Front sight post
    addBox(0.014, 0.045, 0.024, 0, 0.044, -0.58, darkSteelMat);
    // Curved-feel angled banana magazine (2-segment)
    addBox(0.034, 0.14, 0.072, 0, -0.1, -0.09, accentMat, -0.22);
    addBox(0.032, 0.11, 0.066, 0, -0.2, -0.125, primaryMat, -0.45);
    // Pistol grip
    addBox(0.036, 0.11, 0.045, 0, -0.08, 0.11, secondaryMat, 0.28);
    // Buttstock
    addBox(0.048, 0.095, 0.24, 0, -0.018, 0.29, secondaryMat, 0.08);
    // Charging handle
    addBox(0.036, 0.016, 0.022, 0.042, 0.022, -0.03, darkSteelMat);
  } else if (weaponId === WeaponId.M4A1S) {
    // Upper + lower receiver
    addBox(0.058, 0.084, 0.32, 0, 0, 0.02, primaryMat);
    // Picatinny top rail
    addBox(0.034, 0.016, 0.44, 0, 0.05, -0.08, darkSteelMat);
    // Holo/red-dot sight housing + glowing reticle glass
    addBox(0.044, 0.042, 0.075, 0, 0.075, 0.02, darkSteelMat);
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.6,
    });
    addBox(0.032, 0.024, 0.008, 0, 0.076, 0.02, lensMat);
    // Quad-rail handguard
    addBox(0.056, 0.062, 0.28, 0, 0.01, -0.28, secondaryMat);
    // Barrel + signature suppressor
    addCyl(0.011, 0.011, 0.16, 0, 0.016, -0.48, darkSteelMat);
    addCyl(0.024, 0.024, 0.24, 0, 0.016, -0.66, accentMat, Math.PI / 2, 16);
    // Straight 25rd mag
    addBox(0.032, 0.16, 0.064, 0, -0.11, -0.08, darkSteelMat, -0.08);
    // Grip & collapsible stock
    addBox(0.034, 0.105, 0.044, 0, -0.08, 0.11, secondaryMat, 0.28);
    addCyl(0.018, 0.018, 0.22, 0, 0.01, 0.28, darkSteelMat);
    addBox(0.044, 0.11, 0.11, 0, -0.01, 0.36, primaryMat);
  } else if (weaponId === WeaponId.AWP) {
    // Sniper chassis
    addBox(0.064, 0.088, 0.48, 0, -0.005, -0.04, primaryMat);
    // Heavy fluted barrel & muzzle brake
    addCyl(0.015, 0.019, 0.64, 0, 0.024, -0.56, darkSteelMat);
    addBox(0.042, 0.034, 0.065, 0, 0.024, -0.89, accentMat);
    // High-power scope mount + tube + objective bell + optic glass
    addBox(0.024, 0.038, 0.03, 0, 0.056, -0.06, darkSteelMat);
    addBox(0.024, 0.038, 0.03, 0, 0.056, 0.09, darkSteelMat);
    addCyl(0.022, 0.022, 0.28, 0, 0.088, -0.01, darkSteelMat, Math.PI / 2, 16);
    addCyl(0.032, 0.023, 0.085, 0, 0.088, -0.17, accentMat, Math.PI / 2, 16);
    const opticMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      metalness: 0.1,
      roughness: 0.05,
      clearcoat: 1.0,
    });
    addCyl(0.028, 0.028, 0.008, 0, 0.088, -0.21, opticMat, Math.PI / 2, 16);
    // Bolt knob
    addBox(0.042, 0.014, 0.014, 0.045, 0.024, 0.06, darkSteelMat);
    // Thumbhole stock & bipod folded
    addBox(0.05, 0.095, 0.28, 0, -0.02, 0.31, secondaryMat);
    addBox(0.036, 0.08, 0.07, 0, -0.075, -0.04, darkSteelMat);
    addCyl(0.008, 0.008, 0.18, -0.028, -0.045, -0.36, darkSteelMat);
    addCyl(0.008, 0.008, 0.18, 0.028, -0.045, -0.36, darkSteelMat);
  } else if (weaponId === WeaponId.DEAGLE) {
    // Heavy Desert Eagle slide & frame
    addBox(0.044, 0.054, 0.28, 0, 0.02, -0.05, primaryMat);
    addBox(0.038, 0.032, 0.22, 0, -0.02, -0.02, secondaryMat);
    // Ribbed barrel tip
    addBox(0.034, 0.042, 0.06, 0, 0.024, -0.21, accentMat);
    // Sights
    addBox(0.016, 0.014, 0.014, 0, 0.054, 0.065, accentMat);
    addBox(0.008, 0.014, 0.014, 0, 0.054, -0.17, accentMat);
    // Chunky grip
    addBox(0.038, 0.125, 0.056, 0, -0.085, 0.06, secondaryMat, 0.24);
  } else if (weaponId === WeaponId.USPS) {
    // Slide & frame
    addBox(0.034, 0.044, 0.21, 0, 0.02, -0.02, primaryMat);
    addBox(0.032, 0.026, 0.19, 0, -0.012, -0.01, secondaryMat);
    // Signature suppressor
    addCyl(0.018, 0.018, 0.18, 0, 0.018, -0.21, accentMat, Math.PI / 2, 14);
    // Grip & baseplate
    addBox(0.032, 0.11, 0.048, 0, -0.075, 0.055, secondaryMat, 0.22);
    addBox(0.034, 0.014, 0.054, 0, -0.132, 0.07, darkSteelMat);
  } else {
    // Karambit / Tactical Knife
    addBox(0.022, 0.032, 0.13, 0, 0, 0.04, secondaryMat, -0.15);
    // Finger ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 16), accentMat);
    ring.position.set(0, -0.012, 0.12);
    ring.rotation.y = Math.PI / 2;
    root.add(ring);
    // Curved tactical blade
    addBox(0.007, 0.034, 0.17, 0, 0.01, -0.1, primaryMat, 0.12);
    addBox(0.005, 0.024, 0.09, 0, 0.022, -0.2, accentMat, 0.34);
  }

  // Optional tactical gloved arms for 1st-person viewmodel
  if (includeHands) {
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85, metalness: 0.05 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7, metalness: 0.1 });

    // Right trigger hand + forearm
    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.32), sleeveMat);
    rArm.position.set(0.07, -0.12, 0.26);
    rArm.rotation.set(0.28, -0.24, 0);
    root.add(rArm);

    const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.072, 0.09), gloveMat);
    rGlove.position.set(0.01, -0.075, 0.11);
    root.add(rGlove);

    if (weaponId !== WeaponId.KNIFE) {
      // Support left arm
      const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.072, 0.36), sleeveMat);
      lArm.position.set(-0.12, -0.11, -0.03);
      lArm.rotation.set(0.25, 0.42, 0);
      root.add(lArm);

      const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.062, 0.09), gloveMat);
      lGlove.position.set(-0.015, -0.035, -0.2);
      root.add(lGlove);
    }
  }

  return root;
}

/**
 * Builds a composite multi-part 3D tactical grenade (HE, Flashbang, or Smoke)
 * for both 1st-person viewmodel and live physics projectile.
 */
export function buildGrenadeModel(grenadeId: GrenadeId, includeHands = false): THREE.Group {
  const root = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.85,
    roughness: 0.28,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    metalness: 0.9,
    roughness: 0.22,
  });

  if (grenadeId === GrenadeId.HE) {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x3f4f32,
      metalness: 0.35,
      roughness: 0.65,
    });
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.4,
      roughness: 0.4,
    });

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 12), bodyMat);
    core.scale.set(0.88, 1.18, 0.88);
    core.castShadow = true;
    root.add(core);

    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.053, 0.053, 0.018, 14), bandMat);
    band.position.y = 0.012;
    root.add(band);

    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.005, 6, 14), steelMat);
    rib.rotation.x = Math.PI / 2;
    rib.position.y = -0.018;
    root.add(rib);
  } else if (grenadeId === GrenadeId.FLASH) {
    const canisterMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.78,
      roughness: 0.25,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.45,
      roughness: 0.35,
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.125, 14), canisterMat);
    body.castShadow = true;
    root.add(body);

    const stripeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.0435, 0.0435, 0.02, 14), stripeMat);
    stripeTop.position.y = 0.03;
    root.add(stripeTop);

    const stripeBot = new THREE.Mesh(new THREE.CylinderGeometry(0.0435, 0.0435, 0.02, 14), stripeMat);
    stripeBot.position.y = -0.03;
    root.add(stripeBot);

    const capBot = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.016, 8), steelMat);
    capBot.position.y = -0.065;
    root.add(capBot);
  } else {
    // Smoke ("Dimka") canister
    const smokeBodyMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.35,
      roughness: 0.72,
    });
    const greenBandMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      metalness: 0.35,
      roughness: 0.45,
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.145, 14), smokeBodyMat);
    body.castShadow = true;
    root.add(body);

    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0475, 0.0475, 0.036, 14), greenBandMat);
    band.position.y = 0.015;
    root.add(band);

    const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.016, 14), steelMat);
    baseRing.position.y = -0.068;
    root.add(baseRing);
  }

  // Fuse head, safety lever/spoon, and pull ring (shared across all 3 grenades)
  const fuseHead = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.032, 10), steelMat);
  fuseHead.position.y = 0.078;
  root.add(fuseHead);

  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.088, 0.014), steelMat);
  lever.position.set(0.032, 0.04, 0);
  lever.rotation.z = -0.22;
  root.add(lever);

  const pinRing = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0035, 6, 14), brassMat);
  pinRing.position.set(-0.026, 0.084, 0.01);
  pinRing.rotation.y = Math.PI / 4;
  root.add(pinRing);

  if (includeHands) {
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85, metalness: 0.05 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7, metalness: 0.1 });

    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.072, 0.28), sleeveMat);
    rArm.position.set(0.05, -0.14, 0.17);
    rArm.rotation.set(0.45, -0.22, 0);
    root.add(rArm);

    const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.068, 0.085), gloveMat);
    rGlove.position.set(0.005, -0.02, 0.025);
    root.add(rGlove);
  }

  return root;
}

export interface OperatorRig {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  upperBody: THREE.Group;
  headMesh: THREE.Mesh;
  bodyHitMeshes: THREE.Object3D[];
}

/**
 * Builds an articulated 10-part tactical operator rig grounded at y = 0 (bottom-center pivot).
 * Includes distinct head & body hitzones for CS2 headshot vs bodyshot mechanics.
 */
export function buildOperatorModel(faction: Faction, botIndex = 0): OperatorRig {
  const group = new THREE.Group();
  const isCT = faction === Faction.CT;

  const uniformMat = new THREE.MeshStandardMaterial({
    color: isCT ? 0x1e3a5f : 0x4b4232,
    roughness: 0.85,
    metalness: 0.05,
  });
  const vestMat = new THREE.MeshStandardMaterial({
    color: isCT ? 0x0f172a : 0x364532,
    roughness: 0.65,
    metalness: 0.18,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd9a786,
    roughness: 0.75,
    metalness: 0.02,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.78,
    metalness: 0.1,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: isCT ? 0x38bdf8 : 0xf59e0b,
    roughness: 0.3,
    metalness: 0.7,
  });

  const bodyHitMeshes: THREE.Object3D[] = [];

  // Legs (grounded at y = 0)
  const legGeo = new THREE.BoxGeometry(0.22, 0.78, 0.24);
  const leftLeg = new THREE.Mesh(legGeo, uniformMat);
  leftLeg.position.set(-0.15, 0.42, 0);
  leftLeg.castShadow = true;
  leftLeg.userData = { hitZone: 'body', botIndex };
  group.add(leftLeg);
  bodyHitMeshes.push(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, uniformMat);
  rightLeg.position.set(0.15, 0.42, 0);
  rightLeg.castShadow = true;
  rightLeg.userData = { hitZone: 'body', botIndex };
  group.add(rightLeg);
  bodyHitMeshes.push(rightLeg);

  // Boots
  const bootGeo = new THREE.BoxGeometry(0.24, 0.14, 0.32);
  const lBoot = new THREE.Mesh(bootGeo, bootMat);
  lBoot.position.set(0, -0.35, 0.04);
  leftLeg.add(lBoot);
  const rBoot = new THREE.Mesh(bootGeo, bootMat);
  rBoot.position.set(0, -0.35, 0.04);
  rightLeg.add(rBoot);

  // Upper body group
  const upperBody = new THREE.Group();
  upperBody.position.set(0, 0.82, 0);
  group.add(upperBody);

  // Torso + Tactical Kevlar Vest
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.62, 0.3), vestMat);
  torso.position.set(0, 0.31, 0);
  torso.castShadow = true;
  torso.userData = { hitZone: 'body', botIndex };
  upperBody.add(torso);
  bodyHitMeshes.push(torso);

  // Chest pouch & faction patch
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.07), uniformMat);
  pouch.position.set(0, 0.24, 0.17);
  pouch.userData = { hitZone: 'body', botIndex };
  upperBody.add(pouch);

  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.02), accentMat);
  badge.position.set(0.14, 0.48, 0.16);
  upperBody.add(badge);

  // Shoulders & Arms holding rifle
  const armGeo = new THREE.BoxGeometry(0.17, 0.52, 0.18);
  const leftArm = new THREE.Mesh(armGeo, uniformMat);
  leftArm.position.set(-0.34, 0.38, 0.14);
  leftArm.rotation.set(-Math.PI / 3, 0, 0.12);
  leftArm.castShadow = true;
  leftArm.userData = { hitZone: 'body', botIndex };
  upperBody.add(leftArm);
  bodyHitMeshes.push(leftArm);

  const rightArm = new THREE.Mesh(armGeo, uniformMat);
  rightArm.position.set(0.34, 0.38, 0.14);
  rightArm.rotation.set(-Math.PI / 3, 0, -0.12);
  rightArm.castShadow = true;
  rightArm.userData = { hitZone: 'body', botIndex };
  upperBody.add(rightArm);
  bodyHitMeshes.push(rightArm);

  // Bot weapon in hands (pointing +Z in operator local space)
  const botGun = buildWeaponModel(isCT ? WeaponId.M4A1S : WeaponId.AK47, SkinId.STANDARD, false);
  botGun.scale.setScalar(0.85);
  botGun.rotation.y = Math.PI; // flip -Z to +Z
  botGun.position.set(0.14, 0.36, 0.38);
  upperBody.add(botGun);

  // Head + Helmet / Tactical Gear (Headshot Hitbox!)
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skinMat);
  headMesh.position.set(0, 0.8, 0);
  headMesh.castShadow = true;
  headMesh.userData = { hitZone: 'head', botIndex };
  upperBody.add(headMesh);

  if (isCT) {
    // Kevlar helmet + visor
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.18, 0.33), vestMat);
    helmet.position.set(0, 0.1, -0.01);
    helmet.userData = { hitZone: 'head', botIndex };
    headMesh.add(helmet);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.06), accentMat);
    visor.position.set(0, 0.03, 0.15);
    visor.userData = { hitZone: 'head', botIndex };
    headMesh.add(visor);
  } else {
    // Tactical scarf + sunglasses
    const scarf = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.14, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xc2a378, roughness: 0.9 })
    );
    scarf.position.set(0, -0.1, 0);
    scarf.userData = { hitZone: 'head', botIndex };
    headMesh.add(scarf);

    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.065, 0.05), bootMat);
    shades.position.set(0, 0.04, 0.14);
    shades.userData = { hitZone: 'head', botIndex };
    headMesh.add(shades);
  }

  return {
    group,
    leftLeg,
    rightLeg,
    upperBody,
    headMesh,
    bodyHitMeshes,
  };
}
