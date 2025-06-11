import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDatabase, ref, set, get, onValue, off } from 'firebase/database';
import { auth } from '../firebase';
import PuzzleViewer from './PuzzleViewer';
import PuzzleImageUploader from './PuzzleImageUploader';
import MultiplayerManager from './MultiplayerManager';
import PuzzlePieceManager from './PuzzlePieceManager';

const PuzzlePage = () => {
  const [puzzleData, setPuzzleData] = useState({
    imageUrl: null,
    dimensions: null,
    pieces: [],
    completed: false,
    players: [],
    hostId: null,
    status: 'initializing'
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const { puzzleId } = useParams();
  const navigate = useNavigate();
  const isHost = puzzleData.hostId === auth.currentUser?.uid;

  useEffect(() => {
    let puzzleRef;

    const initializePuzzle = async () => {
      try {
        setLoading(true);
        const db = getDatabase();

        if (!puzzleId) {
          const newPuzzleId = `puzzle-${Date.now()}`;
          navigate(`/puzzle/${newPuzzleId}`, { replace: true });
          return;
        }

        puzzleRef = ref(db, `puzzles/${puzzleId}`);
        onValue(puzzleRef, (snapshot) => {
          const data = snapshot.val();

          if (data) {
            setPuzzleData(prevData => ({
              ...prevData,
              ...data,
              status: 'active'
            }));
          } else {
            setPuzzleData(prevData => ({
              ...prevData,
              hostId: auth.currentUser?.uid,
              players: [{
                id: auth.currentUser?.uid,
                name: auth.currentUser?.displayName || 'Anonymous',
                isHost: true
              }],
              status: 'new'
            }));
          }
          setLoading(false);
        }, (error) => {
          console.error('Error loading puzzle:', error);
          setError('Failed to load puzzle data');
          setLoading(false);
        });

      } catch (err) {
        console.error('Error initializing puzzle:', err);
        setError('Failed to initialize puzzle');
        setLoading(false);
      }
    };

    initializePuzzle();

    return () => {
      if (puzzleRef) {
        off(puzzleRef);
      }
    };
  }, [puzzleId, navigate]);

  const handleImageProcessed = useCallback(async ({ imageUrl, dimensions }) => {
    try {
      const db = getDatabase();
      const puzzleRef = ref(db, `puzzles/${puzzleId}`);

      const newPuzzleData = {
        imageUrl,
        dimensions,
        hostId: auth.currentUser.uid,
        createdAt: Date.now(),
        status: 'active',
        pieces: [],
        players: [{
          id: auth.currentUser.uid,
          name: auth.currentUser.displayName || 'Anonymous',
          isHost: true
        }],
        completed: false
      };

      await set(puzzleRef, newPuzzleData);
      setPuzzleData(prevData => ({
        ...prevData,
        ...newPuzzleData
      }));
    } catch (err) {
      console.error('Error saving puzzle:', err);
      setError('Failed to save puzzle');
    }
  }, [puzzleId]);

  const handlePieceMove = useCallback(async (pieceId, newPosition, newRotation) => {
    try {
      const db = getDatabase();
      const pieceRef = ref(db, `puzzles/${puzzleId}/pieces/${pieceId}`);
      await set(pieceRef, { position: newPosition, rotation: newRotation });
    } catch (err) {
      console.error('Error updating piece position:', err);
    }
  }, [puzzleId]);

  const handlePiecePlace = useCallback(async (pieceId) => {
    try {
      const db = getDatabase();
      const pieceRef = ref(db, `puzzles/${puzzleId}/pieces/${pieceId}`);
      await set(pieceRef, { ...puzzleData.pieces[pieceId], placed: true });

      const allPiecesPlaced = Object.values(puzzleData.pieces).every(piece => piece.placed);
      if (allPiecesPlaced) {
        const puzzleRef = ref(db, `puzzles/${puzzleId}`);
        await set(puzzleRef, { ...puzzleData, completed: true });
      }
    } catch (err) {
      console.error('Error updating piece status:', err);
    }
  }, [puzzleId, puzzleData]);

  const handlePlayerJoin = useCallback(async (playerData) => {
    try {
      const db = getDatabase();
      const playersRef = ref(db, `puzzles/${puzzleId}/players`);
      const players = [...puzzleData.players, playerData];
      await set(playersRef, players);
    } catch (err) {
      console.error('Error adding player:', err);
    }
  }, [puzzleId, puzzleData.players]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
          <p className="text-red-600 text-center mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="puzzle-page min-h-screen bg-gray-50 p-4">
      {isHost && !puzzleData.imageUrl && (
        <div className="max-w-xl mx-auto pt-8">
          <h2 className="text-2xl font-bold mb-4">Create New Puzzle</h2>
          <PuzzleImageUploader onImageProcessed={handleImageProcessed} />
        </div>
      )}

      <div className="max-w-xl mx-auto pt-8">
        <h2 className="text-2xl font-bold mb-4">Image URL</h2>
        <p className="text-gray-600">{puzzleData.imageUrl}</p>
      </div>

      {puzzleData.imageUrl && (
        <div className="puzzle-container relative">
          <PuzzlePieceManager
            imageUrl={puzzleData.imageUrl}
            dimensions={puzzleData.dimensions}
            onPiecePlace={handlePiecePlace}
            difficulty={3}
            initialDifficulty={3}
          />
        </div>
      )}
    </div>
  );
};

export default PuzzlePage;