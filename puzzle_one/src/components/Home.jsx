import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Joyride, { STATUS } from 'react-joyride';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  limit,
  getDoc
} from 'firebase/firestore';
import { nanoid } from 'nanoid';
import QuickAccess from './QuickAccess';
import toast from 'react-hot-toast';
import { FaPuzzlePiece, FaTrophy, FaClock, FaSignOutAlt, FaChartBar, FaImage, FaGlobe, FaUsers, FaCrown, FaCheck } from 'react-icons/fa';
import UpgradeModalHome from './UpgradeModalHome';

const db = getFirestore();

const getCachedData = (key) => {
  const cachedData = localStorage.getItem(key);
  if (cachedData) {
    const { data, timestamp } = JSON.parse(cachedData);
    if (Date.now() - timestamp < 5 * 60 * 1000) {
      return data;
    }
  }
  return null;
};

const setCachedData = (key, data) => {
  const cache = {
    data,
    timestamp: Date.now()
  };
  localStorage.setItem(key, JSON.stringify(cache));
};

const useUserData = (userId) => {
  const [data, setData] = useState({
    recentPuzzles: [],
    stats: {
      completed: 0,
      bestTime: null,
      averageTime: null
    },
    subscription: { planId: "free", status: "inactive" },
    loading: true,
    error: null
  });

  useEffect(() => {
    if (!userId) return;

    const cachedPuzzles = getCachedData(`recentPuzzles-${userId}`);
    const cachedStats = getCachedData(`userStats-${userId}`);

    if (cachedPuzzles && cachedStats) {
      setData((prev) => ({
        ...prev,
        recentPuzzles: cachedPuzzles,
        stats: cachedStats,
        loading: false,
        error: null
      }));
    }

    const puzzlesRef = collection(db, 'completed_puzzles');
    const puzzlesQuery = query(
      puzzlesRef,
      where('userId', '==', userId),
      orderBy('completionTime', 'desc'),
      limit(3)
    );

    const calculateAverageTime = (puzzles) => {
      if (!puzzles.length) return null;
      const totalTime = puzzles.reduce((sum, puzzle) => sum + puzzle.completionTime, 0);
      return Math.round(totalTime / puzzles.length);
    };

    const unsubscribePuzzles = onSnapshot(puzzlesQuery, (puzzleSnap) => {
      const puzzlesData = puzzleSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).reverse();

      const averageTime = calculateAverageTime(puzzlesData);

      setCachedData(`recentPuzzles-${userId}`, puzzlesData);

      setData((prev) => ({
        ...prev,
        recentPuzzles: puzzlesData,
        stats: {
          ...prev.stats,
          averageTime
        },
        loading: false,
        error: null
      }));
    }, (error) => {
      console.error('Error fetching recent puzzles:', error);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load recent puzzles'
      }));
      toast.error('Failed to load recent puzzles');
    });

    const userStatsRef = doc(db, 'user_stats', userId);
    const unsubscribeStats = onSnapshot(userStatsRef, (userStatsSnap) => {
      if (userStatsSnap.exists()) {
        const statsData = userStatsSnap.data();

        setCachedData(`userStats-${userId}`, statsData);

        setData((prev) => ({
          ...prev,
          stats: {
            ...prev.stats,
            completed: statsData.completed || 0,
            bestTime: statsData.bestTime
          },
          loading: false,
          error: null
        }));
      }
    }, (error) => {
      console.error('Error fetching user stats:', error);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load user stats'
      }));
      toast.error('Failed to load user stats');
    });

    const subscriptionRef = doc(db, 'subscriptions', userId);
    const unsubscribeSubscription = onSnapshot(subscriptionRef, (docSnap) => {
      if (docSnap.exists()) {
        setData((prev) => ({
          ...prev,
          subscription: docSnap.data()
        }));
      } else {
        setData((prev) => ({
          ...prev,
          subscription: { planId: "free", status: "inactive" }
        }));
      }
    });

    return () => {
      unsubscribePuzzles();
      unsubscribeStats();
      unsubscribeSubscription();
    };
  }, [userId]);

  return data;
};

const useUserSubscription = (userId) => {
  const [subscription, setSubscription] = useState({ planId: "free", status: "inactive" });

  useEffect(() => {
    if (!userId) return;

    const subscriptionRef = doc(db, 'subscriptions', userId);
    const unsubscribe = onSnapshot(subscriptionRef, (docSnap) => {
      if (docSnap.exists()) {
        setSubscription(docSnap.data());
      } else {
        setSubscription({ planId: "free", status: "inactive" });
      }
    });

    return () => unsubscribe();
  }, [userId]);

  return subscription;
};



