import { Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { isAdminAuthenticated } from '../utils/adminAuth';

type Props = {
  children: ReactElement;
};

function AdminProtectedRoute({ children }: Props) {
  if (!isAdminAuthenticated()) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export default AdminProtectedRoute;
