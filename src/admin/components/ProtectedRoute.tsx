import React from 'react';
import { Navigate } from 'react-router-dom';
import { getToken } from '../utils/adminApi';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!getToken()) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
};
