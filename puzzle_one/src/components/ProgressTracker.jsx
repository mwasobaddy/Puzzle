import React, { useState, useEffect } from 'react';
import { Line } from 'recharts';

const ProgressTracker = ({ completedPieces, totalPieces }) => {
  const [progress, setProgress] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setProgress((completedPieces / totalPieces) * 100);
  }, [completedPieces, totalPieces]);

  return (
    <div className="progress-container">
      <div className="progress-bar w-full bg-gray-200 rounded">
        <div
          className="bg-blue-600 rounded h-2 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="timer mt-2">
        Time: {Math.floor(timeElapsed / 60)}:{timeElapsed % 60}
      </div>
    </div>
  );
};

export default ProgressTracker;