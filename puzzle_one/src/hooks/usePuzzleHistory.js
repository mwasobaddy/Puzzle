import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

export const usePuzzleHistory = (userId) => {
  const [recentPuzzles, setRecentPuzzles] = useState([]);
  const [savedPuzzles, setSavedPuzzles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPuzzleHistory = async () => {
      if (!userId) return;

      try {
        const db = getFirestore();

        const completedRef = collection(db, 'completed_puzzles');
        const recentQuery = query(
          completedRef,
          where('userId', '==', userId),
          orderBy('timestamp', 'desc'),
          limit(10)
        );

        const savedRef = collection(db, `user_puzzles/${userId}/saved`);
        const savedQuery = query(savedRef, orderBy('lastPlayed', 'desc'));

        const [recentSnap, savedSnap] = await Promise.all([
          getDocs(recentQuery),
          getDocs(savedQuery)
        ]);

        setRecentPuzzles(recentSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })));

        setSavedPuzzles(savedSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })));

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchPuzzleHistory();
  }, [userId]);

  return { recentPuzzles, savedPuzzles, loading, error };
};
