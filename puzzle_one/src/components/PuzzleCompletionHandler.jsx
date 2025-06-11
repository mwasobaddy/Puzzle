import { getFirestore, collection, addDoc, updateDoc, doc, increment, getDoc, setDoc } from 'firebase/firestore';
import { getDatabase, ref, get, update } from 'firebase/database';

export const handlePuzzleCompletion = async ({
  puzzleId,
  userId,
  playerName,
  startTime,
  difficulty,
  imageUrl,
  timer
}) => {
  console.log('Starting puzzle completion handler with data:', {
    puzzleId,
    userId,
    playerName,
    startTime,
    difficulty,
    timer
  });

  const db = getFirestore();
  const rtdb = getDatabase();

  try {
    const completionTime = timer;
    const timestamp = new Date();

    const scoreData = {
      puzzleId,
      userId,
      playerName,
      completionTime,
      difficulty,
      timestamp,
      imageUrl,
      gameMode: puzzleId.startsWith('multiplayer_') ? 'multiplayer' : 'single',
      timePerPiece: completionTime / (difficulty * difficulty),
      difficultyMultiplier: Math.pow(difficulty, 1.5)
    };
    // console.log('Preparing to save score data:', scoreData);
    const scoreDoc = await addDoc(collection(db, 'puzzle_scores'), scoreData);
    // console.log('Score saved with ID:', scoreDoc.id);

    const puzzleData = {
      puzzleId,
      userId,
      completionTime,
      difficulty,
      timestamp: new Date(),
      thumbnail: imageUrl,
      name: `${difficulty}x${difficulty} Puzzle`
    };
    // console.log('Preparing to save puzzle data:', puzzleData);
    const puzzleDoc = await addDoc(collection(db, 'completed_puzzles'), puzzleData);
    // console.log('Puzzle completion saved with ID:', puzzleDoc.id);

    const updatedPuzzleData = {
      ...puzzleData,
      mode: puzzleId.split('_')[0],
      attemptCount: 1,
      dateCompleted: new Date(),
      category: puzzleId.startsWith('cultural_') ? 'cultural' : 'custom',
      savedThumbnail: imageUrl,
      hasBeenFavorited: false
    };

    await setDoc(doc(db, `user_puzzles/${userId}/saved/${puzzleId}`), {
      ...updatedPuzzleData,
      lastPlayed: new Date(),
      bestTime: completionTime,
      timesPlayed: increment(1)
    }, { merge: true });

    const userStatsRef = collection(db, 'user_stats');
    const userStatDoc = doc(userStatsRef, userId);
    const userStatSnap = await getDoc(userStatDoc);

    if (userStatSnap.exists()) {
      const currentStats = userStatSnap.data();
      const updates = {
        completed: increment(1),
        totalPlayTime: increment(completionTime),
        id: userId,
        lastPlayed: timestamp,
        [`bestTimes.${difficulty}`]: !currentStats.bestTimes?.[difficulty] ||
          completionTime < currentStats.bestTimes[difficulty]
          ? completionTime
          : currentStats.bestTimes[difficulty]
      };

      if (completionTime < 120) {
        updates['achievements.speed_demon'] = true;
      }
      if (difficulty >= 5) {
        updates['achievements.persistent'] = true;
      }

      await updateDoc(userStatDoc, updates);
    } else {
      await setDoc(userStatDoc, {
        completed: 1,
        bestTime: completionTime,
        id: userId
      });
    }

    if (puzzleId) {
      const gameRef = ref(rtdb, `games/${puzzleId}`);
      const updates = {
        isCompleted: true,
        completionTime,
        completedBy: userId,
        completedAt: timestamp.toISOString()
      };
      // console.log('Preparing realtime database updates:', updates);
      await update(gameRef, updates);
      // console.log('Realtime database updated successfully');
    }

    // console.log('Puzzle completion handler finished successfully');
    return {
      success: true,
      completionTime,
      scoreId: scoreDoc.id,
      puzzleDocId: puzzleDoc.id
    };
  } catch (error) {
    throw error;
  }
};

export const isPuzzleComplete = (pieces) => {
  return pieces.every(piece => piece.isPlaced);
};