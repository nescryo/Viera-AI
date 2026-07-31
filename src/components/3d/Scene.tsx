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
}

export const Scene: React.FC<SceneProps> = ({
  currentPersona,
  currentEmotion
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadStatus, setLoadStatus] = useState<string>("Loading Firefly 3D Model...");

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene & Camera Setup (Maintained exact positioning: X: -0.65, Z: 1.35)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1e1f22');

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(-0.65, 1.32, 1.35); 
    camera.lookAt(-0.65, 1.30, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // 2. Anime & Firefly Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(2, 4, 3);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(
      new THREE.Color(currentPersona.accentColor || '#52c41a'), 
      2.0
    );
    rimLight.position.set(-3, 3, -2);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x70d6ff, 0.6);
    fillLight.position.set(0, -2, 2);
    scene.add(fillLight);

    // 3. Ground Pedestal & Grid
    const gridHelper = new THREE.GridHelper(10, 20, 0x52c41a, 0x2b2d31);
    gridHelper.position.set(-0.65, 0, 0);
    scene.add(gridHelper);

    // 4. Floating Particles
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
      roughness: 0.3,
      metalness: 0.8
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = 0.04;
    modelGroup.add(pedestal);

    // 6. Load Firefly .pmx Model & Apply Arm Rest Pose (Lower Arms smoothly)
    const mmdLoader = new MMDLoader();
    const pmxUrl = '/models/firefly/firefly.pmx';

    mmdLoader.load(
      pmxUrl,
      (mmdMesh: THREE.SkinnedMesh) => {
        console.log("Loaded Firefly PMX 3D Model!", mmdMesh);
        
        mmdMesh.castShadow = true;
        mmdMesh.receiveShadow = true;

        // Auto-scale MMD model to standard human height
        const bbox = new THREE.Box3().setFromObject(mmdMesh);
        const size = bbox.getSize(new THREE.Vector3());
        
        if (size.y > 0) {
          const scaleFactor = 1.65 / size.y;
          mmdMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
        }

        // Apply Natural Arm Resting Pose (Lower upper arms smoothly without twisting mesh)
        if (mmdMesh.skeleton && mmdMesh.skeleton.bones) {
          mmdMesh.skeleton.bones.forEach((bone) => {
            const name = bone.name;
            // Target upper arm bones only: 左腕 (Left Arm) & 右腕 (Right Arm)
            if (name === '左腕') {
              bone.rotation.z = -THREE.MathUtils.degToRad(46);
            } else if (name === '右腕') {
              bone.rotation.z = THREE.MathUtils.degToRad(46);
            }
          });

          mmdMesh.skeleton.update();
        }

        modelGroup.add(mmdMesh);
        setModelLoaded(true);
        setLoadStatus("Firefly 3D (Resting Pose)");
      },
      (xhr: ProgressEvent) => {
        if (xhr.lengthComputable) {
          const percent = ((xhr.loaded / xhr.total) * 100).toFixed(0);
          setLoadStatus(`Loading Firefly 3D Model (${percent}%)`);
        }
      },
      (error: unknown) => {
        console.error("PMX Load error:", error);
        
        // Fix Codex PR Review feedback: Render a properly scaled fallback avatar card if PMX fails
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

    // 8. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth pointer tracking
      pointerRef.current.x += (pointerRef.current.targetX - pointerRef.current.x) * 0.05;
      pointerRef.current.y += (pointerRef.current.targetY - pointerRef.current.y) * 0.05;

      modelGroup.rotation.y = pointerRef.current.x * 0.35;
      modelGroup.rotation.x = -pointerRef.current.y * 0.2;

      // Gentle breathing idle motion
      modelGroup.position.y = Math.sin(elapsedTime * 2.2) * 0.012;
      particles.rotation.y = elapsedTime * 0.04;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
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
      </div>
    </div>
  );
};
