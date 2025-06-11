import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePuzzleHistory } from '../hooks/usePuzzleHistory';
import { Clock, Star, Play } from 'lucide-react';

const QuickAccess = ({ userId }) => {
  const navigate = useNavigate();
  const { recentPuzzles, savedPuzzles, loading, error } = usePuzzleHistory(userId);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) return <div>Loading puzzles...</div>;
  if (error) return <div>Error loading puzzles: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4">Recently Completed</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recentPuzzles.map(puzzle => (
            <div key={puzzle.id} className="border rounded-lg p-4">
              <img src={puzzle.thumbnail} alt="Puzzle" className="w-full h-32 object-contain rounded mb-2" />
              <p className="font-semibold">{puzzle.name}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-500">
                  <Clock className="w-4 h-4 inline mr-1" />
                  {formatTime(puzzle.completionTime)}
                </span>
                <button
                  onClick={() => navigate(`/puzzle/${puzzle.category}/${puzzle.id}`)}
                  className="text-blue-500 hover:text-blue-600"
                >
                  <Play className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4">Saved Puzzles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {savedPuzzles.map(puzzle => (
            <div key={puzzle.id} className="border rounded-lg p-4">
              <img src={puzzle.savedThumbnail} alt="Puzzle" className="w-full h-32 object-contain rounded mb-2" />
              <p className="font-semibold">{puzzle.name}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-500">
                  Best: {formatTime(puzzle.bestTime)}
                </span>
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickAccess;
