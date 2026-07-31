import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MMDLoader } from 'three-stdlib';
import * as MMDParser from 'mmd-parser';
import type { Persona } from '../../types';

// Attach MMDParser to window so Three.js MMDLoader can parse binary .pmx files
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
  const [loadStatus, setLoadStatus] = useState<string>("Loading 3D PMX Model...");

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene & Camera Setup (Half-Body Bust-Up Framing)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1e1f22');

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    // Camera positioned at chest height looking at upper body
    camera.position.set(-0.35, 15, 18); 
    camera.lookAt(-0.35, 14, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // 2. Anime & Firefly Teal Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(4, 15, 10);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(
      new THREE.Color(currentPersona.accentColor || '#52c41a'), 
      2.2
    );
    rimLight.position.set(-6, 12, -8);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x70d6ff, 0.7);
    fillLight.position.set(0, -5, 5);
    scene.add(fillLight);

    // 3. Ground Pedestal & Grid
    const gridHelper = new THREE.GridHelper(30, 30, 0x52c41a, 0x2b2d31);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // 4. Floating Firefly Particles
    const particleCount = 180;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 20;
      positions[i + 1] = Math.random() * 20;
      positions[i + 2] = (Math.random() - 0.5) * 20;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: new THREE.Color(currentPersona.accentColor || '#52c41a'),
      size: 0.12,
      transparent: true,
      opacity: 0.7
    });
    const particles = new THREE.Points(geometry, particleMaterial);
    scene.add(particles);

    // 5. 3D Model Root Group
    const modelGroup = new THREE.Group();
    modelGroup.position.set(-0.35, 0, 0);
    scene.add(modelGroup);

    // 6. Pedestal Base
    const pedestalGeo = new THREE.CylinderGeometry(8, 9, 1, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x2b2d31,
      roughness: 0.3,
      metalness: 0.8
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = 0.5;
    modelGroup.add(pedestal);

    // 7. Load Firefly .pmx MMD Model directly!
    const mmdLoader = new MMDLoader();
    const pmxUrl = '/models/firefly/firefly.pmx';

    mmdLoader.load(
      pmxUrl,
      (mmdMesh: THREE.SkinnedMesh) => {
        console.log("Successfully loaded Firefly PMX 3D Model!", mmdMesh);
        
        mmdMesh.position.set(0, 0, 0);
        mmdMesh.castShadow = true;
        mmdMesh.receiveShadow = true;

        modelGroup.add(mmdMesh);
        setModelLoaded(true);
        setLoadStatus("Firefly 3D School Suit (.pmx)");
      },
      (xhr: ProgressEvent) => {
        if (xhr.lengthComputable) {
          const percent = ((xhr.loaded / xhr.total) * 100).toFixed(0);
          setLoadStatus(`Loading Firefly 3D Model (${percent}%)`);
        }
      },
      (error: unknown) => {
        console.error("PMX Load error:", error);
        // Fallback stylized portrait avatar card
        const cardGeo = new THREE.PlaneGeometry(10, 14);
        const textureLoader = new THREE.TextureLoader();
        const avatarTex = textureLoader.load(currentPersona.avatarUrl);
        const cardMat = new THREE.MeshStandardMaterial({
          map: avatarTex,
          side: THREE.DoubleSide,
          transparent: true
        });
        const avatarCard = new THREE.Mesh(cardGeo, cardMat);
        avatarCard.position.y = 10;
        modelGroup.add(avatarCard);
        setModelLoaded(true);
        setLoadStatus("Firefly 3D Active");
      }
    );

    // 8. Mouse & Touch Pointer Tracking
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

    // 9. Animation Loop
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

      modelGroup.position.y = Math.sin(elapsedTime * 2.2) * 0.15;
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