const formatTime = (time) => {
  if (!time) return '--:--';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = String(time.toFixed(3).split('.')[1] || '000').slice(0, 2);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${milliseconds}`;
};

const Home = ({ user }) => {
  const navigate = useNavigate();
  const { recentPuzzles, stats, loading, error } = useUserData(user?.uid);
  const subscription = useUserSubscription(user?.uid);
  const isPremium = subscription.planId === "pro" && subscription.status === "active";
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [incompletePuzzles, setIncompletePuzzles] = useState([]);

  const [runOnboarding, setRunOnboarding] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    {
      target: '.stats-section',
      content: 'Here you can see your puzzle-solving stats!',
      disableBeacon: true,
    },
    {
      target: '.start-puzzle-section',
      content: 'Start a new puzzle by choosing one of these options.',
    },
    {
      target: '.premium-section',
      content: 'Upgrade to Premium to unlock amazing features!',
    },
  ];

  const handleJoyrideCallback = (data) => {
    const { action, index, status, type } = data;

    if (type === "step:after") {
      setStepIndex(index + 1);
    }

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRunOnboarding(false);
      localStorage.setItem("onboardingCompleted", "true");
    }
  };


  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('onboardingCompleted');
    if (!onboardingCompleted) {
      setRunOnboarding(true);
    }
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    const db = getFirestore();
    const incompletePuzzlesRef = collection(db, 'games');
    const incompletePuzzlesQuery = query(
      incompletePuzzlesRef,
      where('userId', '==', user.uid),
      where('state', '==', 'in_progress')
    );

    const unsubscribe = onSnapshot(incompletePuzzlesQuery, (snapshot) => {
      const puzzles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setIncompletePuzzles(puzzles);
    });

    return () => unsubscribe();
  }, [user?.uid]);


  const handleResumePuzzle = async (puzzleId) => {
    const db = getFirestore();
    const gameRef = doc(db, 'games', puzzleId);

    try {
      const gameSnapshot = await getDoc(gameRef);
      if (gameSnapshot.exists()) {
        navigate(`/puzzle/cultural/${puzzleId}`);
      } else {
        toast.error("Puzzle not found. It may have been deleted.");
      }
    } catch (error) {
      console.error("Error fetching puzzle data:", error);
      toast.error("Failed to resume puzzle.");
    }
  };

  useEffect(() => {
    if (isPremium) {
      const interval = setInterval(() => {
        toast.success("Your premium subscription gives you early access to our new African Heritage Puzzle Pack!", {
          icon: <FaCrown className="text-yellow-500" />,
        });
      }, 10 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [isPremium]);

  useEffect(() => {
    if (!isPremium) {
      const interval = setInterval(() => {
        toast.success("Unlock advanced styles with Premium!", {
          icon: <FaCrown className="text-yellow-500" />,
        });
      }, 0.1 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [isPremium]);


  const StatsSection = useMemo(() => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 stats-section">
      <div className="bg-white rounded-lg shadow-lg p-6 transform transition-transform hover:scale-105 hover:shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <FaPuzzlePiece className="mr-2 text-blue-600" /> Puzzles Completed
        </h3>
        <p className="text-3xl font-bold text-blue-600">{stats.completed}</p>
        {!isPremium && stats.completed > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            You’ve completed {stats.completed} puzzles. With <span className="text-yellow-600 font-semibold">Premium</span>, you could access 100+ puzzles!
            <button
              onClick={() => navigate('/payment-plans')}
              className="text-blue-500 underline ml-1 hover:text-blue-700"
            >
              Upgrade Now
            </button>
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 transform transition-transform hover:scale-105 hover:shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <FaTrophy className="mr-2 text-green-600" /> Best Time
        </h3>
        <p className="text-3xl font-bold text-green-600">
          {formatTime(stats.bestTime)}
        </p>
      </div>
      <div className="bg-white rounded-lg shadow-lg p-6 transform transition-transform hover:scale-105 hover:shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <FaClock className="mr-2 text-purple-600" /> Average Time
        </h3>
        <p className="text-3xl font-bold text-purple-600">
          {formatTime(stats.averageTime)}
        </p>
      </div>
    </div>
  ), [stats.completed, stats.bestTime, stats.averageTime]);

  const handleLogout = useCallback(async () => {
    try {
      await auth.signOut();
      localStorage.removeItem('authUser');
      navigate('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    }
  }, [navigate]);

  const handleStartPuzzle = (type) => {

    if (type === 'multiplayer') {
      const gameId = nanoid(6);
      navigate(`/puzzle/multiplayer/${gameId}`);
    } else {
      navigate(`/puzzle/${type}`);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 to-purple-600 relative overflow-hidden">
      <Joyride
        steps={steps}
        run={runOnboarding}
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        continuous={true}
        scrollToFirstStep={true}
        disableOverlayClose={true}
        showProgress={true}
        showSkipButton={true}
        styles={{ options: { primaryColor: "#6366f1" } }}
      />


      <div className="absolute inset-0 z-0">
        <div className="puzzle-bg"></div>
      </div>

      <div className="bg-white shadow-sm md:flex md:items-center md:justify-between md:py-6 md:px-4 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center md:gap-4 pb-5 md:pb-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {user?.displayName || user?.email}!
            </h1>
            <p>Subscription: {isPremium ? "Premium" : "Free"}</p>
            <p className="mt-1 text-sm text-gray-500">
              Ready to solve some puzzles?
            </p>
          </div>
          <div className="hidden md:flex md:gap-2 mt-4 md:mt-0">
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition duration-200 flex items-center transform hover:scale-105"
            >
              <FaSignOutAlt className="mr-2" /> Logout
            </button>
            <button
              onClick={() => navigate('/user-leaderboard')}
              className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition duration-200 flex items-center transform hover:scale-105"
            >
              <FaChartBar className="mr-2" /> Leaderboard
            </button>
          </div>
        </div>
      </div>

      <UpgradeModalHome
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpgrade={() => navigate("/payment-plans")}
      />

      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        {StatsSection}

        <div className="bg-white rounded-lg shadow-lg mb-8 transform transition-transform hover:scale-102 hover:shadow-2xl start-puzzle-section">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Start New Puzzle</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  type: 'custom',
                  title: 'Custom Photo Puzzle',
                  description: 'Upload your own image',
                  bgColor: 'bg-blue-50',
                  hoverColor: 'hover:bg-blue-100',
                  textColor: 'text-blue-600',
                  icon: <FaImage className="text-4xl mb-2 text-blue-600" />
                },
                {
                  type: 'cultural',
                  title: 'Cultural Themes',
                  description: 'Explore pre-designed puzzles',
                  bgColor: 'bg-green-50',
                  hoverColor: 'hover:bg-green-100',
                  textColor: 'text-green-600',
                  icon: <FaGlobe className="text-4xl mb-2 text-green-600" />
                },
                {
                  type: 'multiplayer',
                  title: 'Multiplayer',
                  description: 'Solve with friends',
                  bgColor: 'bg-purple-50',
                  hoverColor: 'hover:bg-purple-100',
                  textColor: 'text-purple-600',
                  icon: <FaUsers className="text-4xl mb-2 text-purple-600" />
                }
              ].map(({ type, title, description, bgColor, hoverColor, textColor, icon }) => (
                <button
                  key={type}
                  onClick={() => handleStartPuzzle(type)}
                  className={`flex flex-col items-center justify-center p-6 ${bgColor} rounded-lg ${hoverColor} transition duration-200 transform hover:scale-105 hover:shadow-lg`}
                >
                  {icon}
                  <div className={`font-semibold ${textColor}`}>{title}</div>
                  <div className="text-sm text-gray-600">{description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <QuickAccess userId={user.uid} />
        </div>

        <div className="bg-white rounded-lg shadow-lg transform transition-transform hover:scale-102 hover:shadow-2xl mt-5">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Incomplete Puzzles
            </h2>
            {incompletePuzzles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {incompletePuzzles.map(puzzle => (
                  <div
                    key={puzzle.id}
                    className="border rounded-lg p-4 hover:shadow-md transition duration-200 transform hover:scale-105"
                  >
                    <img
                      src={puzzle.imageUrl}
                      alt="Puzzle thumbnail"
                      className="w-full h-32 object-contain rounded mb-2"
                      loading="lazy"
                    />
                    <h3 className="font-semibold">{puzzle.difficulty} Difficulty</h3>
                    <p className="text-sm text-gray-600">
                      Progress: {Math.round((puzzle.completedPieces / puzzle.totalPieces) * 100)}%
                    </p>
                    <button
                      onClick={() => handleResumePuzzle(puzzle.id)}
                      className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >

                      Resume
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No incomplete puzzles found.</p>
            )}
          </div>
        </div>


        <div className="bg-white rounded-lg shadow-lg transform transition-transform hover:scale-102 hover:shadow-2xl mt-5">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Puzzles</h2>
            {recentPuzzles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recentPuzzles.map(puzzle => (
                  <div
                    key={puzzle.id}
                    className="border rounded-lg p-4 hover:shadow-md"
                  >
                    <img
                      src={puzzle.thumbnail}
                      alt="Puzzle thumbnail"
                      className="w-full h-32 object-contain rounded mb-2"
                      loading="lazy"
                    />
                    <h3 className="font-semibold">{puzzle.name || 'Puzzle'}</h3>
                    <p className="text-sm text-gray-600">
                      Completed in {formatTime(puzzle.completionTime)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No puzzles completed yet. Start solving!</p>
            )}
          </div>
        </div>

        {!isPremium && (
          <div className="bg-white rounded-lg shadow-lg transform transition-transform hover:scale-102 hover:shadow-2xl mt-8 premium-section">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FaCrown className="text-yellow-500 mr-2" />
                Premium Features
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Unlock Amazing Features</h3>
                  <ul className="space-y-2">
                    <li className="flex items-center text-gray-600">
                      <FaCheck className="text-green-500 mr-2" />
                      Create custom puzzles
                    </li>
                    <li className="flex items-center text-gray-600">
                      <FaCheck className="text-green-500 mr-2" />
                      Access exclusive themes
                    </li>
                    <li className="flex items-center text-gray-600">
                      <FaCheck className="text-green-500 mr-2" />
                      Multiplayer challenges
                    </li>
                  </ul>
                </div>
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => navigate('/payment-plans')}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg shadow-lg hover:from-purple-700 hover:to-blue-700 transform transition-transform hover:scale-105"
                  >
                    View Premium Plans
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Home;