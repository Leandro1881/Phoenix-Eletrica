import React from 'react';
import { ExecutiveDashboard } from './ExecutiveDashboard';
import { ExecutiveDashboardData } from '../types';

export interface AdminDashboardProps {
  data: ExecutiveDashboardData | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  return <ExecutiveDashboard {...props} />;
};

export default AdminDashboard;
