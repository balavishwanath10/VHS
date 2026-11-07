import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export const Dashboard = () => {
  const { user } = useAuth();

  return (
    <div className="container">
      <header className="page-header">
        <h1>Dashboard</h1>
        <p className="subtitle">Welcome back, {user?.name || 'Developer'}!</p>
      </header>
      <div className="card">
        <p>This is your personal publishing dashboard foundation.</p>
        <Link to="/editor/new" className="btn btn-primary">
          Write New Post
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
