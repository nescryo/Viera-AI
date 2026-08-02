import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MMDLoader } from 'three-stdlib';
import * as MMDParser from 'mmd-parser';
import type { Persona } from '../../types';

if (typeof window !== 'undefined') {
  (window as any).MMDParser = MMDParser;
}

interface SceneProps {
  currentPersona: Persona;
  isSpeaking: boolean;
  currentEmotion: string;
  onSelectEmotion?: (emotion: string) => void;
}

const TESTING_EMOTIONS = [
  { id: 'happy', label: '😊 Happy' },
  { id: 'blush', label: '😳 Blush' },
  { id: 'relaxed', label: '😌 Relaxed' },
  { id: 'surprised', label: '😮 Surprised' },
  { id: 'angry', label: '😠 Angry' },
  { id: 'sad', label: '😢 Sad' },
  { id: 'neutral', label: '😐 Neutral' }
];

/**
 * Creates a Soft Rose-Peach Anime Cheek Blush Texture
 */
function createSoftPorcelainCheekTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);

    const gradient = ctx.createRadialGradient(128, 128, 6, 128, 128, 118);
    gradient.addColorStop(0, 'rgba(255, 115, 135, 0.48)');
    gradient.addColorStop(0.45, 'rgba(255, 155, 170, 0.25)');
    gradient.addColorStop(0.8, 'rgba(255, 185, 195, 0.08)');
    gradient.addColorStop(1, 'rgba(255, 185, 195, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(128, 128, 118, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(230, 80, 100, 0.32)';
    ctx.lineWidth = 3.0;

    for (let x = 55; x <= 201; x += 18) {
      const heightOffset = Math.sin(((x - 55) / 146) * Math.PI) * 40;
      ctx.beginPath();
      ctx.moveTo(x, 128 - heightOffset);
      ctx.lineTo(x, 128 + heightOffset);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export const Scene: React.FC<SceneProps> = React.memo(({
  currentPersona,
  isSpeaking,
  currentEmotion,
  onSelectEmotion
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadStatus, setLoadStatus] = useState<string>("Loading Firefly 3D Model...");

  // Keep track of currentEmotion in ref to avoid re-loading 3D model on emotion changes
  const currentEmotionRef = useRef(currentEmotion);
  useEffect(() => {
    currentEmotionRef.current = currentEmotion;
  }, [currentEmotion]);

  const isSpeakingRef = useRef(isSpeaking);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // Ref to hold loaded MMD mesh, bones, cheek blush materials, and morph target dictionary
  const mmdMeshRef = useRef<THREE.SkinnedMesh | null>(null);
  const upperBodyBoneRef = useRef<THREE.Bone | null>(null);
  const neckBoneRef = useRef<THREE.Bone | null>(null);
  const headBoneRef = useRef<THREE.Bone | null>(null);
  
  const hairBonesRef = useRef<{ bone: THREE.Bone; baseRotZ: number; baseRotX: number; phase: number }[]>([]);
  const skirtBonesRef = useRef<{ bone: THREE.Bone; baseRotZ: number; baseRotX: number; phase: number }[]>([]);
  const cheekMaterialsRef = useRef<THREE.MeshBasicMaterial[]>([]);

  const blinkTimerRef = useRef<{ nextBlinkTime: number; isBlinking: boolean; blinkProgress: number }>({
    nextBlinkTime: 0,
    isBlinking: false,
    blinkProgress: 0
  });

  useEffect(() => {
    if (!containerRef.current) return;

    let isDisposed = false;
    let animationFrameId: number;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Clean container completely before initializing WebGL
    containerRef.current.innerHTML = '';

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1e1f22');

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(-0.65, 1.32, 1.35); 
    camera.lookAt(-0.65, 1.30, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.LinearToneMapping;

    containerRef.current.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(animationFrameId);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    // 2. Bright & Cheerful Anime Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.45);
    keyLight.position.set(2, 4, 3);
    scene.add(keyLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 0.35);
    frontLight.position.set(-0.65, 1.5, 4);
    scene.add(frontLight);

    // 3. Ground Pedestal & Grid
    const gridHelper = new THREE.GridHelper(10, 20, 0x52c41a, 0x2b2d31);
    gridHelper.position.set(-0.65, 0, 0);
    scene.add(gridHelper);

    // 4. Floating Firefly Particles
    const particleCount = 180;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 8 - 0.65;
      positions[i + 1] = Math.random() * 4;
      positions[i + 2] = (Math.random() - 0.5) * 8;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: new THREE.Color(currentPersona.accentColor || '#52c41a'),
      size: 0.035,
      transparent: true,
      opacity: 0.65
    });
    const particles = new THREE.Points(geometry, particleMaterial);
    scene.add(particles);

    // 5. 3D Model Root Group
    const modelGroup = new THREE.Group();
    modelGroup.position.set(-0.65, 0, 0);
    scene.add(modelGroup);

    // Pedestal Base
    const pedestalGeo = new THREE.CylinderGeometry(0.8, 0.9, 0.08, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x2b2d31,
      roughness: 0.5,
      metalness: 0.6
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = 0.04;
    modelGroup.add(pedestal);

    // 6. Load Firefly .pmx Model
    const mmdLoader = new MMDLoader();
    const pmxUrl = '/models/firefly/firefly.pmx';
    const softPorcelainCheekTex = createSoftPorcelainCheekTexture();

    mmdLoader.load(
      pmxUrl,
      (mmdMesh: THREE.SkinnedMesh) => {
        if (isDisposed) return;

        mmdMeshRef.current = mmdMesh;
        cheekMaterialsRef.current = [];
        hairBonesRef.current = [];
        skirtBonesRef.current = [];
        
        mmdMesh.castShadow = false;
        mmdMesh.receiveShadow = false;

        // Auto-scale MMD model to standard human height
        const bbox = new THREE.Box3().setFromObject(mmdMesh);
        const size = bbox.getSize(new THREE.Vector3());
        
        if (size.y > 0) {
          const scaleFactor = 1.65 / size.y;
          mmdMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
        }

        // Setup Bones & Natural Arm Resting Pose
        let headBone: THREE.Bone | null = null;

        if (mmdMesh.skeleton && mmdMesh.skeleton.bones) {
          mmdMesh.skeleton.bones.forEach((bone, index) => {
            const name = bone.name;
            if (name === '左腕') {
              bone.rotation.z = -THREE.MathUtils.degToRad(46);
            } else if (name === '右腕') {
              bone.rotation.z = THREE.MathUtils.degToRad(46);
            } else if (name === '上半身' || name === '上半身2' || name === '胸') {
              upperBodyBoneRef.current = bone;
            } else if (name === '首') {
              neckBoneRef.current = bone;
            } else if (name === '頭' || name === 'head') {
              headBone = bone;
              headBoneRef.current = bone;
            }

            if (name.includes('髪') || name.includes('毛') || name.includes('hair') || name.includes('ツインテ') || name.includes('リボン')) {
              hairBonesRef.current.push({
                bone,
                baseRotZ: bone.rotation.z,
                baseRotX: bone.rotation.x,
                phase: index * 0.4
              });
            }

            // Identify Skirt Bones for Secondary Motion Physics (including 裾 prefix)
            if (name.includes('スカート') || name.includes('skirt') || name.includes('裾')) {
              skirtBonesRef.current.push({
                bone,
                baseRotZ: bone.rotation.z,
                baseRotX: bone.rotation.x,
                phase: index * 0.3
              });
            }
          });

          mmdMesh.skeleton.update();
        }

        // Clean and optimize materials
        mmdMesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = false;
            mesh.receiveShadow = false;

            const optimizeMaterial = (mat: THREE.Material) => {
              if ('color' in mat && mat.color) {
                (mat as any).color.setHex(0xffffff);
              }
              if ('emissive' in mat && (mat as any).emissive) {
                (mat as any).emissive.setHex(0x000000);
              }
              if ('roughness' in mat) {
                (mat as any).roughness = 0.8;
              }
              mat.needsUpdate = true;
              return mat;
            };

            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => optimizeMaterial(m));
            } else if (mesh.material) {
              optimizeMaterial(mesh.material);
            }
          }
        });

        // Create 2 Soft Porcelain Cheek Decals
        const createCheekMesh = (xPos: number) => {
          const mat = new THREE.MeshBasicMaterial({
            map: softPorcelainCheekTex,
            transparent: true,
            opacity: 0,
            depthTest: false,
            side: THREE.DoubleSide
          });
          cheekMaterialsRef.current.push(mat);
          const geo = new THREE.PlaneGeometry(0.68, 0.50);
          const mesh = new THREE.Mesh(geo, mat);
          
          mesh.position.set(xPos, 0.35, 0.72);
          mesh.rotation.y = xPos > 0 ? -0.26 : 0.26;
          mesh.rotation.x = -0.06;
          return mesh;
        };

        const leftCheek = createCheekMesh(-0.58);
        const rightCheek = createCheekMesh(0.58);

        if (headBone) {
          (headBone as THREE.Bone).add(leftCheek);
          (headBone as THREE.Bone).add(rightCheek);
        } else {
          modelGroup.add(leftCheek);
          modelGroup.add(rightCheek);
        }

        modelGroup.add(mmdMesh);
        setModelLoaded(true);
        setLoadStatus("Firefly 3D Active");
      },
      (xhr: ProgressEvent) => {
        if (xhr.lengthComputable && !isDisposed) {
          const percent = ((xhr.loaded / xhr.total) * 100).toFixed(0);
          setLoadStatus(`Loading Firefly 3D Model (${percent}%)`);
        }
      },
      (error: unknown) => {
        if (isDisposed) return;
        console.error("PMX Load error:", error);
        
        const cardGeo = new THREE.PlaneGeometry(0.95, 1.45);
        const textureLoader = new THREE.TextureLoader();
        const avatarTex = textureLoader.load(currentPersona.avatarUrl);
        const cardMat = new THREE.MeshStandardMaterial({
          map: avatarTex,
          side: THREE.DoubleSide,
          transparent: true,
          roughness: 0.2
        });
        const avatarCard = new THREE.Mesh(cardGeo, cardMat);
        avatarCard.position.y = 1.15;
        modelGroup.add(avatarCard);

        setModelLoaded(true);
        setLoadStatus("Firefly 3D (Fallback Avatar Active)");
      }
    );

    // 7. Mouse & Touch Pointer Tracking
    const handlePointerMove = (clientX: number, clientY: number) => {
      if (isDisposed) return;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      pointerRef.current.targetX = (clientX / windowWidth) * 2 - 1;
      pointerRef.current.targetY = -(clientY / windowHeight) * 2 + 1;
    };

    const onMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove);

    // 8. High-Performance Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      if (isDisposed) return;
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      
      // Normalize & Map Emotion Tags cleanly
      const rawEmo = (currentEmotionRef.current || 'neutral').toLowerCase().trim();
      let emo = rawEmo;
      if (rawEmo === 'smirk' || rawEmo === 'excited') emo = 'happy';
      else if (rawEmo === 'determined') emo = 'angry';
      else if (rawEmo === 'shy' || rawEmo === 'embarrassed') emo = 'blush';
      else if (rawEmo === 'calm' || rawEmo === 'peaceful') emo = 'relaxed';
      else if (rawEmo === 'shocked') emo = 'surprised';

      pointerRef.current.x += (pointerRef.current.targetX - pointerRef.current.x) * 0.05;
      pointerRef.current.y += (pointerRef.current.targetY - pointerRef.current.y) * 0.05;

      const pX = pointerRef.current.x;
      const pY = pointerRef.current.y;

      modelGroup.rotation.y = 0;
      modelGroup.rotation.x = 0;

      const targetTorsoYaw = pX * 0.18;
      const targetTorsoPitch = -pY * 0.08;

      const targetHeadYaw = pX * 0.32;
      const targetHeadPitch = -pY * 0.16;

      const breathPhase = Math.sin(elapsedTime * 2.2);
      modelGroup.position.y = breathPhase * 0.003; 

      if (upperBodyBoneRef.current) {
        upperBodyBoneRef.current.rotation.y += (targetTorsoYaw - upperBodyBoneRef.current.rotation.y) * 0.1;
        upperBodyBoneRef.current.rotation.x = (breathPhase * 0.015) + (targetTorsoPitch * 0.5);
      }

      if (neckBoneRef.current) {
        neckBoneRef.current.rotation.y += ((targetHeadYaw * 0.5) - neckBoneRef.current.rotation.y) * 0.1;
        neckBoneRef.current.rotation.x = (-breathPhase * 0.008) + (targetHeadPitch * 0.5);
      }

      if (headBoneRef.current) {
        headBoneRef.current.rotation.y += ((targetHeadYaw * 0.5) - headBoneRef.current.rotation.y) * 0.1;
        headBoneRef.current.rotation.x += ((targetHeadPitch * 0.5) - headBoneRef.current.rotation.x) * 0.1;
      }

      hairBonesRef.current.forEach(({ bone, baseRotZ, baseRotX, phase }) => {
        const hairSwayZ = Math.sin(elapsedTime * 2.5 + phase) * 0.04 + (targetHeadYaw * 0.12);
        const hairSwayX = Math.cos(elapsedTime * 2.0 + phase) * 0.025 + (targetHeadPitch * 0.08);
        
        bone.rotation.z = baseRotZ + hairSwayZ;
        bone.rotation.x = baseRotX + hairSwayX;
      });

      skirtBonesRef.current.forEach(({ bone, baseRotZ, baseRotX, phase }) => {
        const skirtSwayZ = Math.sin(elapsedTime * 2.2 + phase) * 0.015;
        const skirtSwayX = Math.cos(elapsedTime * 1.8 + phase) * 0.010;

        bone.rotation.z = baseRotZ + skirtSwayZ;
        bone.rotation.x = baseRotX + skirtSwayX;
      });

      particles.rotation.y = elapsedTime * 0.04;

      // AUTOMATIC EYE BLINKING ENGINE
      if (mmdMeshRef.current && mmdMeshRef.current.morphTargetDictionary && mmdMeshRef.current.morphTargetInfluences) {
        const dict = mmdMeshRef.current.morphTargetDictionary;
        const influences = mmdMeshRef.current.morphTargetInfluences;

        const getMorphIdx = (name: string) => dict[name];

        const blinkIndex = getMorphIdx('まばたき') ?? getMorphIdx('blink') ?? getMorphIdx('まばたき鏡');

        if (blinkIndex !== undefined) {
          if (elapsedTime > blinkTimerRef.current.nextBlinkTime && !blinkTimerRef.current.isBlinking) {
            blinkTimerRef.current.isBlinking = true;
            blinkTimerRef.current.blinkProgress = 0;
          }

          if (blinkTimerRef.current.isBlinking) {
            blinkTimerRef.current.blinkProgress += 0.08;
            const blinkWeight = Math.sin(blinkTimerRef.current.blinkProgress * Math.PI);
            influences[blinkIndex] = Math.max(0, blinkWeight);

            if (blinkTimerRef.current.blinkProgress >= 1.0) {
              blinkTimerRef.current.isBlinking = false;
              influences[blinkIndex] = 0;
              blinkTimerRef.current.nextBlinkTime = elapsedTime + 3.5 + Math.random() * 2.0;
            }
          }
        }

        // MMD Vowel Morph Target Lookups
        const morphVowelA  = getMorphIdx('あ');
        const morphVowelI  = getMorphIdx('い');
        const morphVowelU  = getMorphIdx('う');
        const morphVowelE  = getMorphIdx('え');
        const morphVowelO  = getMorphIdx('お');

        const morphSmileMouth = getMorphIdx('口角上げ');
        const morphSmallMouth = getMorphIdx('ん') ?? getMorphIdx('へ');
        const morphFrownMouth = getMorphIdx('口角下げ') ?? getMorphIdx('▲') ?? getMorphIdx('△');

        const morphRelaxedEye  = getMorphIdx('じと目') ?? getMorphIdx('笑い');
        const morphRelaxedEyebrow = getMorphIdx('にこり') ?? getMorphIdx('下');

        const morphAngryEyebrow = getMorphIdx('怒り') ?? getMorphIdx('真面目');
        const morphAngryEye     = getMorphIdx('じと目') ?? getMorphIdx('怒り');

        const morphSadEyebrow   = getMorphIdx('困る') ?? getMorphIdx('悲しい');
        const morphSadEye       = getMorphIdx('じと目');

        const morphSurprisedEye = getMorphIdx('びっくり') ?? getMorphIdx('目大');
        const morphSurprisedEyebrow = getMorphIdx('上');

        let targetSmileMouth = 0;
        let targetSmallMouth = 0;
        let targetFrownMouth = 0;

        let targetVowelA = 0;
        let targetVowelI = 0;
        let targetVowelU = 0;
        let targetVowelE = 0;
        let targetVowelO = 0;

        let targetRelaxedEye = 0;
        let targetRelaxedEyebrow = 0;
        let targetAngryEyebrow = 0;
        let targetAngryEye = 0;
        let targetSadEyebrow = 0;
        let targetSadEye = 0;
        let targetSurprisedEye = 0;
        let targetSurprisedEyebrow = 0;

        if (emo === 'happy') {
          targetSmileMouth = 0.55;
          targetVowelA = 0.32; // Firefly signature cute open-mouth smile :D
          targetRelaxedEyebrow = 0.25;
        } else if (emo === 'blush') {
          targetSmallMouth = 0.45;
          targetSadEyebrow = 0.35;
        } else if (emo === 'relaxed') {
          targetSmileMouth = 0.35;
          targetRelaxedEyebrow = 0.45;
          targetRelaxedEye = 0.15;
        } else if (emo === 'surprised') {
          targetSurprisedEye = 0.85;
          targetSurprisedEyebrow = 0.75;
          targetVowelO = 0.55;
        } else if (emo === 'angry') {
          targetAngryEyebrow = 0.95;
          targetAngryEye = 0.55;
          targetFrownMouth = 0.85;
          targetSmallMouth = 0.45;
        } else if (emo === 'sad') {
          targetSadEyebrow = 0.85;
          targetSadEye = 0.45;
          targetFrownMouth = 0.75;
          targetSmallMouth = 0.35;
        }

        // Clearly Visible & Rhythmic Anime Lip-Sync Mouth Flap (0.00 Closed -> 0.52 Open)
        if (isSpeakingRef.current) {
          // Maintain cute smile base
          targetSmileMouth = 0.35;

          // Fluctuate cleanly between 0.00 (fully closed) and 0.52 (open) so mouth opening/closing is 100% visible
          const rawWave = Math.sin(elapsedTime * 14.0);
          const mouthOpenWave = Math.pow(Math.abs(rawWave), 1.2);

          targetVowelA = mouthOpenWave * 0.52; // 0.00 -> 0.52 -> 0.00 (clearly visible rhythm!)
          targetVowelI = Math.abs(Math.cos(elapsedTime * 10.0)) * 0.15;
          targetVowelE = Math.abs(Math.sin(elapsedTime * 12.0)) * 0.10;
        }

        // Smoothly fade soft rose-peach cheekbone blush
        const targetCheekOpacity = emo === 'blush' ? 0.65 : 0;
        cheekMaterialsRef.current.forEach((mat) => {
          mat.opacity += (targetCheekOpacity - mat.opacity) * 0.15;
        });

        // Dynamic Map-based Morph Lerp (Prevents alias collision skips for shared indices like じと目)
        const targetMap = new Map<number, number>();
        const setMorphTarget = (idx: number | undefined, val: number) => {
          if (idx === undefined) return;
          const curr = targetMap.get(idx) ?? 0;
          targetMap.set(idx, Math.max(curr, val));
        };

        setMorphTarget(morphVowelA, targetVowelA);
        setMorphTarget(morphVowelI, targetVowelI);
        setMorphTarget(morphVowelU, targetVowelU);
        setMorphTarget(morphVowelE, targetVowelE);
        setMorphTarget(morphVowelO, targetVowelO);

        setMorphTarget(morphSmileMouth, targetSmileMouth);
        setMorphTarget(morphSmallMouth, targetSmallMouth);
        setMorphTarget(morphFrownMouth, targetFrownMouth);

        setMorphTarget(morphRelaxedEye, targetRelaxedEye);
        setMorphTarget(morphRelaxedEyebrow, targetRelaxedEyebrow);

        setMorphTarget(morphSurprisedEye, targetSurprisedEye);
        setMorphTarget(morphSurprisedEyebrow, targetSurprisedEyebrow);

        setMorphTarget(morphAngryEyebrow, targetAngryEyebrow);
        setMorphTarget(morphAngryEye, targetAngryEye);

        setMorphTarget(morphSadEyebrow, targetSadEyebrow);
        setMorphTarget(morphSadEye, targetSadEye);

        targetMap.forEach((targetVal, idx) => {
          influences[idx] += (targetVal - influences[idx]) * 0.15;
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current || isDisposed) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      softPorcelainCheekTex.dispose();

      scene.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat) => mat.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        }
      });
      renderer.dispose();

      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [currentPersona]);

  return (
    <div className="scene-container">
      <div ref={containerRef} className="three-canvas-container" />
      
      <div className="scene-status-overlay">
        <span className="live-vrm-badge">
          <span className="pulse-dot" /> 
          {modelLoaded ? `3D Viewport • ${loadStatus}` : loadStatus}
        </span>
        <span className="current-emotion-badge">
          Expression: {currentEmotion || 'Neutral'}
        </span>

        {/* Temporary Emotion Testing Chips */}
        <div className="testing-emotions-bar">
          <span className="testing-label">Test Expression:</span>
          {TESTING_EMOTIONS.map((emo) => (
            <button
              key={emo.id}
              className={`emotion-test-btn ${currentEmotion === emo.id ? 'active' : ''}`}
              onClick={() => onSelectEmotion?.(emo.id)}
            >
              {emo.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
