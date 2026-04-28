import { useState, useEffect, useCallback, useRef } from 'react';
import { database, ref, onValue, update, set, remove, onDisconnect, get } from '../firebase';
import toast from 'react-hot-toast';

export const useMultiplayerGame = (gameId, isHost = false) => {
  const [players, setPlayers] = useState({});
  const [gameState, setGameState] = useState({
    status: 'waiting',
    isPlaying: false,
    totalPiecesPlaced: 0,
    pieces: {},
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(0);
  const [progress, setProgress] = useState(0);
  const [difficulty, setDifficulty] = useState('easy');
  const [pieces, setPieces] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);

  const userData = JSON.parse(localStorage.getItem('authUser'));
  const userId = userData?.uid;

  useEffect(() => {
    if (!gameId || !userId) return;

    setLoading(true);
    const gameRef = ref(database, `games/${gameId}`);
    const playersRef = ref(database, `games/${gameId}/players`);
    const userRef = ref(database, `games/${gameId}/players/${userId}`);
    const piecesRef = ref(database, `games/${gameId}/pieces`);
    const leaderboardRef = ref(database, `games/${gameId}/leaderboard`);

    try {
      const playerData = {
        id: userId,
        name: userData.displayName || userData.email,
        isHost,
        lastActive: Date.now(),
        isOnline: true
      };

      set(userRef, playerData);

      onDisconnect(userRef).update({
        isOnline: false,
        lastActive: Date.now()
      });

      const gameListener = onValue(gameRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setGameState(prevState => ({
            ...data,
            isPlaying: data.status === 'playing',
            totalPiecesPlaced: data.totalPiecesPlaced || 0,
            pieces: prevState.pieces,
          }));
          setLoading(false);
        } else {
          setError('Game not found');
          setLoading(false);
        }
      }, (error) => {
        console.error('Game state error:', error);
        setError('Failed to load game state');
        setLoading(false);
      });

      const playersListener = onValue(playersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setPlayers(data);
        }
      });

      const piecesListener = onValue(piecesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setPieces(data);
          setGameState(prevState => ({
            ...prevState,
            pieces: data,
          }));
        } else {
          setPieces({});
          setGameState(prevState => ({
            ...prevState,
            pieces: {},
          }));
        }
      });

      const leaderboardListener = onValue(leaderboardRef, (snapshot) => {
        const data = snapshot.val();
        if (data && Array.isArray(data)) {
          setLeaderboard(data.sort((a, b) => b.points - a.points));
        } else if (data && typeof data === 'object') {
          const leaderboardArray = Object.values(data).filter(entry => entry && typeof entry === 'object');
          setLeaderboard(leaderboardArray.sort((a, b) => b.points - a.points));
        } else {
          setLeaderboard([]);
        }
      });

      const timerRef = ref(database, `games/${gameId}/timer`);
      const progressRef = ref(database, `games/${gameId}/progress`);

      const timerListener = onValue(timerRef, (snapshot) => {
        setTimer(snapshot.val() || 0);
      });

      const progressListener = onValue(progressRef, (snapshot) => {
        const newProgress = snapshot.val() || 0;
        setProgress(prevProgress => (newProgress > prevProgress ? newProgress : prevProgress));
      });


      const difficultyRef = ref(database, `games/${gameId}/difficulty`);
      const difficultyListener = onValue(difficultyRef, (snapshot) => {
        setDifficulty(snapshot.val() || 'easy');
      });

      return () => {
        gameListener();
        playersListener();
        piecesListener();
        leaderboardListener();
        timerListener();
        progressListener();
        difficultyListener();
        if (isHost) {
          remove(gameRef);
        } else {
          remove(userRef);
        }
      };

    } catch (error) {
      console.error('Game initialization error:', error);
      setError('Failed to initialize game');
      setLoading(false);
    }
  }, [gameId, userId, isHost]);

  const updateGameState = useCallback(async (newState) => {
    if (!gameId) return;

    try {
      await update(ref(database, `games/${gameId}`), {
        ...newState,
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error('Update game state error:', error);
      setError('Failed to update game state');
      toast.error('Failed to update game state');
    }
  }, [gameId]);

  const updatePiecePosition = useCallback(async (pieceId, position) => {
    if (!gameId || !userId) return;

    try {
      await update(ref(database, `games/${gameId}/pieces/${pieceId}`), {
        ...position,
        lastUpdatedBy: userId,
        lastUpdated: Date.now()
      });

      if (position.isPlaced) {
        await update(ref(database, `games/${gameId}`), {
          totalPiecesPlaced: gameState.totalPiecesPlaced + 1,
        });
      }
    } catch (error) {
      console.error('Update piece position error:', error);
      setError('Failed to update piece position');
      toast.error('Failed to move piece');
    }
  }, [gameId, userId]);

  const syncPuzzleState = useCallback(async (puzzleState) => {
    if (!gameId || !isHost) return;

    try {
      await set(ref(database, `games/${gameId}/puzzle`), {
        ...puzzleState,
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error('Sync puzzle state error:', error);
      setError('Failed to sync puzzle state');
      toast.error('Failed to sync puzzle');
    }
  }, [gameId, isHost]);

  const syncPieceState = useCallback(async (pieceId, pieceData) => {
    if (!gameId || !pieceId) return;

    try {
      await update(ref(database, `games/${gameId}/pieces/${pieceId}`), {
        ...pieceData,
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error('Sync piece state error:', error);
      setError('Failed to sync pieces');
      toast.error('Failed to sync pieces');
    }
  }, [gameId]);

  const setPlayerReady = useCallback(async (ready = true) => {
    if (!gameId || !userId) return;

    try {
      await update(ref(database, `games/${gameId}/players/${userId}`), {
        ready,
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error('Set player ready error:', error);
      setError('Failed to update ready state');
      toast.error('Failed to update ready state');
    }
  }, [gameId, userId]);

  const startGame = useCallback(async () => {
    if (!gameId || !isHost) return;

    try {
      await update(ref(database, `games/${gameId}`), {
        status: 'playing',
        startedAt: Date.now()
      });
    } catch (error) {
      console.error('Start game error:', error);
      setError('Failed to start game');
      toast.error('Failed to start game');
    }
  }, [gameId, isHost]);

  const pauseGame = useCallback(async () => {
    await update(ref(database, `games/${gameId}`), {
      status: 'waiting',
    });
  })

  const endGame = useCallback(async (winner = null) => {
    if (!gameId || !isHost) return;

    try {
      await update(ref(database, `games/${gameId}`), {
        status: 'completed',
        endedAt: Date.now(),
        winner,
      });
    } catch (error) {
      console.error('End game error:', error);
      setError('Failed to end game');
      toast.error('Failed to end game');
    }
  }, [gameId, isHost]);

  const checkGameCompletion = useCallback(() => {
    if (!gameState?.pieces) return false;

    const allPieces = Object.values(gameState.pieces);
    return allPieces.length > 0 && allPieces.every(piece => piece.isPlaced);
  }, [gameState?.pieces]);

  const updateTimer = useCallback(async (newTimer) => {
    if (!gameId) return;

    try {
      await update(ref(database, `games/${gameId}`), {
        timer: newTimer,
      });
    } catch (error) {
      console.error('Update timer error:', error);
      setError('Failed to update timer');
      toast.error('Failed to update timer');
    }
  }, [gameId]);

  const updateProgress = useCallback(async (newProgress) => {
    if (!gameId) return;

    const currentProgressSnapshot = await get(ref(database, `games/${gameId}/progress`));
    const currentProgress = currentProgressSnapshot.val() || 0;

    if (newProgress <= currentProgress) return;

    try {
      await update(ref(database, `games/${gameId}`), { progress: newProgress });
      console.log("✅ Firebase Progress Updated:", newProgress);
    } catch (error) {
      console.error("Failed to update progress:", error);
      toast.error("Failed to update progress");
    }
  }, [gameId]);


  const updateDifficulty = useCallback(async (newDifficulty) => {
    if (!gameId) return;

    try {
      await update(ref(database, `games/${gameId}`), {
        difficulty: newDifficulty,
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error('Update difficulty error:', error);
      setError('Failed to update difficulty');
      toast.error('Failed to update difficulty');
    }
  }, [gameId]);

  const addLeaderboardEntry = useCallback(async (score) => {
    if (!gameId || !score) return;

    try {
      const sanitizedScore = {
        ...score,
        accuracy: isNaN(score.accuracy) ? 0 : score.accuracy,
        points: isNaN(score.points) ? 0 : score.points,
        moveCount: score.moveCount || 0,
        accurateDrops: score.accurateDrops || 0,
        timestamp: Date.now()
      };

      const leaderboardRef = ref(database, `games/${gameId}/leaderboard/${score.userId}`);
      await set(leaderboardRef, sanitizedScore);
      console.log('✅ Leaderboard entry added:', score.userName);
    } catch (error) {
      console.error('Failed to add leaderboard entry:', error);
      toast.error('Failed to update leaderboard');
    }
  }, [gameId]);

  return {
    players,
    gameState,
    pieces,
    leaderboard,
    error,
    loading,
    isHost,
    userId,
    timer,
    progress,
    difficulty,
    isPlaying: gameState?.isPlaying || false,

    updateGameState,
    updatePiecePosition,
    syncPuzzleState,
    syncPieceState,
    setPlayerReady,
    startGame,
    pauseGame,
    endGame,
    checkGameCompletion,
    updateTimer,
    updateProgress,
    updateDifficulty,
    addLeaderboardEntry,

    isGameComplete: checkGameCompletion(),
    isPlayerReady: players[userId]?.ready || false,
    playerCount: Object.keys(players).length,
    allPlayersReady: Object.values(players).every(player => player.ready)
  };
};

export default useMultiplayerGame;