import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import useUserSubscription from '../hooks/useUserSubscription';

const Navbar = ({ user }) => {
  const navigate = useNavigate();
  const subscription = useUserSubscription(auth.currentUser?.uid);
  const isPremium = subscription.planId === "pro" && subscription.status === "active";

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem('authUser');
      navigate('/auth');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="bg-gray-900 text-white p-4">
      <div className="container mx-auto flex items-center justify-between">
        <div className="text-2xl font-bold">
          <Link to="/" className="hover:text-yellow-400 transition-colors">
            Puzzle App
          </Link>
        </div>

        <div className="hidden md:flex space-x-6">
          <Link to="/" className="hover:text-yellow-400 transition-colors">
            Home
          </Link>
          <Link to="/user-leaderboard" className="hover:text-yellow-400 transition-colors">
            Leaderboard
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <span className="hidden md:inline-block text-sm bg-gray-700 py-2 px-4 rounded-full">
                {user.email}
              </span>

              {!isPremium && (
                <button
                  onClick={() => navigate('/payment-plans')}
                  className="bg-yellow-500 hover:bg-yellow-600 text-sm py-2 px-4 rounded-full transition-colors"
                >
                  Go Premium
                </button>
              )}

              <button
                onClick={handleLogout}
                className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition duration-200"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="text-sm bg-yellow-500 hover:bg-yellow-600 py-2 px-4 rounded-full transition-colors"
            >
              Login
            </Link>
          )}
        </div>

        <div className="md:hidden">
          <button
            className="text-yellow-400 focus:outline-none"
            aria-label="Open menu"
            onClick={toggleMobileMenu}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-gray-800 text-white p-4 space-y-4">
          <Link
            to="/"
            className="block hover:text-yellow-400 transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Home
          </Link>
          <Link
            to="/user-leaderboard"
            className="block hover:text-yellow-400 transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Leaderboard
          </Link>

          {user ? (
            <>
              <span className="block text-sm bg-gray-700 py-2 px-4 rounded-full">
                {user.email}
              </span>

              {!isPremium && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/payment-plans');
                  }}
                  className="block w-full bg-yellow-500 hover:bg-yellow-600 text-sm py-2 px-4 rounded-full transition-colors text-center"
                >
                  Go Premium
                </button>
              )}

              <button
                onClick={handleLogout}
                className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition duration-200 w-full md:w-auto"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="block text-sm bg-yellow-500 hover:bg-yellow-600 py-2 px-4 rounded-full transition-colors text-center"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Login
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
