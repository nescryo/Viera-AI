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

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1e1f22');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.3, 2.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(2, 4, 3);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(
      new THREE.Color(currentPersona.accentColor || '#5865f2'), 
      1.5
    );
    rimLight.position.set(-3, 3, -2);
    scene.add(rimLight);

    const gridHelper = new THREE.GridHelper(10, 20, 0x5865f2, 0x2b2d31);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    const particleCount = 120;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 8;
      positions[i + 1] = Math.random() * 4;
      positions[i + 2] = (Math.random() - 0.5) * 8;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: new THREE.Color(currentPersona.accentColor || '#5865f2'),
      size: 0.03,
      transparent: true,
      opacity: 0.6
    });
    const particles = new THREE.Points(geometry, particleMaterial);
    scene.add(particles);

    const avatarGroup = new THREE.Group();

    const pedestalGeo = new THREE.CylinderGeometry(0.8, 0.9, 0.1, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x2b2d31,
      roughness: 0.3,
      metalness: 0.8
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = 0.05;
    avatarGroup.add(pedestal);

    const cardGeo = new THREE.PlaneGeometry(0.9, 1.4);
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

    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      avatarCard.position.y = 1.15 + Math.sin(elapsedTime * 2) * 0.03;
      avatarGroup.rotation.y = Math.sin(elapsedTime * 0.5) * 0.08;
      particles.rotation.y = elapsedTime * 0.05;

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
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [currentPersona]);

  return (
    <div className="scene-container">
      <div ref={containerRef} className="three-canvas-container" />
      
      <div className="scene-status-overlay">
        <span className="live-vrm-badge">
          <span className="pulse-dot" /> 3D Viewport Ready
        </span>
        <span className="current-emotion-badge">
          Expression: {currentEmotion || 'Neutral'}
        </span>
      </div>
    </div>
  );
};
