import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Auth from './components/Auth';
import Home from './components/Home';
import PrivateRoute from './components/PrivateRoute';
import MultiplayerManager from './components/MultiplayerManager';
import Leaderboard from './components/Leaderboard';
import Navbar from './components/Navbar';
import CustomUserPuzzle from './components/CustomUserPuzzle';
import CustomCulturalPuzzle from './components/CustomCulturalPuzzle';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import { nanoid } from 'nanoid';
import CollaborativePuzzle from './components/CollaborativePuzzle';
import PaymentPlans from './components/PaymentPlans';
import PaymentSuccess from './components/PaymentSuccess';
import PaymentCancel from './components/PaymentCancel';

const MultiplayerPuzzle = () => {
  const { gameId } = useParams();
  const userData = JSON.parse(localStorage.getItem('authUser'));

  const isJoining = gameId.startsWith('join_');
  const actualGameId = isJoining ? gameId.replace('join_', '') : gameId;

  return (
    <ErrorBoundary>
      <div className="puzzle-container">
        <MultiplayerManager
          gameId={actualGameId}
          isHost={!isJoining}
          isMultiPlayer={true}
          user={userData}
          key={actualGameId}
        />
      </div>
    </ErrorBoundary>
  );
};

const NewMultiplayerGame = () => {
  const gameId = nanoid(6);
  const userData = JSON.parse(localStorage.getItem('authUser'));

  return (
    <ErrorBoundary>
      <div className="puzzle-container">
        <MultiplayerManager
          gameId={gameId}
          isHost={true}
          isMultiPlayer={true}
          user={userData}
          key={gameId}
        />
      </div>
    </ErrorBoundary>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        };
        setUser(userData);
        localStorage.setItem('authUser', JSON.stringify(userData));
      } else {
        setUser(null);
        localStorage.removeItem('authUser');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="App min-h-screen bg-gray-50">
        {user && <Navbar user={user} />}
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route
              path="/auth"
              element={user ? <Navigate to="/" replace /> : <Auth />}
            />

            <Route
              path="/"
              element={user ? <Home user={user} /> : <Navigate to="/auth" replace />}
            />

            <Route
              path="/puzzle/custom"
              element={<PrivateRoute element={CustomUserPuzzle} />}
            />
            <Route
              path="/puzzle/cultural"
              element={<PrivateRoute element={CustomCulturalPuzzle} />}
            />

            <Route
              path="/puzzle/multiplayer/new"
              element={<PrivateRoute element={NewMultiplayerGame} />}
            />
            <Route
              path="/puzzle/multiplayer/:gameId"
              element={
                <CollaborativePuzzle
                  mode="play"
                />
              }
            />

            <Route
              path="/payment-plans"
              element={<PrivateRoute element={() => <PaymentPlans user={user} />} />}
            />
            <Route
              path="/payment-success"
              element={<PrivateRoute element={PaymentSuccess} />}
            />
            <Route
              path="/payment-cancel"
              element={<PrivateRoute element={PaymentCancel} />}
            />

            <Route
              path="/leaderboard"
              element={<PrivateRoute element={Leaderboard} />}
            />
            <Route
              path="/user-leaderboard"
              element={
                <PrivateRoute
                  element={() =>
                    <Leaderboard
                      puzzleId={user?.uid}
                      userId={user?.uid}
                    />
                  }
                />
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <Toaster position="top-right" />
    </HashRouter>
  );
};

export default App;