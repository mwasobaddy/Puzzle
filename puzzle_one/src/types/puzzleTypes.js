export const PUZZLE_TYPES = {
  JIGSAW: 'jigsaw',
  SLIDING: 'sliding',
  ROTATING: 'rotating',
  MEMORY: 'memory',
};

export const PUZZLE_CONFIG = {
  [PUZZLE_TYPES.JIGSAW]: {
    name: 'Jigsaw Puzzle',
    description: 'Classic jigsaw puzzle with draggable pieces',
    icon: '🧩',
    minPlayers: 1,
    maxPlayers: 8,
  },
  [PUZZLE_TYPES.SLIDING]: {
    name: 'Sliding Puzzle',
    description: 'Slide tiles to arrange the image',
    icon: '⬅️',
    minPlayers: 1,
    maxPlayers: 4,
  },
  [PUZZLE_TYPES.ROTATING]: {
    name: 'Rotating Puzzle',
    description: 'Rotate pieces to complete the image',
    icon: '🔄',
    minPlayers: 1,
    maxPlayers: 4,
  },
  [PUZZLE_TYPES.MEMORY]: {
    name: 'Memory Puzzle',
    description: 'Match pairs of cards',
    icon: '🎴',
    minPlayers: 1,
    maxPlayers: 6,
  },
};
