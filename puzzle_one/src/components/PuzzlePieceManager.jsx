import React, { useState, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCw, RotateCcw, RefreshCw } from 'lucide-react';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const EnhancedPuzzle = ({ imageUrl, initialDifficulty = 3, onPiecePlace, onComplete }) => {
  const [pieces, setPieces] = useState([]);
  const [draggedPiece, setDraggedPiece] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [zoom, setZoom] = useState(1);
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [gridDimensions, setGridDimensions] = useState({ width: 0, height: 0 });
  const [correctPlacements, setCorrectPlacements] = useState(new Set());
  const [cellDimensions, setCellDimensions] = useState({ width: 0, height: 0 });
  const db = getFirestore();

  useEffect(() => {
    const updateGridDimensions = () => {
      const gridElement = document.querySelector('.puzzle-grid');
      if (gridElement) {
        setGridDimensions({
          width: gridElement.offsetWidth,
          height: gridElement.offsetHeight
        });
      }
    };

    updateGridDimensions();
    window.addEventListener('resize', updateGridDimensions);
    return () => window.removeEventListener('resize', updateGridDimensions);
  }, [difficulty]);

  const showMessage = useCallback((text, type = 'info', duration = 3000) => {
    setMessage(text);
    setMessageType(type);
    if (duration) {
      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, duration);
    }
  }, []);

  const isPieceCorrect = useCallback((piece, currentX, currentY) => {
    return (
      currentX === piece.correct.x &&
      currentY === piece.correct.y &&
      piece.rotation % 360 === 0
    );
  }, []);

  const initializePuzzle = useCallback(() => {
    setIsLoading(true);
    setCorrectPlacements(new Set());
    setTimeElapsed(0);

    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
      const aspectRatio = img.width / img.height;

      let pieceWidth, pieceHeight;
      if (aspectRatio >= 1) {
        pieceWidth = img.width / difficulty;
        pieceHeight = pieceWidth / aspectRatio;
      } else {
        pieceHeight = img.height / difficulty;
        pieceWidth = pieceHeight * aspectRatio;
      }

      const newPieces = [];
      for (let y = 0; y < difficulty; y++) {
        for (let x = 0; x < difficulty; x++) {
          newPieces.push({
            id: `piece-${x}-${y}`,
            correct: { x, y },
            current: {
              x: Math.floor(Math.random() * difficulty),
              y: Math.floor(Math.random() * difficulty)
            },
            rotation: Math.floor(Math.random() * 4) * 90,
            dimensions: {
              width: pieceWidth,
              height: pieceHeight,
              offsetX: x * pieceWidth,
              offsetY: y * pieceHeight
            }
          });
        }
      }
      setPieces(newPieces);
      setIsLoading(false);
      setCompleted(false);
      showMessage(`Started new puzzle with ${newPieces.length} pieces!`, 'info');
    };

    img.onerror = () => {
      setIsLoading(false);
      showMessage('Failed to load image. Please try again.', 'error');
    };
    img.src = imageUrl;
  }, [difficulty, imageUrl, showMessage]);

  useEffect(() => {
    initializePuzzle();
  }, [initializePuzzle]);

  useEffect(() => {
    if (correctPlacements.size === pieces.length && pieces.length > 0) {
      setCompleted(true);
      onComplete?.();
      showMessage('Puzzle completed! Congratulations!', 'success', 0);
    }
  }, [correctPlacements, pieces.length, onComplete]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!completed && !isLoading) {
        setTimeElapsed(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [completed, isLoading]);

  const handleDragStart = (e, piece) => {
    setDraggedPiece(piece);
    setSelectedPiece(piece);
    e.dataTransfer.setData('piece', JSON.stringify(piece));
  };

  const handleDragEnd = () => {
    setDraggedPiece(null);
  };

  const handleDrop = (e, targetX, targetY) => {
    e.preventDefault();
    const draggedPiece = JSON.parse(e.dataTransfer.getData('piece'));

    setPieces(prevPieces => {
      const newPieces = prevPieces.map(p => {
        if (p.id === draggedPiece.id) {
          const isCorrect = isPieceCorrect(p, targetX, targetY);

          if (isCorrect) {
            setCorrectPlacements(prev => new Set(prev).add(p.id));
            showMessage('Piece placed correctly!', 'success');
            onPiecePlace?.();
          } else {
            setCorrectPlacements(prev => {
              const newSet = new Set(prev);
              newSet.delete(p.id);
              return newSet;
            });
          }

          return {
            ...p,
            current: { x: targetX, y: targetY }
          };
        }

        if (p.current.x === targetX && p.current.y === targetY) {
          const isCorrect = isPieceCorrect(p, draggedPiece.current.x, draggedPiece.current.y);

          if (!isCorrect) {
            setCorrectPlacements(prev => {
              const newSet = new Set(prev);
              newSet.delete(p.id);
              return newSet;
            });
          }

          return {
            ...p,
            current: draggedPiece.current
          };
        }
        return p;
      });
      return newPieces;
    });
  };

  const handleRotate = (direction) => {
    if (!selectedPiece) return;

    setPieces(prev => prev.map(p => {
      if (p.id === selectedPiece.id) {
        const newRotation = p.rotation + (direction === 'left' ? -90 : 90);
        const isCorrect = isPieceCorrect({ ...p, rotation: newRotation }, p.current.x, p.current.y);

        if (isCorrect) {
          setCorrectPlacements(prev => new Set(prev).add(p.id));
          showMessage('Piece rotated correctly!', 'success');
        } else {
          setCorrectPlacements(prev => {
            const newSet = new Set(prev);
            newSet.delete(p.id);
            return newSet;
          });
        }

        return {
          ...p,
          rotation: newRotation
        };
      }
      return p;
    }));
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (completed) {
      try {
        const statsRef = collection(db, 'puzzle_stats');
        await addDoc(statsRef, {
          completedAt: new Date(),
          difficulty,
          timeElapsed,
          totalPieces: pieces.length,
          imageUrl
        });
        showMessage('Progress saved!', 'success');
      } catch (error) {
        showMessage('Failed to save progress', 'error');
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      <div className="w-full flex flex-wrap justify-between items-center gap-4">
        <div className="flex gap-2">
          <button
            className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50"
            onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.5))}
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50"
            onClick={() => setZoom(prev => Math.min(prev + 0.2, 2))}
            disabled={zoom >= 2}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50"
            onClick={() => handleRotate('left')}
            disabled={!selectedPiece}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50"
            onClick={() => handleRotate('right')}
            disabled={!selectedPiece}
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            className="p-2 border rounded hover:bg-gray-100 flex items-center gap-2"
            onClick={initializePuzzle}
          >
            <RefreshCw className="h-4 w-4" />
            <span>Reset</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Difficulty:</span>
          <input
            type="range"
            min="2"
            max="5"
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className="w-32"
          />
          <span className="text-sm font-medium">{difficulty}x{difficulty}</span>
        </div>
      </div>

      {message && (
        <div className={`w-full p-3 rounded text-center ${messageType === 'error' ? 'bg-red-100 text-red-700' :
          messageType === 'success' ? 'bg-green-100 text-green-700' :
            'bg-blue-100 text-blue-700'
          }`}>
          {message}
        </div>
      )}

      <div className="w-full flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-48 flex flex-col items-center gap-2">
          <div className="text-sm font-medium">Target Image</div>
          <div
            className="w-48 h-48 rounded-lg overflow-hidden shadow-md"
            style={{
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          <div className="text-sm text-gray-600">Time: {formatTime(timeElapsed)}</div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-lg font-semibold">Loading puzzle...</div>
            </div>
          ) : (
            <div className="relative"
              ref={(el) => {
                if (el && (gridDimensions.width !== el.offsetWidth || gridDimensions.height !== el.offsetHeight)) {
                  setGridDimensions({
                    width: el.offsetWidth,
                    height: el.offsetWidth
                  });
                }
              }}>
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${difficulty}, 1fr)`,
                  aspectRatio: '1/1',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left'
                }}
              >
                {Array.from({ length: difficulty * difficulty }).map((_, index) => {
                  const x = index % difficulty;
                  const y = Math.floor(index / difficulty);
                  return (
                    <div
                      key={`cell-${x}-${y}`}
                      className="relative bg-gray-100 aspect-square"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, x, y)}
                      ref={(el) => {
                        if (el && (cellDimensions.width !== el.offsetWidth || cellDimensions.height !== el.offsetHeight)) {
                          setCellDimensions({
                            width: el.offsetWidth,
                            height: el.offsetHeight
                          });
                        }
                      }}
                    >
                      {pieces.map(piece => {
                        if (piece.current.x !== x || piece.current.y !== y) return null;

                        const isCorrectlyPlaced = correctPlacements.has(piece.id);

                        return (
                          <div
                            key={piece.id}
                            draggable
                            onClick={() => setSelectedPiece(selectedPiece?.id === piece.id ? null : piece)}
                            onDragStart={(e) => handleDragStart(e, piece)}
                            onDragEnd={handleDragEnd}
                            className={`absolute inset-0 cursor-move transition-all duration-200
                              ${isCorrectlyPlaced ? 'ring-2 ring-green-500' : ''}
                              ${selectedPiece?.id === piece.id ? 'ring-2 ring-blue-500' : ''}
                              ${draggedPiece?.id === piece.id ? 'opacity-50' : ''}`}
                            style={{
                              backgroundImage: `url(${imageUrl})`,
                              backgroundSize: `${gridDimensions.width}px ${gridDimensions.height}px`,
                              backgroundPosition: `-${piece.dimensions.offsetX}px -${piece.dimensions.offsetY}px`,
                              transform: `rotate(${piece.rotation}deg)`,
                              transformOrigin: 'center'
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full flex justify-between items-center">
        <div className="flex gap-4 text-sm">
          <div>Total Pieces: {pieces.length}</div>
          <div>Correctly Placed: {correctPlacements.size}</div>
          <div>Remaining: {pieces.length - correctPlacements.size}</div>
        </div>

        {completed && (
          <button
            onClick={handleSubmit}
            className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Submit
          </button>
        )}
      </div>
    </div>
  );
};

export default EnhancedPuzzle;