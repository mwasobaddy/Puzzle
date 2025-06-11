import React from 'react';

const difficulties = [
  { id: 'easy', label: 'Easy', grid: { x: 3, y: 2 }, description: 'Perfect for beginners' },
  { id: 'medium', label: 'Medium', grid: { x: 4, y: 3 }, description: 'A balanced challenge' },
  { id: 'hard', label: 'Hard', grid: { x: 5, y: 4 }, description: 'For experienced puzzlers' },
  { id: 'expert', label: 'Expert', grid: { x: 6, y: 5 }, description: 'Maximum difficulty' }
];

const DifficultySelector = ({ onSelect, selectedDifficulty, className }) => {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {difficulties.map((diff) => (
        <button
          key={diff.id}
          onClick={() => onSelect(diff)}
          className={`p-4 rounded-lg transition-all transform hover:scale-105
            ${selectedDifficulty?.id === diff.id 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
        >
          <h3 className="text-lg font-bold">{diff.label}</h3>
          <p className="text-sm opacity-80">{diff.description}</p>
          <div className="mt-2 text-xs opacity-70">
            Grid: {diff.grid.x}x{diff.grid.y}
          </div>
        </button>
      ))}
    </div>
  );
};

export default DifficultySelector;
export { difficulties };
