import React from 'react';
import { Tooltip } from 'react-tooltip';

export const difficulties = [
  { id: 'easy', label: 'Easy', grid: { x: 3, y: 2 }, icon: '🟢' },
  { id: 'medium', label: 'Medium', grid: { x: 4, y: 3 }, icon: '🟡' },
  { id: 'hard', label: 'Hard', grid: { x: 5, y: 4 }, icon: '🟠' },
  { id: 'expert', label: 'Expert', grid: { x: 6, y: 5 }, icon: '🔴' }
];

const DifficultyBar = ({ selectedDifficulty, onSelect, className }) => {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {difficulties.map((difficulty) => (
        <React.Fragment key={difficulty.id}>
          <button
            data-tooltip-id={`difficulty-${difficulty.id}`}
            onClick={() => onSelect(difficulty)}
            className={`
              px-3 py-1.5 rounded-full text-sm font-medium
              transition-all duration-200 transform hover:scale-105
              flex items-center gap-1.5
              ${selectedDifficulty.id === difficulty.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
              }
            `}
          >
            <span className="hidden sm:inline">{difficulty.icon}</span>
            <span>{difficulty.label}</span>
          </button>
          <Tooltip
            id={`difficulty-${difficulty.id}`}
            content="Click twice to reset"
            place="top"
            effect="solid"
            className="bg-gray-800 text-white px-2 py-1 text-xs rounded shadow-lg"
          />
        </React.Fragment>
      ))}
      <Tooltip
        id="difficulty-info"
        content="Changes will be applied when you click a difficulty level"
        place="top"
        effect="solid"
        className="bg-gray-800 text-white px-2 py-1 text-xs rounded shadow-lg z-50"
      />
    </div>
  );
};

export default DifficultyBar;