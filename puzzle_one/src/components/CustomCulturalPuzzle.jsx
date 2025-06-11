import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { Camera, Check, Info, Clock, ZoomIn, ZoomOut, Maximize2, RotateCcw, Image, Play, Pause, Share2, Download, X, RefreshCw } from 'lucide-react';
import html2canvas from 'html2canvas';
import { auth } from '../firebase';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, update, getDatabase } from 'firebase/database';
import elephant from '../assets/elephant.png';
import pyramid from '../assets/pyramid.png';
import african from '../assets/african.png';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from 'react-tooltip';
import DifficultyBar, { difficulties } from './DifficultyBar';
import { handlePuzzleCompletion, isPuzzleComplete } from './PuzzleCompletionHandler';
import UpgradeModal from './UpgradeModal';
import useUserSubscription from '../hooks/useUserSubscription';
import toast from 'react-hot-toast';

const DIFFICULTY_SETTINGS = {
  easy: { grid: { x: 4, y: 3 }, snapDistance: 0.4, rotationEnabled: false },
  medium: { grid: { x: 5, y: 4 }, snapDistance: 0.3, rotationEnabled: true },
  hard: { grid: { x: 6, y: 5 }, snapDistance: 0.2, rotationEnabled: true },
  expert: { grid: { x: 8, y: 6 }, snapDistance: 0.15, rotationEnabled: true }
};

const ACHIEVEMENTS = [
  { id: 'speed_demon', name: 'Speed Demon', description: 'Complete puzzle under 2 minutes', icon: '⚡' },
  { id: 'perfectionist', name: 'Perfectionist', description: 'Complete without misplacing pieces', icon: '✨' },
  { id: 'persistent', name: 'Persistent', description: 'Complete on expert difficulty', icon: '🏆' }
];

const CONTAINER_LAYOUT = {
  left: {
    position: { x: -5, y: 0 },
    dimensions: { width: 3, height: 5 },
    color: 0x2a2a2a
  },
  right: {
    position: { x: 5, y: 0 },
    dimensions: { width: 3, height: 5 },
    color: 0x2a2a2a
  }
};

const GRID_STYLE = {
  primaryColor: 0x4a90e2,
  secondaryColor: 0x2c5282,
  lineWidth: 2,
  opacity: 0.6,
  glowStrength: 0.5
};

class SoundSystem {
  constructor() {
    this.context = null;
    this.sounds = {};
    this.enabled = true;
    this.initialized = false;
  }

  async initializeContext() {
    if (this.initialized) return;

    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      await this.context.resume();
      await this.initialize();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  async initialize() {
    if (!this.context) return;

    this.sounds.pickup = await this.createToneBuffer(440, 0.1);
    this.sounds.place = await this.createToneBuffer(880, 0.15);
    this.sounds.complete = await this.createToneBuffer([523.25, 659.25, 783.99], 0.3);
  }

  createToneBuffer(frequency, duration) {
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    const frequencies = Array.isArray(frequency) ? frequency : [frequency];

    for (let i = 0; i < buffer.length; i++) {
      let sample = 0;
      frequencies.forEach(freq => {
        sample += Math.sin(2 * Math.PI * freq * i / sampleRate);
      });
      data[i] = sample / frequencies.length * Math.exp(-3 * i / buffer.length);
    }
    return buffer;
  }

  async play(soundName) {
    if (!this.enabled || !this.sounds[soundName] || !this.context) return;

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    const source = this.context.createBufferSource();
    source.buffer = this.sounds[soundName];
    source.connect(this.context.destination);
    source.start();
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

class ParticleSystem {
  constructor(scene) {
    this.particles = [];
    this.scene = scene;

    const geometry = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({
      size: 0.05,
      map: new THREE.TextureLoader().load('/api/placeholder/32/32'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particleSystem = new THREE.Points(geometry, material);
    scene.add(this.particleSystem);
  }

  emit(position, count = 20) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        position: position.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          Math.random() * 0.2
        ),
        life: 1.0
      });
    }
    this.updateGeometry();
  }

  update(deltaTime) {
    this.particles = this.particles.filter(particle => {
      particle.life -= deltaTime;
      particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
      return particle.life > 0;
    });
    this.updateGeometry();
  }

  updateGeometry() {
    const positions = new Float32Array(this.particles.length * 3);
    this.particles.forEach((particle, i) => {
      positions[i * 3] = particle.position.x;
      positions[i * 3 + 1] = particle.position.y;
      positions[i * 3 + 2] = particle.position.z;
    });
    this.particleSystem.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );
  }
}

const puzzlePieceShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    uniform vec2 uvOffset;
    uniform vec2 uvScale;
    uniform float depth;
    uniform sampler2D heightMap;
    
    void main() {
      vUv = uvOffset + uv * uvScale;
      
      // Sample height map for displacement
      vec4 heightValue = texture2D(heightMap, vUv);
      float displacement = (heightValue.r + heightValue.g + heightValue.b) / 3.0;
      
      // Create bas relief effect by moving vertices along their normals
      vec3 newPosition = position + normal * displacement * depth;
      
      vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      vViewPosition = -mvPosition.xyz;
      vNormal = normalMatrix * normal;
    }
  `,
  fragmentShader: `
    uniform sampler2D map;
    uniform float selected;
    uniform float correctPosition;
    uniform float time;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
      vec4 texColor = texture2D(map, vUv);
      vec3 normal = normalize(vNormal);
      
      vec3 viewDir = normalize(vViewPosition);
      vec3 lightDir = normalize(vec3(5.0, 5.0, 5.0));
      
      float ambient = 0.3;
      float diff = max(dot(normal, lightDir), 0.0);
      float diffuse = diff * 0.7;
      
      vec3 reflectDir = reflect(-lightDir, normal);
      float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
      float specular = spec * 0.3;
      
      vec3 lighting = vec3(ambient + diffuse + specular);
      
      // Remove the continuous flashing, only show static highlight
      vec3 highlightColor = vec3(0.3, 0.6, 1.0);
      float highlightStrength = selected * 0.3;
      
      vec3 correctColor = vec3(0.2, 1.0, 0.3);
      float correctStrength = correctPosition * 0.3;
      
      vec3 finalColor = texColor.rgb * lighting;
      finalColor += highlightColor * highlightStrength + correctColor * correctStrength;
      
      gl_FragColor = vec4(finalColor, texColor.a);
    }
  `
};

const handlePieceSnap = (piece, particleSystem) => {
  const originalPos = piece.userData.originalPosition;
  const originalRot = piece.userData.originalRotation || new THREE.Euler(0, 0, 0);
  const duration = 0.3;
  const startPos = piece.position.clone();
  const startRot = piece.rotation.clone();
  const startTime = Date.now();

  const animate = () => {
    const progress = Math.min((Date.now() - startTime) / (duration * 1000), 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    piece.position.lerpVectors(startPos, originalPos, easeProgress);

    piece.rotation.x = THREE.MathUtils.lerp(startRot.x, originalRot.x, easeProgress);
    piece.rotation.y = THREE.MathUtils.lerp(startRot.y, originalRot.y, easeProgress);
    piece.rotation.z = THREE.MathUtils.lerp(startRot.z, originalRot.z, easeProgress);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      piece.position.copy(originalPos);
      piece.rotation.copy(originalRot);
      if (particleSystem) {
        particleSystem.emit(piece.position, 30);
      }
    }
  };

  animate();
};



const ImageSelectionModal = ({ images, onSelect, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-4xl w-full p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Choose Your Puzzle</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {images.map((img) => (
            <div
              key={img.id}
              onClick={() => {
                onSelect(img);
                onClose();
              }}
              className="group relative overflow-hidden rounded-lg cursor-pointer transform transition-all duration-300 hover:scale-105 "
            >
              <img
                src={img.src}
                alt={img.title}
                className="w-full h-48 object-contain"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-4">
                <h3 className="text-white font-bold text-lg">{img.title}</h3>
                <p className="text-gray-200 text-sm">{img.description}</p>
              </div>
              <div className="absolute inset-0 bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PuzzleGame = () => {
  const subscription = useUserSubscription(auth.currentUser?.uid);
  const isPremium = subscription.planId === "pro" && subscription.status === "active";
  const [puzzleCount, setPuzzleCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completedPieces, setCompletedPieces] = useState(0);
  const [totalPieces, setTotalPieces] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [gameState, setGameState] = useState('initial');
  const [showThumbnail, setShowThumbnail] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [difficulty, setDifficulty] = useState(4);
  const [gameId, setGameId] = useState(null);
  const [completedAchievements, setCompletedAchievements] = useState([]);
  const [showImageSelection, setShowImageSelection] = useState(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState(difficulties[0]);

  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const composerRef = useRef(null);
  const controlsRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const particleSystemRef = useRef(null);
  const puzzlePiecesRef = useRef([]);
  const selectedPieceRef = useRef(null);
  const timerRef = useRef(null);
  const guideOutlinesRef = useRef([]);
  const puzzleContainerRef = useRef(null);
  const soundRef = useRef(null);

  const defaultCameraPosition = { x: 0, y: 0, z: 5 };
  const defaultControlsTarget = new THREE.Vector3(0, 0, 0);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startGame = async () => {
    if (!image) {
      alert('Please upload an image first');
      return;
    }

    await initializeAudio();

    setGameState('playing');
    setIsTimerRunning(true);
    setStartTime(Date.now());
  };

  const updateGameState = async (newState) => {
    if (!gameId) return;

    try {
      await update(ref(database, `games/${gameId}`), {
        ...newState,
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error('Error updating game state:', error);
    }
  };

  const togglePause = () => {
    if (gameState === 'playing') {
      setGameState('paused');
      setIsTimerRunning(false);
      if (gameId) {
        updateGameState({ state: 'paused' });
      }
    } else if (gameState === 'paused') {
      setGameState('playing');
      setIsTimerRunning(true);
      if (gameId) {
        updateGameState({ state: 'playing' });
      }
    }
  };

  const handleZoomIn = () => {
    if (cameraRef.current) {
      const newZ = Math.max(cameraRef.current.position.z - 1, 2);
      cameraRef.current.position.setZ(newZ);
    }
  };

  const handleZoomOut = () => {
    if (cameraRef.current) {
      const newZ = Math.min(cameraRef.current.position.z + 1, 10);
      cameraRef.current.position.setZ(newZ);
    }
  };

  const handleResetView = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(
        defaultCameraPosition.x,
        defaultCameraPosition.y,
        defaultCameraPosition.z
      );
      controlsRef.current.target.copy(defaultControlsTarget);
      controlsRef.current.update();
    }
  };

  const handleResetGame = () => {
    if (!sceneRef.current || !image) return;

    setTimeElapsed(0);
    setCompletedPieces(0);
    setProgress(0);
    setIsTimerRunning(true);

    puzzlePiecesRef.current.forEach(piece => {
      piece.position.x = piece.userData.originalPosition.x + (Math.random() - 0.5) * 2;
      piece.position.y = piece.userData.originalPosition.y + (Math.random() - 0.5) * 2;
      piece.position.z = Math.random() * 0.5;
      piece.rotation.z = (Math.random() - 0.5) * 0.5;
      piece.userData.isPlaced = false;
      if (piece.material.uniforms) {
        piece.material.uniforms.correctPosition.value = 0;
      }
    });

    handleResetView();
  };

  const createPlacementGuides = (gridSize, pieceSize) => {
    guideOutlinesRef.current.forEach(guide => sceneRef.current.remove(guide));
    guideOutlinesRef.current = [];

    const gridWidth = gridSize.x * pieceSize.x;
    const gridHeight = gridSize.y * pieceSize.y;

    const gridBackground = new THREE.Mesh(
      new THREE.PlaneGeometry(gridWidth + 0.1, gridHeight + 0.1),
      new THREE.MeshBasicMaterial({
        color: GRID_STYLE.secondaryColor,
        transparent: true,
        opacity: 0.2
      })
    );
    gridBackground.position.z = -0.02;
    sceneRef.current.add(gridBackground);
    guideOutlinesRef.current.push(gridBackground);

    for (let y = 0; y < gridSize.y; y++) {
      for (let x = 0; x < gridSize.x; x++) {
        const isAlternate = (x + y) % 2 === 0;
        const cellGeometry = new THREE.PlaneGeometry(pieceSize.x * 0.98, pieceSize.y * 0.98);
        const cellMaterial = new THREE.MeshBasicMaterial({
          color: isAlternate ? GRID_STYLE.primaryColor : GRID_STYLE.secondaryColor,
          transparent: true,
          opacity: 0.15
        });
        const cell = new THREE.Mesh(cellGeometry, cellMaterial);

        cell.position.x = (x - (gridSize.x - 1) / 2) * pieceSize.x;
        cell.position.y = (y - (gridSize.y - 1) / 2) * pieceSize.y;
        cell.position.z = -0.015;

        sceneRef.current.add(cell);
        guideOutlinesRef.current.push(cell);

        const outlineGeometry = new THREE.EdgesGeometry(cellGeometry);
        const outlineMaterial = new THREE.LineBasicMaterial({
          color: GRID_STYLE.primaryColor,
          transparent: true,
          opacity: GRID_STYLE.opacity,
          linewidth: GRID_STYLE.lineWidth
        });
        const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
        outline.position.copy(cell.position);
        outline.position.z = -0.01;

        sceneRef.current.add(outline);
        guideOutlinesRef.current.push(outline);
      }
    }
  };

  const createPuzzlePieces = async (imageUrl) => {
    if (!sceneRef.current) return;

    return new Promise(async (resolve, reject) => {
      try {
        puzzlePiecesRef.current.forEach(piece => {
          sceneRef.current.remove(piece);
        });
        puzzlePiecesRef.current = [];

        Object.entries(CONTAINER_LAYOUT).forEach(([side, layout]) => {
          const containerGeometry = new THREE.PlaneGeometry(
            layout.dimensions.width,
            layout.dimensions.height
          );
          const containerMaterial = new THREE.MeshBasicMaterial({
            color: layout.color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
          });
          const container = new THREE.Mesh(containerGeometry, containerMaterial);
          container.position.set(layout.position.x, layout.position.y, -0.1);
          container.userData.isContainer = true;
          container.userData.side = side;
          sceneRef.current.add(container);
        });

        const texture = await new THREE.TextureLoader().loadAsync(imageUrl);
        const aspectRatio = texture.image.width / texture.image.height;
        const baseSize = 3.5;
        const gridSize = selectedDifficulty.grid;
        const pieceSize = {
          x: (baseSize * aspectRatio) / gridSize.x,
          y: baseSize / gridSize.y
        };

        setTotalPieces(gridSize.x * gridSize.y);
        createPlacementGuides(gridSize, pieceSize);

        const pieces = [];
        for (let y = 0; y < gridSize.y; y++) {
          for (let x = 0; x < gridSize.x; x++) {
            const geometry = new THREE.PlaneGeometry(
              pieceSize.x * 0.98,
              pieceSize.y * 0.98,
              32,
              32
            );

            const material = new THREE.ShaderMaterial({
              uniforms: {
                map: { value: texture },
                heightMap: { value: texture },
                uvOffset: { value: new THREE.Vector2(x / gridSize.x, y / gridSize.y) },
                uvScale: { value: new THREE.Vector2(1 / gridSize.x, 1 / gridSize.y) },
                depth: { value: 0.2 },
                selected: { value: 0.0 },
                correctPosition: { value: 0.0 },
                time: { value: 0.0 }
              },
              vertexShader: puzzlePieceShader.vertexShader,
              fragmentShader: puzzlePieceShader.fragmentShader,
              side: THREE.DoubleSide
            });

            const piece = new THREE.Mesh(geometry, material);

            piece.userData.originalPosition = new THREE.Vector3(
              (x - (gridSize.x - 1) / 2) * pieceSize.x,
              (y - (gridSize.y - 1) / 2) * pieceSize.y,
              0
            );
            piece.userData.gridPosition = { x, y };
            piece.userData.isPlaced = false;

            pieces.push(piece);
          }
        }

        const shuffledPieces = pieces.sort(() => Math.random() - 0.5);
        const halfLength = Math.ceil(shuffledPieces.length / 2);
        const leftPieces = shuffledPieces.slice(0, halfLength);
        const rightPieces = shuffledPieces.slice(halfLength);

        arrangePiecesInContainer(leftPieces, CONTAINER_LAYOUT.left, pieceSize);
        arrangePiecesInContainer(rightPieces, CONTAINER_LAYOUT.right, pieceSize);

        pieces.forEach(piece => {
          sceneRef.current.add(piece);
          puzzlePiecesRef.current.push(piece);
        });

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  };

  const arrangePiecesInContainer = (pieces, container, pieceSize) => {
    const cols = Math.floor(container.dimensions.width / (pieceSize.x * 1.2));
    const rows = Math.ceil(pieces.length / cols);

    pieces.forEach((piece, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;

      piece.position.x = container.position.x - container.dimensions.width / 2 +
        (col + 0.5) * (container.dimensions.width / cols);
      piece.position.y = container.position.y + container.dimensions.height / 2 -
        (row + 0.5) * (container.dimensions.height / rows);
      piece.position.z = 0.01;
    });
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5,
      0.4,
      0.85
    ));
    composerRef.current = composer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 10;
    controls.minDistance = 2;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    particleSystemRef.current = new ParticleSystem(scene);

    const animate = () => {
      if (!particleSystemRef.current) return;

      requestAnimationFrame(animate);

      const deltaTime = clockRef.current.getDelta();

      controls.update();

      particleSystemRef.current.update(deltaTime);

      puzzlePiecesRef.current.forEach(piece => {
        if (piece.material.uniforms) {
          piece.material.uniforms.time.value = clockRef.current.getElapsedTime();
        }
      });

      composer.render();
    };
    animate();

    return () => {
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning]);

  useEffect(() => {
    if (progress === 100) {
      setIsTimerRunning(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      synchronousCompletion();
    }
  }, [progress]);

  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false;
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersection = new THREE.Vector3();
    const offset = new THREE.Vector3();
    const rotationSpeed = 0.01;
    let initialRotation = 0;

    const handleMouseDown = (event) => {
      if (gameState !== 'playing') return;

      event.preventDefault();

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);

      const intersects = raycaster.intersectObjects(puzzlePiecesRef.current);

      if (intersects.length > 0) {
        const piece = intersects[0].object;

        if (piece.userData.isPlaced) return;

        isDragging = true;
        selectedPieceRef.current = piece;
        controlsRef.current.enabled = false;

        raycaster.ray.intersectPlane(dragPlane, intersection);

        offset.copy(piece.position).sub(intersection);
        initialRotation = piece.rotation.z;

        if (piece.material.uniforms) {
          piece.material.uniforms.selected.value = 1.0;
        }

        piece.position.z = 0.1;
      }
    };

    const handleMouseMove = (event) => {
      if (gameState !== 'playing') return;

      if (!isDragging || !selectedPieceRef.current) return;

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      raycaster.ray.intersectPlane(dragPlane, intersection);

      selectedPieceRef.current.position.copy(intersection.add(offset));

      if (event.shiftKey && selectedPieceRef.current) {
        const deltaX = event.movementX * rotationSpeed;
        selectedPieceRef.current.rotation.z = initialRotation + deltaX;
      }

      const originalPos = selectedPieceRef.current.userData.originalPosition;
      const distance = originalPos.distanceTo(selectedPieceRef.current.position);
      const rotationDiff = Math.abs(selectedPieceRef.current.rotation.z % (Math.PI * 2));

      const isNearCorrectPosition = distance < 0.3;
      const isNearCorrectRotation = rotationDiff < 0.2 || Math.abs(rotationDiff - Math.PI * 2) < 0.2;

      if (selectedPieceRef.current.material.uniforms) {
        if (isNearCorrectPosition && isNearCorrectRotation) {
          selectedPieceRef.current.material.uniforms.correctPosition.value =
            1.0 - (Math.max(distance / 0.3, rotationDiff / 0.2));
        } else {
          selectedPieceRef.current.material.uniforms.correctPosition.value = 0.0;
        }
      }
    };

    const handleMouseUp = () => {
      if (!selectedPieceRef.current) return;

      if (gameState !== 'playing') {
        if (selectedPieceRef.current.material.uniforms) {
          selectedPieceRef.current.material.uniforms.selected.value = 0.0;
          selectedPieceRef.current.material.uniforms.correctPosition.value =
            selectedPieceRef.current.userData.isPlaced ? 1.0 : 0.0;
        }
        selectedPieceRef.current.position.z = 0;
        selectedPieceRef.current = null;
        isDragging = false;
        controlsRef.current.enabled = true;
        return;
      }

      const originalPos = selectedPieceRef.current.userData.originalPosition;
      const distance = originalPos.distanceTo(selectedPieceRef.current.position);
      const rotationDiff = Math.abs(selectedPieceRef.current.rotation.z % (Math.PI * 2));

      const isNearCorrectPosition = distance < 0.3;
      const isNearCorrectRotation = rotationDiff < 0.2 || Math.abs(rotationDiff - Math.PI * 2) < 0.2;

      if (isNearCorrectPosition && isNearCorrectRotation) {
        handlePieceSnap(selectedPieceRef.current, particleSystemRef.current);

        if (!selectedPieceRef.current.userData.isPlaced) {
          selectedPieceRef.current.userData.isPlaced = true;
          setCompletedPieces(prev => {
            const newCount = prev + 1;
            setProgress((newCount / totalPieces) * 100);
            return newCount;
          });
          handlePieceComplete(selectedPieceRef.current);
        }
      }

      if (selectedPieceRef.current.material.uniforms) {
        selectedPieceRef.current.material.uniforms.selected.value = 0.0;
        selectedPieceRef.current.material.uniforms.correctPosition.value =
          selectedPieceRef.current.userData.isPlaced ? 1.0 : 0.0;
      }

      if (!selectedPieceRef.current.userData.isPlaced) {
        selectedPieceRef.current.position.z = 0;
      }

      selectedPieceRef.current = null;
      isDragging = false;
      controlsRef.current.enabled = true;
    };

    const element = rendererRef.current.domElement;
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseup', handleMouseUp);
    element.addEventListener('mouseleave', handleMouseUp);

    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseup', handleMouseUp);
      element.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [gameState, totalPieces]);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target.result);
      createPuzzlePieces(e.target.result).then(() => {
        setLoading(false);
        setGameState('playing');
        setIsTimerRunning(true);
        setCompletedPieces(0);
        setProgress(0);
        setTimeElapsed(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const capturePuzzleImage = async () => {
    if (!puzzleContainerRef.current) return null;
    try {
      const canvas = await html2canvas(puzzleContainerRef.current);
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Failed to capture puzzle image:', err);
      return null;
    }
  };

  const downloadPuzzleImage = async () => {
    const imageData = await capturePuzzleImage();
    if (!imageData) return;

    const link = document.createElement('a');
    link.href = imageData;
    link.download = `custom-puzzle-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareToFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`I have just completed a custom puzzle in ${formatTime(timeElapsed)}! Try creating your own!`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank');
  };

  const shareToTwitter = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`I have just completed a custom puzzle in ${formatTime(timeElapsed)}! #PuzzleGame`);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
  };

  const shareToWhatsApp = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`I have just completed a custom puzzle in ${formatTime(timeElapsed)}! Create yours: `);
    window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
  };

  const ShareModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">Share Your Achievement</h3>
        <div className="space-y-4">
          <button
            onClick={shareToFacebook}
            className="w-full p-3 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Share on Facebook
          </button>
          <button
            onClick={shareToTwitter}
            className="w-full p-3 bg-sky-400 text-white rounded hover:bg-sky-500"
          >
            Share on Twitter
          </button>
          <button
            onClick={shareToWhatsApp}
            className="w-full p-3 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Share on WhatsApp
          </button>
          <button
            onClick={downloadPuzzleImage}
            className="w-full p-3 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" /> Download Image
          </button>
        </div>
        <button
          onClick={() => setShowShareModal(false)}
          className="mt-4 w-full p-2 border border-gray-300 rounded hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </div>
  );
  useEffect(() => {
    if (progress === 100 && auth?.currentUser) {

      const completionData = {
        puzzleId: `custom_${Date.now()}`,
        userId: auth.currentUser.uid,
        playerName: auth.currentUser.email || 'Anonymous',
        startTime: startTime,
        difficulty,
        imageUrl: image,
        timer: timeElapsed,
      };

      console.log('Data sent to handlePuzzleCompletion:', completionData);
      handlePuzzleCompletion(completionData);

      const achievements = checkAchievements();
      console.log('Achievements Earned:', achievements);

      if (gameId) {
        const gameUpdateData = {
          state: 'completed',
          completionTime: timeElapsed,
          achievements: achievements.map(a => a.id)
        };
        console.log('Game State Update:', gameUpdateData);
        updateGameState(gameUpdateData);
      }
    }
  }, [progress, startTime, difficulty, image, timeElapsed, totalPieces, completedPieces]);

  const synchronousCompletion = async () => {
    try {
      console.log('Starting synchronous completion process...');

      await handlePuzzleCompletionCultural({
        puzzleId: `custom_${Date.now()}`,
        userId: auth?.currentUser?.uid,
        playerName: auth?.currentUser?.displayName || 'Anonymous',
        startTime,
        difficulty,
        imageUrl: image,
        timer: timeElapsed
      });

      const achievements = checkAchievements();
      console.log('Processing achievements:', achievements);

      if (gameId) {
        await updateGameState({
          state: 'completed',
          completionTime: timeElapsed,
          achievements: achievements.map(a => a.id)
        });
      }

      console.log('Completion process finished successfully');
      setShowShareModal(true);
    } catch (error) {
      console.error('Error in completion process:', error);
    }
  };

  useEffect(() => {
    const soundSystem = new SoundSystem();
    soundRef.current = soundSystem;

    return () => {
      if (soundRef.current?.context) {
        soundRef.current.context.close();
      }
    };
  }, []);

  const initializeAudio = async () => {
    if (soundRef.current && !soundRef.current.initialized) {
      await soundRef.current.initializeContext();
    }
  };

  const setupMouseInteraction = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    const handlePieceInteraction = async (event, piece) => {
      if (!piece || piece.userData.isPlaced) return;

      await initializeAudio();

      if (piece.material.uniforms) {
        piece.material.uniforms.selected.value = 1.0;
      }

      soundRef.current?.play('pickup');
    };

  };

  const checkAchievements = () => {
    const achievements = [];

    if (timeElapsed < 120) {
      achievements.push(ACHIEVEMENTS.find(a => a.id === 'speed_demon'));
    }

    if (!puzzlePiecesRef.current.some(p => p.userData.misplaced)) {
      achievements.push(ACHIEVEMENTS.find(a => a.id === 'perfectionist'));
    }

    if (difficulty === 'expert') {
      achievements.push(ACHIEVEMENTS.find(a => a.id === 'persistent'));
    }

    return achievements;
  };

  const handlePuzzleCompletionCultural = async () => {
    if (!auth.currentUser) return;

    const achievements = checkAchievements();
    const db = getFirestore();

    try {
      await addDoc(collection(db, 'completed_puzzles'), {
        userId: auth.currentUser.uid,
        puzzleId: gameId,
        timeElapsed,
        difficulty,
        completedAt: serverTimestamp(),
        achievements: achievements.map(a => a.id)
      });

      soundRef.current?.play('complete');

      setCompletedAchievements(achievements);
      if (!isPremium) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const q = query(
          collection(db, 'completed_puzzles'),
          where('userId', '==', auth.currentUser.uid),
          where('completedAt', '>=', startOfMonth)
        );

        const querySnapshot = await getDocs(q);
        const puzzleCount = querySnapshot.size;

        if (puzzleCount === 1) {
          toast.success("You've completed 1 puzzle this month. You have 1 more puzzle left!");
        } else if (puzzleCount >= 2) {
          toast.error("You've reached your monthly limit for creating custom puzzles. Upgrade to Premium to create more!");
          setIsModalOpen(true);
        }
      }

    } catch (error) {
      console.error('Error saving completion:', error);
    }
  };

  const initializeGameState = async () => {
    if (!auth.currentUser) return;

    const db = getDatabase();
    const gameRef = ref(db, `games/${gameId}`);

    try {
      await update(gameRef, {
        createdAt: serverTimestamp(),
        userId: auth.currentUser.uid,
        difficulty,
        state: 'initial'
      });
    } catch (error) {
      console.error('Error initializing game:', error);
    }
  };

  const handlePieceComplete = async (piece) => {
    if (!piece) return;

    await initializeAudio();

    soundRef.current?.play('place');

    particleSystemRef.current?.emit(piece.position, 30);

    const ripple = new THREE.Mesh(
      new THREE.CircleGeometry(0.1, 32),
      new THREE.MeshBasicMaterial({
        color: 0x4a90e2,
        transparent: true,
        opacity: 0.5
      })
    );

    ripple.position.copy(piece.position);
    ripple.position.z = 0.01;
    sceneRef.current.add(ripple);

    const animate = () => {
      const scale = ripple.scale.x + 0.05;
      ripple.scale.set(scale, scale, 1);
      ripple.material.opacity -= 0.02;

      if (ripple.material.opacity > 0) {
        requestAnimationFrame(animate);
      } else {
        sceneRef.current.remove(ripple);
      }
    };

    animate();
  };

  const replayPuzzle = () => {
    if (!image) return;

    setLoading(true);
    setGameState('playing');
    setIsTimerRunning(true);
    setCompletedPieces(0);
    setProgress(0);
    setTimeElapsed(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    createPuzzlePieces(image).then(() => {
      setLoading(false);
    });
  };

  const PRESET_IMAGES = [
    { id: 'elephant', src: elephant, title: 'African Elephant', description: 'Majestic elephant in its natural habitat' },
    { id: 'pyramid', src: pyramid, title: 'Egyptian Pyramid', description: 'Ancient pyramid of Giza' },
    { id: 'african', src: african, title: 'African Culture', description: 'Traditional African cultural scene' }
  ];

  const handleDifficultyChange = async (newDifficulty) => {
    toast.loading('Changing difficulty level...', {
      id: 'difficulty-change',
      duration: 1000,
    });

    setSelectedDifficulty(newDifficulty);
    setDifficulty(newDifficulty.id);

    if (image) {
      setLoading(true);
      try {
        await createPuzzlePieces(image);
        setGameState('playing');
        setIsTimerRunning(true);
        setCompletedPieces(0);
        setProgress(0);
        setTimeElapsed(0);

        toast.success(`Difficulty changed to ${newDifficulty.label}`, {
          id: 'difficulty-change',
        });
      } catch (error) {
        console.error('Error creating puzzle pieces:', error);
        toast.error('Failed to change difficulty', {
          id: 'difficulty-change',
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gradient-to-b from-gray-900 to-gray-800">
      <header className="px-4 py-3 bg-gray-800/90 backdrop-blur-sm border-b border-gray-700 shadow-lg">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-2xl font-bold text-white">Cultural Puzzle</h1>
              <button
                onClick={() => setShowImageSelection(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all transform hover:scale-105"
              >
                <Image className="w-5 h-5 mr-2" />
                <span>Select Image</span>
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-700/50 px-4 py-2 rounded-lg">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className="text-white font-mono text-lg">
                  {formatTime(timeElapsed)}
                </span>
              </div>
              {gameState !== 'initial' && (
                <button
                  onClick={togglePause}
                  className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all transform hover:scale-105"
                >
                  {gameState === 'playing' ?
                    <Pause className="w-6 h-6" /> :
                    <Play className="w-6 h-6" />
                  }
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {totalPieces > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-gray-300 text-sm">Progress</span>
                <div className="flex-1 h-3 bg-gray-700/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-white font-medium min-w-[3rem] text-right">
                  {Math.round(progress)}%
                </span>
              </div>
            )}
            <div className="flex justify-end">
              <DifficultyBar
                selectedDifficulty={selectedDifficulty}
                onSelect={handleDifficultyChange}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden">
        <div ref={containerRef} className="w-full h-full" />

        <div className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-gray-800/90 backdrop-blur-sm p-2 rounded-lg shadow-lg">
          <ControlButton icon={<ZoomIn />} onClick={handleZoomIn} tooltip="Zoom In" />
          <ControlButton icon={<ZoomOut />} onClick={handleZoomOut} tooltip="Zoom Out" />
          <div className="w-full h-px bg-gray-700" />
          <ControlButton icon={<Maximize2 />} onClick={handleResetView} tooltip="Reset View" />
          <ControlButton icon={<RotateCcw />} onClick={handleResetGame} tooltip="Reset Puzzle" />
          <ControlButton icon={<RefreshCw />} onClick={replayPuzzle} tooltip="Replay Puzzle" />
          <ControlButton
            icon={<Image />}
            onClick={() => setShowThumbnail(!showThumbnail)}
            tooltip="Toggle Reference"
            active={showThumbnail}
          />
        </div>

        <AnimatePresence>
          {showThumbnail && image && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="fixed left-4 top-24 p-3 bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-xl"
            >
              <img
                src={image}
                alt="Reference"
                className="w-40 md:w-48 h-auto rounded border border-gray-700"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center bg-gray-900/75 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center gap-4 p-6 rounded-lg bg-gray-800/90">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-xl text-white font-medium">Loading puzzle...</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ImageSelectionModal
        images={PRESET_IMAGES}
        onSelect={(img) => {
          setImage(img.src);
          createPuzzlePieces(img.src).then(() => {
            setLoading(false);
            setGameState('playing');
            setIsTimerRunning(true);
            setCompletedPieces(0);
            setProgress(0);
            setTimeElapsed(0);
          });
        }}
        isOpen={showImageSelection}
        onClose={() => setShowImageSelection(false)}
      />

      <UpgradeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpgrade={() => navigate("/payment-plans")}
      />

      {showShareModal && <ShareModal />}
    </div>
  );
};
const ControlButton = ({ icon, onClick, tooltip, active = false }) => (
  <button
    onClick={onClick}
    className={`p-2 rounded transition-all transform hover:scale-110 ${active ? 'bg-blue-600 text-white' : 'text-white hover:bg-gray-700'
      }`}
    title={tooltip}
  >
    {icon}
  </button>
);

export default PuzzleGame;