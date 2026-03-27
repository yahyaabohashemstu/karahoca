import React from 'react';
import { Navigate } from 'react-router-dom';
import { hasValidToken } from '../utils/adminApi';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!hasValidToken()) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
};

