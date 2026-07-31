import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Persona } from '../../types';

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

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1e1f22');

    // 2. Camera Setup for Half-Body (Bust-Up Portrait View like AIRI)
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    // Position camera closer and target upper torso/face height
    camera.position.set(-0.35, 1.25, 1.35); 
    camera.lookAt(-0.35, 1.15, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // 3. Anime / Cyberpunk Lighting (Firefly Accent Glow)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.3);
    mainLight.position.set(2, 4, 3);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(
      new THREE.Color(currentPersona.accentColor || '#52c41a'), 
      1.8
    );
    rimLight.position.set(-3, 3, -2);
    scene.add(rimLight);

    // Subtle Fill Light from bottom
    const fillLight = new THREE.DirectionalLight(0x70d6ff, 0.5);
    fillLight.position.set(0, -2, 2);
    scene.add(fillLight);

    // 4. Ground Grid & Pedestal
    const gridHelper = new THREE.GridHelper(10, 20, 0x52c41a, 0x2b2d31);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // 5. Floating Particles
    const particleCount = 150;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 8;
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

    // 6. Stylized 3D Avatar Host (Framed Half-Body Position)
    const avatarGroup = new THREE.Group();
    avatarGroup.position.set(-0.35, 0, 0); // Positioned slightly left so chat overlay on right doesn't block it

    const pedestalGeo = new THREE.CylinderGeometry(0.8, 0.9, 0.1, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x2b2d31,
      roughness: 0.3,
      metalness: 0.8
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = 0.05;
    avatarGroup.add(pedestal);

    // 3D Avatar Card Mesh - Proportionally resized for half-body framing
    const cardGeo = new THREE.PlaneGeometry(1.2, 1.6);
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
    avatarGroup.add(avatarCard);

    scene.add(avatarGroup);

    // 7. Mouse & Touch Tracking
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

      avatarGroup.rotation.y = pointerRef.current.x * 0.35;
      avatarGroup.rotation.x = -pointerRef.current.y * 0.2;

      avatarCard.position.y = 1.15 + Math.sin(elapsedTime * 2.2) * 0.02;
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
          <span className="pulse-dot" /> 3D Viewport • Firefly Half-Body View
        </span>
        <span className="current-emotion-badge">
          Expression: {currentEmotion || 'Neutral'}
        </span>
      </div>
    </div>
  );
};
