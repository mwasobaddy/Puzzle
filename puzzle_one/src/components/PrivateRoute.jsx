import React from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from '../firebase';

const PrivateRoute = ({ element: Component, ...rest }) => {
  const isAuthenticated = auth.currentUser || localStorage.getItem('authUser');

  return isAuthenticated ? (
    <Component {...rest} />
  ) : (
    <Navigate to="/auth" replace />
  );
};

export default PrivateRoute;