import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { database, ref, set, update, onValue, remove } from '../firebase';
import { Camera, Copy, Users, ArrowLeft, Play, Mail, Share2, LayoutTemplate, Square, Maximize, Minimize, Gamepad2, Box } from 'lucide-react';
import MultiplayerManager from './MultiplayerManager';
import { toast } from 'react-hot-toast';
import ErrorBoundary from './ErrorBoundary';
import { PUZZLE_TYPES } from '../constants/puzzleTypes';
import { saveRedirectPath } from '../utils/authRedirect';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const CollaborativePuzzle = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState({});
  const [image, setImage] = useState(null);
  const [inviteLink, setInviteLink] = useState('');
  const [showThumbnail, setShowThumbnail] = useState(false);
  const [puzzleType, setPuzzleType] = useState('classic');
  const [joinLink, setJoinLink] = useState('');

  const DIFFICULTY_SETTINGS = {
    easy: { grid: { x: 3, y: 2 }, snapDistance: 0.4, rotationEnabled: false },
    medium: { grid: { x: 4, y: 3 }, snapDistance: 0.3, rotationEnabled: true },
    hard: { grid: { x: 5, y: 4 }, snapDistance: 0.2, rotationEnabled: true },
    expert: { grid: { x: 6, y: 5 }, snapDistance: 0.15, rotationEnabled: true }
  };

  const userData = JSON.parse(localStorage.getItem('authUser'));
  const userId = userData?.uid;
  const userName = userData?.displayName || userData?.email;

  const isJoining = gameId.includes('join_');
  const actualGameId = isJoining ? gameId.replace('join_', '') : gameId;
  const isHost = !isJoining;

  useEffect(() => {
    const auth = localStorage.getItem('authUser');
    if (!auth) {
      const fullPath = window.location.pathname + window.location.hash;
      const cleanPath = fullPath.replace(/^\/|^#\/|puzzle\/multiplayer\//g, '');
      saveRedirectPath(`/puzzle/multiplayer/${cleanPath}`);
      navigate('/login');
      return;
    }
  }, [navigate]);

  useEffect(() => {
    if (!actualGameId || !userId) return;

    setLoading(true);
    const gameRef = ref(database, `games/${actualGameId}`);
    const playersRef = ref(database, `games/${actualGameId}/players`);

    const gameListener = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);
        if (data.image) setImage(data.image);
      }
      setLoading(false);
    }, (error) => {
      console.error('Game fetch error:', error);
      setError('Failed to load game');
      setLoading(false);
    });

    const playersListener = onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setPlayers(data);
    });

    const initializeGame = async () => {
      if (isHost) {
        try {
          await set(gameRef, {
            createdAt: Date.now(),
            hostId: userId,
            status: 'waiting',
            puzzleType: puzzleType,
            players: {
              [userId]: {
                id: userId,
                name: userName,
                isHost: true,
                joinedAt: Date.now(),
                isOnline: true
              }
            }
          });

          const baseUrl = window.location.origin + window.location.pathname;
          setInviteLink(`${baseUrl}#/puzzle/multiplayer/join_${actualGameId}`);
        } catch (error) {
          console.error('Game creation error:', error);
          setError('Failed to create game');
        }
      }
    };

    const joinGame = async () => {
      if (!isHost) {
        try {
          const playerRef = ref(database, `games/${actualGameId}/players/${userId}`);
          await set(playerRef, {
            id: userId,
            name: userName,
            isHost: false,
            joinedAt: Date.now(),
            isOnline: true
          });
        } catch (error) {
          console.error('Join game error:', error);
          setError('Failed to join game');
        }
      }
    };

    if (isHost) {
      initializeGame();
    } else {
      joinGame();
    }

    return () => {
      gameListener();
      playersListener();

      if (!isHost) {
        remove(ref(database, `games/${actualGameId}/players/${userId}`));
      }
    };
  }, [actualGameId, userId, isHost, userName, puzzleType]);

  useEffect(() => {
    if (!actualGameId) return;

    const puzzleTypeRef = ref(database, `games/${actualGameId}/puzzleType`);
    const puzzleTypeListener = onValue(puzzleTypeRef, (snapshot) => {
      const type = snapshot.val();
      if (type) setPuzzleType(type);
    });

    return () => puzzleTypeListener();
  }, [actualGameId]);

  const handleImageUpload = async (event) => {
    if (!isHost || !event.target.files[0]) return;

    const file = event.target.files[0];
    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    try {
      const storage = getStorage();
      const fileRef = storageRef(storage, `game_images/${actualGameId}/${file.name}`);

      await uploadBytes(fileRef, file);

      const imageUrl = await getDownloadURL(fileRef);

      await update(ref(database, `games/${actualGameId}`), {
        image: imageUrl,
        uploadedAt: Date.now()
      });

      setImage(imageUrl);
      toast.success('Image uploaded successfully');

    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Failed to upload image: ' + error.message);
    }
  };

  const updatePuzzleType = async (newType) => {
    if (!isHost) {
      toast.error('Only the host can change puzzle type');
      return;
    }

    if (!PUZZLE_TYPES[newType]) {
      toast.error('Invalid puzzle type');
      return;
    }

    try {
      await update(ref(database, `games/${actualGameId}`), {
        puzzleType: newType,
        lastUpdated: Date.now()
      });
      setPuzzleType(newType);
      toast.success(`Changed to ${PUZZLE_TYPES[newType].name} format`);
    } catch (error) {
      console.error('Failed to update puzzle type:', error);
      toast.error('Failed to change puzzle type');
    }
  };

  const handleDifficultyChange = async (newDifficulty) => {
    if (gameState === 'playing') {
      const confirmChange = window.confirm('Changing difficulty will reset the current puzzle for all players. Continue?');
      if (!confirmChange) return;
    }

    if (!isHost) {
      toast.error('Only the host can change difficulty');
      return;
    }

    setSelectedDifficulty(newDifficulty);

    try {
      await update(ref(database, `games/${actualGameId}`), {
        difficulty: newDifficulty.id,
        lastUpdated: Date.now()
      });

      puzzlePiecesRef.current.forEach(piece => {
        if (sceneRef.current) {
          sceneRef.current.remove(piece);
        }
      });
      puzzlePiecesRef.current = [];

      if (image) {
        setLoading(true);
        setGameState('initial');
        setIsTimerRunning(false);
        setCompletedPieces(0);
        setProgress(0);
        setTimeElapsed(0);

        await createPuzzlePieces(image);
        setLoading(false);
        setGameState('playing');
        setIsTimerRunning(true);
      }
    } catch (error) {
      console.error('Failed to update difficulty:', error);
      toast.error('Failed to change difficulty');
    }
  };

  const handleStartGame = async () => {
    if (!isHost || !image) return;

    try {
      await update(ref(database, `games/${actualGameId}`), {
        status: 'playing',
        startedAt: Date.now()
      });
      toast.success('Game started!');
    } catch (error) {
      console.error('Game start error:', error);
      toast.error('Failed to start game');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success('Invite link copied!');
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent('Join my Puzzle Game!');
    const body = encodeURIComponent(`Hey! Join my puzzle game: ${inviteLink}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`Hey! Join my puzzle game: ${inviteLink}`);
    window.open(`https://wa.me/?text=${text}`);
  };

  const handleFacebookShare = () => {
    const text = encodeURIComponent(`Hey! Join my puzzle game: ${inviteLink}`);
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink)}&quote=${text}`;
    window.open(url, '_blank');
  };

  const handleTwitterShare = () => {
    const text = encodeURIComponent(`Hey! Join my puzzle game: ${inviteLink}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`);
  };

  const handleLinkedInShare = () => {
    const text = encodeURIComponent(`Hey! Join my puzzle game: ${inviteLink}`);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(inviteLink)}&summary=${text}`);
  };

  const handleInstagramShare = () => {
    window.open(`https://www.instagram.com/?url=${encodeURIComponent(inviteLink)}`);
  };

  const handleJoinByLink = (e) => {
    e.preventDefault();
    const linkPattern = /join_([a-zA-Z0-9_-]+)$/;
    const match = joinLink.match(linkPattern);

    if (!match) {
      toast.error('Invalid game link');
      return;
    }

    const gameId = match[1];
    navigate(`/puzzle/multiplayer/join_${gameId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
        <div className="animate-bounce p-4 bg-white/10 backdrop-blur-lg rounded-full">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-t-blue-500 border-white"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-900 via-pink-900 to-orange-900">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-2xl max-w-md w-full mx-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/puzzle/multiplayer')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <ArrowLeft size={20} />
              <span>Back to Games</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState?.status === 'playing' && image) {
    console.log('Transitioning to game with image:', image);
    return (
      <ErrorBoundary>
        <MultiplayerManager
          gameId={actualGameId}
          isHost={isHost}
          user={userData}
          image={image}
          puzzleType={puzzleType}
        />
      </ErrorBoundary>
    );
  }

  const puzzleTypes = [
    {
      id: 'classic',
      icon: <Square size={20} />,
      label: 'Classic (4:3)',
      emoji: '🟥',
      description: 'Standard rectangle format'
    },
    {
      id: 'vertical',
      icon: <Maximize size={20} />,
      label: 'Vertical (2:3)',
      emoji: '📱',
      description: 'Tall rectangular format'
    },
    {
      id: 'panoramic',
      icon: <LayoutTemplate size={20} />,
      label: 'Panoramic (16:9)',
      emoji: '🖼️',
      description: 'Wide rectangular format'
    },
    {
      id: 'square',
      icon: <Square size={20} />,
      label: 'Square (1:1)',
      emoji: '⬛',
      description: 'Perfect square format'
    },
    {
      id: 'portrait',
      icon: <Maximize size={20} />,
      label: 'Portrait (3:5)',
      emoji: '📲',
      description: 'Very tall format'
    },
    {
      id: 'landscape',
      icon: <LayoutTemplate size={20} />,
      label: 'Landscape (21:9)',
      emoji: '🌅',
      description: 'Very wide format'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-4 md:p-6 mb-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent flex items-center gap-3">
                <Gamepad2 className="w-8 h-8 text-blue-400" />
                {isHost ? '🎮 Create New Game' : '🎮 Join Game'}
              </h1>
              <button
                onClick={() => navigate('/')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <ArrowLeft size={20} />
                <span>Back</span>
              </button>
            </div>

            {isHost && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <span className="text-white whitespace-nowrap flex items-center gap-2">
                  <Box className="w-5 h-5" />
                  Puzzle Type:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 w-full">
                  {puzzleTypes.map(type => (
                    <button
                      key={type.id}
                      onClick={() => updatePuzzleType(type.id)}
                      className={`px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${puzzleType === type.id
                        ? 'bg-blue-500 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-purple-900'
                        : 'bg-white/10 text-white/70 hover:bg-white/20 hover:scale-105'
                        }`}
                    >
                      {type.icon}
                      <span className="hidden sm:inline">{type.label}</span>
                      <span className="sm:hidden">{type.emoji}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {!isHost && !gameId && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-4 md:p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Share2 className="w-6 h-6 text-blue-400" />
              Join by Link
            </h2>
            <form onSubmit={handleJoinByLink} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={joinLink}
                onChange={(e) => setJoinLink(e.target.value)}
                placeholder="Paste invite link here..."
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                <span>Join Game</span>
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
          <div className="space-y-4 md:space-y-8">
            {isHost && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-4 md:p-6 hover:shadow-blue-500/20 transition-all">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Camera className="w-6 h-6 text-blue-400" />
                  Upload Puzzle Image
                </h2>
                {!image ? (
                  <label className="flex flex-col items-center justify-center w-full h-36 md:h-48 border-2 border-dashed border-white/30 rounded-xl cursor-pointer hover:bg-white/5 transition-all group">
                    <Camera size={32} className="text-white/70 mb-2 group-hover:scale-110 transition-all" />
                    <span className="text-white/70">Click to upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative rounded-xl overflow-hidden group">
                    <img src={image} alt="Puzzle" className="w-full h-36 md:h-48 object-contain" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                      <button
                        onClick={() => setImage(null)}
                        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transform hover:scale-110 transition-all"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isHost && inviteLink && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-4 md:p-6 hover:shadow-green-500/20 transition-all">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="w-6 h-6 text-green-400" />
                  Invite Players
                </h2>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="w-full sm:w-auto px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                    >
                      <Copy size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={handleEmailShare}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white rounded-lg transform hover:scale-105 transition-all"
                    >
                      <Mail size={20} />
                      <span>Email</span>
                    </button>

                    <button
                      onClick={handleWhatsAppShare}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg transform hover:scale-105 transition-all"
                    >
                      <Share2 size={20} />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={handleFacebookShare}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg transform hover:scale-105 transition-all"
                    >
                      <Share2 size={20} />
                      <span>Facebook</span>
                    </button>

                    <button
                      onClick={handleTwitterShare}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-300 hover:to-blue-400 text-white rounded-lg transform hover:scale-105 transition-all"
                    >
                      <Share2 size={20} />
                      <span>Twitter</span>
                    </button>

                    <button
                      onClick={handleLinkedInShare}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transform hover:scale-105 transition-all"
                    >
                      <Share2 size={20} />
                      <span>LinkedIn</span>
                    </button>

                    <button
                      onClick={handleInstagramShare}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transform hover:scale-105 transition-all"
                    >
                      <Share2 size={20} />
                      <span>Instagram</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 md:space-y-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-4 md:p-6 hover:shadow-purple-500/20 transition-all">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-xl font-bold text-white">Players</h2>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg">
                  <Users size={20} className="text-white" />
                  <span className="text-white">{Object.keys(players).length}</span>
                </div>
              </div>
              <div className="grid gap-2">
                {Object.values(players).map(player => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                  >
                    <div className={`w-3 h-3 rounded-full ${player.isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
                      }`} />
                    <span className="flex-1 text-white">{player.name}</span>
                    {player.isHost && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs font-medium rounded">HOST</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isHost && image && (
              <button
                onClick={handleStartGame}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white rounded-xl hover:scale-105 transition-all hover:shadow-lg hover:shadow-green-500/20"
              >
                <Play size={24} className="animate-pulse" />
                <span className="text-lg font-bold">Start Game</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollaborativePuzzle;