import { collection, addDoc, updateDoc, doc, increment, getDoc, setDoc } from 'firebase/firestore';
import { ref, update } from 'firebase/database';
import { db, database } from '../firebase';

export const handlePuzzleCompletion = async ({
  puzzleId,
  userId,
  playerName,
  difficulty,
  pieceCount,
  imageUrl,
  timer,
  name
}) => {
  console.log('[PCH] handler called', { puzzleId, userId, timer, difficulty });

  if (!userId) {
    console.error('[PCH] userId is missing — aborting completion write');
    return { success: false, reason: 'no userId' };
  }

  try {
    const completionTime = Number.isFinite(timer) ? timer : 0;
    const pieces = Number.isFinite(pieceCount) ? pieceCount : null;
    const difficultyValue = typeof difficulty === 'number'
      ? difficulty
      : (pieces ? Math.sqrt(pieces) : null);

    const safeTimePerPiece = pieces && pieces > 0 ? completionTime / pieces : completionTime;
    const safeDifficultyMultiplier = difficultyValue ? Math.pow(difficultyValue, 1.5) : 1;
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
      timePerPiece: safeTimePerPiece,
      difficultyMultiplier: safeDifficultyMultiplier,
      ...(pieces != null && { pieceCount: pieces }),
      ...(difficultyValue != null && { difficultyValue }),
    };

    console.log('[PCH] writing puzzle_scores...');
    const scoreDoc = await addDoc(collection(db, 'puzzle_scores'), scoreData);
    console.log('[PCH] puzzle_scores written', scoreDoc.id);

    const puzzleData = {
      puzzleId,
      userId,
      completionTime,
      difficulty,
      timestamp: new Date(),
      thumbnail: imageUrl,
      name: name || `${difficulty}x${difficulty} Puzzle`,
      ...(pieces != null && { pieceCount: pieces }),
    };

    console.log('[PCH] writing completed_puzzles...');
    const puzzleDoc = await addDoc(collection(db, 'completed_puzzles'), puzzleData);
    console.log('[PCH] completed_puzzles written', puzzleDoc.id);

    const updatedPuzzleData = {
      ...puzzleData,
      mode: puzzleId.split('_')[0],
      attemptCount: 1,
      dateCompleted: new Date(),
      category: puzzleId.startsWith('cultural_') ? 'cultural' : 'custom',
      savedThumbnail: imageUrl,
      hasBeenFavorited: false
    };

    console.log('[PCH] writing user_puzzles saved...');
    await setDoc(doc(db, `user_puzzles/${userId}/saved/${puzzleId}`), {
        ...updatedPuzzleData,
        lastPlayed: new Date(),
        bestTime: completionTime,
        timesPlayed: increment(1)
    }, { merge: true });

    const userStatDoc = doc(collection(db, 'user_stats'), userId);

    // getDoc can throw "client is offline"; fall back to merge-write in that case.
    let userStatSnap = null;
    try {
      console.log('[PCH] reading user_stats...');
      userStatSnap = await getDoc(userStatDoc);
      console.log('[PCH] user_stats read, exists:', userStatSnap.exists());
    } catch (_offlineErr) {
      console.warn('[PCH] user_stats read failed (offline?), will merge-write:', _offlineErr.message);
      userStatSnap = null;
    }

    if (userStatSnap?.exists()) {
      const currentStats = userStatSnap.data();
      const updates = {
        completed: increment(1),
        totalPlayTime: increment(completionTime),
        id: userId,
        lastPlayed: timestamp,
        bestTime: !currentStats.bestTime || completionTime < currentStats.bestTime
          ? completionTime
          : currentStats.bestTime,
        [`bestTimes.${difficulty}`]: !currentStats.bestTimes?.[difficulty] ||
          completionTime < currentStats.bestTimes[difficulty]
          ? completionTime
          : currentStats.bestTimes[difficulty]
      };

      if (completionTime < 120) updates['achievements.speed_demon'] = true;
      if (difficulty >= 5) updates['achievements.persistent'] = true;

      console.log('[PCH] updating existing user_stats...');
      await updateDoc(userStatDoc, updates);
      console.log('[PCH] user_stats updated');
    } else {
      console.log('[PCH] creating/merging user_stats...');
      await setDoc(userStatDoc, {
          completed: increment(1),
          bestTime: completionTime,
          totalPlayTime: increment(completionTime),
          lastPlayed: timestamp,
          id: userId
      }, { merge: true });
      console.log('[PCH] user_stats created/merged');
    }

    // Only update RTDB for multiplayer games; skip for solo puzzles to avoid
    // an unnecessary network round-trip that could also hang.
    if (puzzleId && puzzleId.startsWith('multiplayer_')) {
      console.log('[PCH] writing RTDB game state...');
      try {
        await update(ref(database, `games/${puzzleId}`), {
            isCompleted: true,
            completionTime,
            completedBy: userId,
            completedAt: timestamp.toISOString()
        });
        console.log('[PCH] RTDB game state written');
      } catch (rtdbErr) {
        console.warn('[PCH] RTDB write failed (non-fatal):', rtdbErr.message);
      }
    }

    console.log('[PCH] all writes complete ✓');
    return {
      success: true,
      completionTime,
      scoreId: scoreDoc.id,
      puzzleDocId: puzzleDoc.id
    };
  } catch (error) {
    console.error('[PCH] handler error:', error);
    throw error;
  }
};

export const isPuzzleComplete = (pieces) => {
  return pieces.every(piece => piece.isPlaced);
};