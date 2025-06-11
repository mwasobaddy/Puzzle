import { Square, Maximize, LayoutTemplate } from 'lucide-react';
import * as THREE from 'three';

export const PUZZLE_TYPES = {
  classic: {
    name: 'Classic',
    aspectRatio: 4 / 3,
    description: 'Standard rectangle format',
    cameraPosition: new THREE.Vector3(0, 0, 5),
    settings: {
      aspectRatio: 4 / 3,
      snapThreshold: 0.25,
      rotationEnabled: false,
      baseSize: 3.5
    }
  },
  vertical: {
    name: 'Vertical',
    aspectRatio: 2 / 3,
    description: 'Tall rectangular format',
    cameraPosition: new THREE.Vector3(0, 0, 6),
    settings: {
      aspectRatio: 2 / 3,
      snapThreshold: 0.25,
      rotationEnabled: false,
      baseSize: 4
    }
  },
  panoramic: {
    name: 'Panoramic',
    aspectRatio: 16 / 9,
    description: 'Wide rectangular format',
    cameraPosition: new THREE.Vector3(0, 0, 7),
    settings: {
      aspectRatio: 16 / 9,
      snapThreshold: 0.25,
      rotationEnabled: false,
      baseSize: 5
    }
  },
  square: {
    name: 'Square',
    aspectRatio: 1,
    description: 'Perfect square format',
    cameraPosition: new THREE.Vector3(0, 0, 5),
    settings: {
      aspectRatio: 1,
      snapThreshold: 0.25,
      rotationEnabled: false,
      baseSize: 3.5
    }
  },
  portrait: {
    name: 'Portrait',
    aspectRatio: 3 / 5,
    description: 'Very tall format',
    cameraPosition: new THREE.Vector3(0, 0, 7),
    settings: {
      aspectRatio: 3 / 5,
      snapThreshold: 0.25,
      rotationEnabled: false,
      baseSize: 4.5
    }
  },
  landscape: {
    name: 'Landscape',
    aspectRatio: 21 / 9,
    description: 'Very wide format',
    cameraPosition: new THREE.Vector3(0, 0, 7),
    settings: {
      aspectRatio: 21 / 9,
      snapThreshold: 0.25,
      rotationEnabled: false,
      baseSize: 5.5
    }
  }
};
