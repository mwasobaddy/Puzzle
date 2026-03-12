import React, { useState, useEffect, useCallback, useMemo, memo, useRef, useTransition } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  startAfter,
  limit
} from 'firebase/firestore';
import { ref, get } from 'firebase/database';
import { db, database } from '../firebase';
import { ChevronUp, ChevronDown, Filter, Search, Info, Loader } from 'lucide-react';

const ITEMS_PER_PAGE = 20;
const cache = new Map();

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div className="p-4 text-red-500">Something went wrong. Please try again.</div>;
    }
    return this.props.children;
  }
}

const StatCard = memo(({ title, value, subtitle, className = '' }) => (
  <div className={`rounded-lg shadow p-6 ${className}`}>
    <h3 className="text-lg font-semibold mb-4">{title}</h3>
    <p className="text-3xl font-bold text-blue-600">{value}</p>
    <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
  </div>
));

const DifficultyChart = memo(({ breakdown, darkMode }) => (
  <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
    <h3 className="text-lg font-semibold mb-4">Difficulty Split</h3>
    <div className="space-y-2">
      {Object.entries(breakdown).map(([difficulty, count]) => (
        <div key={difficulty} className="flex justify-between items-center">
          <span className={`px-2 py-1 rounded-full text-xs ${difficulty === '3' ? 'bg-green-100 text-green-800' :
            difficulty === '4' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>{difficulty}x{difficulty}</span>
          <span className="font-medium">{count}</span>
        </div>
      ))}
    </div>
  </div>
));

const FilterControls = memo(({
  selectedDifficulty,
  setSelectedDifficulty,
  searchQuery,
  setSearchQuery,
  darkMode
}) => (
  <div className={`rounded-lg shadow p-4 flex items-center gap-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
    <div className="flex items-center gap-2">
      <Filter className="w-5 h-5 text-gray-500" />
      <span className="font-medium">Filter:</span>
    </div>
    <select
      className={`border rounded-md px-3 py-1.5 ${darkMode ? 'bg-gray-700 text-white' : 'bg-white'}`}
      value={selectedDifficulty}
      onChange={(e) => setSelectedDifficulty(e.target.value)}
    >
      <option value="all">All Difficulties</option>
      <option value="3">3x3</option>
      <option value="4">4x4</option>
      <option value="5">5x5</option>
    </select>
    <div className="flex items-center gap-2 ml-auto">
      <Search className="w-5 h-5 text-gray-500" />
      <input
        type="text"
        placeholder="Search puzzles..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className={`border rounded-md px-3 py-1.5 ${darkMode ? 'bg-gray-700 text-white' : 'bg-white'}`}
      />
    </div>
  </div>
));

const TableHeader = memo(({ onSort, sortConfig, darkMode }) => (
  <thead className={`sticky top-0 z-10 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
    <tr>
      <th className="px-4 py-3 text-left font-medium text-gray-600">Preview</th>
      <th className="px-4 py-3 text-left font-medium text-gray-600">Puzzle</th>
      <th className="px-4 py-3 text-left font-medium text-gray-600">Difficulty</th>
      <th
        className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer"
        onClick={() => onSort('bestTime')}
      >
        Time {sortConfig.field === 'bestTime' && (
          sortConfig.direction === 'asc' ?
            <ChevronUp className="inline w-4 h-4" /> :
            <ChevronDown className="inline w-4 h-4" />
        )}
      </th>
      <th
        className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer"
        onClick={() => onSort('timestamp')}
      >
        Completed {sortConfig.field === 'timestamp' && (
          sortConfig.direction === 'asc' ?
            <ChevronUp className="inline w-4 h-4" /> :
            <ChevronDown className="inline w-4 h-4" />
        )}
      </th>
    </tr>
  </thead>
));

const UserStats = ({ userId }) => {
  const [data, setData] = useState({
    completedPuzzles: [],
    currentPuzzles: [],
    loading: true,
    error: null,
    lastDoc: null,
    hasMore: true
  });
  const [summaryStats, setSummaryStats] = useState({
    totalCompleted: 0,
    bestTime: null,
    averageTime: null,
    completionRate: '0',
    difficultyBreakdown: {},
  });
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [sortConfig, setSortConfig] = useState({ field: 'timestamp', direction: 'desc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [isPending, startTransition] = useTransition();

  const observerRef = useRef(null);
  const lastElementRef = useRef(null);

  // ── user_stats listener (self-heals when connection comes online) ────────────
  useEffect(() => {
    if (!userId) return;
    const statsRef = doc(db, 'user_stats', userId);
    const unsubStats = onSnapshot(
      statsRef,
      (snap) => {
        if (snap.exists()) {
          setSummaryStats(prev => ({
            ...prev,
            totalCompleted: snap.data().completed || 0,
            bestTime: snap.data().bestTime ?? prev.bestTime,
          }));
        }
      },
      () => {} // silence offline errors – data already set from completed_puzzles snapshot
    );
    return () => unsubStats();
  }, [userId]);

  // ── Initial load via onSnapshot (auto-reconnects; never throws "offline") ──────
  useEffect(() => {
    if (!userId) return;
    cache.clear();
    setData(prev => ({ ...prev, loading: true, completedPuzzles: [], lastDoc: null, hasMore: true }));

    const puzzlesQuery = query(
      collection(db, 'completed_puzzles'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(ITEMS_PER_PAGE)
    );

    const unsubscribe = onSnapshot(
      puzzlesQuery,
      async (completedSnap) => {
        try {
          const completedResults = completedSnap.docs.map(docSnap => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              name: d.name || `${d.difficulty}x${d.difficulty} Puzzle`,
              bestTime: d.completionTime,
              difficulty: d.difficulty,
              thumbnail: d.thumbnail || `/api/placeholder/100/100`,
              timestamp: d.timestamp?.toDate()?.toISOString()
            };
          });

          // Fetch secondary data with individual fallbacks so an offline error
          // on either call doesn't abort rendering the puzzle list.
          const [gamesSnap, userStatsSnap] = await Promise.all([
            get(ref(database, 'games')).catch(() => null),
            getDoc(doc(db, 'user_stats', userId)).catch(() => null)
          ]);

          let currentResults = [];
          if (gamesSnap?.exists()) {
            currentResults = Object.entries(gamesSnap.val())
              .filter(([, game]) => game.userId === userId && !game.isCompleted)
              .map(([key, game]) => ({
                id: key,
                name: `${game.difficulty}x${game.difficulty} Puzzle`,
                currentTime: game.currentTime || 0,
                difficulty: game.difficulty,
                thumbnail: game.thumbnail || `/api/placeholder/100/100`,
                startedAt: new Date(game.startTime).toISOString()
              }));
          }

          const difficultyBreakdown = completedResults.reduce((acc, puzzle) => {
            acc[puzzle.difficulty] = (acc[puzzle.difficulty] || 0) + 1;
            return acc;
          }, {});
          const totalTime = completedResults.reduce((sum, puzzle) => sum + (puzzle.bestTime || 0), 0);
          const averageTime = completedResults.length ? Math.round(totalTime / completedResults.length) : null;
          const completionRate = currentResults.length + completedResults.length > 0
            ? (completedResults.length / (currentResults.length + completedResults.length) * 100).toFixed(1)
            : 0;

          setSummaryStats({
            totalCompleted: userStatsSnap?.exists?.() ? userStatsSnap.data().completed || 0 : 0,
            bestTime: userStatsSnap?.exists?.() ? userStatsSnap.data().bestTime : null,
            averageTime,
            completionRate,
            difficultyBreakdown,
          });

          setData({
            completedPuzzles: completedResults,
            currentPuzzles: currentResults,
            loading: false,
            error: null,
            lastDoc: completedSnap.docs[completedSnap.docs.length - 1],
            hasMore: completedResults.length === ITEMS_PER_PAGE
          });
        } catch (err) {
          console.error('Error processing snapshot data:', err);
          setData(prev => ({ ...prev, loading: false, error: 'Failed to load user statistics' }));
        }
      },
      (err) => {
        console.error('Snapshot listener error:', err);
        setData(prev => ({ ...prev, loading: false, error: 'Failed to load user statistics' }));
      }
    );

    return () => unsubscribe();
  }, [userId, selectedDifficulty, searchQuery]);

  // ── Pagination: load more pages (SDK is online by the time user scrolls) ──────
  const loadMore = useCallback(async () => {
    if (!data.lastDoc || !data.hasMore || data.loading || !userId) return;
    setData(prev => ({ ...prev, loading: true }));
    try {
      const moreQuery = query(
        collection(db, 'completed_puzzles'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(ITEMS_PER_PAGE),
        startAfter(data.lastDoc)
      );
      const snap = await getDocs(moreQuery);
      const moreResults = snap.docs.map(docSnap => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: d.name || `${d.difficulty}x${d.difficulty} Puzzle`,
          bestTime: d.completionTime,
          difficulty: d.difficulty,
          thumbnail: d.thumbnail || `/api/placeholder/100/100`,
          timestamp: d.timestamp?.toDate()?.toISOString()
        };
      });
      setData(prev => ({
        ...prev,
        completedPuzzles: [...prev.completedPuzzles, ...moreResults],
        loading: false,
        lastDoc: snap.docs[snap.docs.length - 1],
        hasMore: moreResults.length === ITEMS_PER_PAGE
      }));
    } catch (err) {
      console.error('Error loading more puzzles:', err);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [userId, data.lastDoc, data.hasMore, data.loading]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && data.hasMore && !data.loading) {
          loadMore();
        }
      },
      { threshold: 0.5 }
    );

    if (lastElementRef.current) {
      observer.observe(lastElementRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [data.hasMore, data.loading, data.lastDoc, loadMore]);

  const formatTime = useCallback((seconds) => {
    if (seconds == null) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = String(Math.floor(seconds % 60)).padStart(2, '0');
    const milliseconds = String(seconds).includes('.') ?
      `.${String(seconds).split('.')[1].padEnd(3, '0').slice(0, 2)}` :
      '';
    return `${minutes}:${remainingSeconds}${milliseconds}`;
  }, []);

  const getDifficultyStyle = useCallback((difficulty) => {
    const diffLevel = String(difficulty).toLowerCase();
    switch (true) {
      case diffLevel === '3':
        return 'bg-green-100 text-green-800';
      case diffLevel === '4':
        return 'bg-yellow-100 text-yellow-800';
      case diffLevel === '5':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const handleSort = useCallback((field) => {
    startTransition(() => {
      setSortConfig(prev => ({
        field,
        direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
    });
  }, []);

  const getSortedPuzzles = useCallback((puzzles) => {
    if (!sortConfig.field) return puzzles;
    return [...puzzles].sort((a, b) => {
      if (sortConfig.field === 'timestamp' || sortConfig.field === 'startedAt') {
        const dateA = new Date(a[sortConfig.field]);
        const dateB = new Date(b[sortConfig.field]);
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortConfig.field === 'bestTime' || sortConfig.field === 'currentTime') {
        return sortConfig.direction === 'asc'
          ? (a[sortConfig.field] || 0) - (b[sortConfig.field] || 0)
          : (b[sortConfig.field] || 0) - (a[sortConfig.field] || 0);
      }
      return 0;
    });
  }, [sortConfig]);

  const getFilteredPuzzles = useCallback((puzzles) => {
    let filtered = puzzles;
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(puzzle => String(puzzle.difficulty) === selectedDifficulty);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(puzzle => puzzle.name.toLowerCase().includes(query));
    }
    return filtered;
  }, [selectedDifficulty, searchQuery]);

  const filteredCompletedPuzzles = useMemo(() =>
    getFilteredPuzzles(getSortedPuzzles(data.completedPuzzles)),
    [data.completedPuzzles, getFilteredPuzzles, getSortedPuzzles]
  );

  if (data.error) {
    return (
      <div className={`p-4 ${darkMode ? 'bg-gray-900 text-white' : 'bg-white'}`}>
        <p className="text-red-500">{data.error}</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`space-y-6 p-6 ${darkMode ? 'bg-gray-900 text-white' : 'bg-white'}`}>
        <button
          onClick={() => setDarkMode(prev => !prev)}
          className="fixed top-4 right-4 p-2 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? '🌙' : '☀️'}
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Completed"
            value={summaryStats.totalCompleted}
            subtitle="puzzles completed"
            className={darkMode ? 'bg-gray-800' : 'bg-white'}
          />
          <StatCard
            title="Best Time"
            value={formatTime(summaryStats.bestTime)}
            subtitle="best completion time"
            className={darkMode ? 'bg-gray-800' : 'bg-white'}
          />
          <StatCard
            title="Average Time"
            value={formatTime(summaryStats.averageTime)}
            subtitle="per puzzle"
            className={darkMode ? 'bg-gray-800' : 'bg-white'}
          />
          <StatCard
            title="Completion Rate"
            value={`${summaryStats.completionRate}%`}
            subtitle="puzzles finished"
            className={darkMode ? 'bg-gray-800' : 'bg-white'}
          />
          <DifficultyChart
            breakdown={summaryStats.difficultyBreakdown}
            darkMode={darkMode}
          />
        </div>

        <FilterControls
          selectedDifficulty={selectedDifficulty}
          setSelectedDifficulty={setSelectedDifficulty}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          darkMode={darkMode}
        />

        <div className={`rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Completed Puzzles</h2>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <TableHeader
                  onSort={handleSort}
                  sortConfig={sortConfig}
                  darkMode={darkMode}
                />
                <tbody className="divide-y divide-gray-200">
                  {filteredCompletedPuzzles.map((puzzle, index) => (
                    <tr
                      key={puzzle.id}
                      className={`hover:${darkMode ? 'bg-gray-700' : 'bg-gray-50'} transition-colors`}
                      ref={index === filteredCompletedPuzzles.length - 5 ? lastElementRef : null}
                    >
                      <td className="px-4 py-3">
                        <img
                          src={puzzle.thumbnail}
                          alt={puzzle.name}
                          className="w-12 h-12 rounded object-cover"
                          loading="lazy"
                          fetchPriority="low"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{puzzle.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${getDifficultyStyle(puzzle.difficulty)}`}>
                          {puzzle.difficulty}x{puzzle.difficulty}
                        </span>
                      </td>
                      <td className="px-4 py-3">{formatTime(puzzle.bestTime)}</td>
                      <td className="px-4 py-3">
                        {new Date(puzzle.timestamp).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(data.loading || isPending) && <div className="flex justify-center p-4">
                <Loader className="w-6 h-6 animate-spin" />
              </div>}

              {!data.loading && filteredCompletedPuzzles.length === 0 && (
                <div className="px-4 py-3 text-center text-gray-500">
                  No completed puzzles yet
                </div>
              )}

              {data.hasMore && !data.loading && (
                <div ref={lastElementRef} className="h-4" />
              )}
            </div>
          </div>
        </div>

        <div className={`rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Current Puzzles</h2>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Puzzle</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Difficulty</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Current Time</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.currentPuzzles.map((puzzle) => (
                    <tr key={puzzle.id} className={`hover:${darkMode ? 'bg-gray-700' : 'bg-gray-50'} transition-colors`}>
                      <td className="px-4 py-3 font-medium">{puzzle.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${getDifficultyStyle(puzzle.difficulty)}`}>
                          {puzzle.difficulty}x{puzzle.difficulty}
                        </span>
                      </td>
                      <td className="px-4 py-3">{formatTime(puzzle.currentTime)}</td>
                      <td className="px-4 py-3">
                        {new Date(puzzle.startedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {data.currentPuzzles.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-4 py-3 text-center text-gray-500">
                        No puzzles in progress
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default UserStats;