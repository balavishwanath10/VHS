import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          VHS
        </Link>

        <div className="nav-links">
          {isAuthenticated ? (
            <>
              <Link to="/editor/new" className="nav-link nav-btn-primary">
                Write
              </Link>
              <Link to="/dashboard" className="nav-link">
                Dashboard
              </Link>
              <div className="nav-user">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="nav-avatar" />
                ) : (
                  <span className="nav-user-initial">
                    {user?.name ? user.name[0].toUpperCase() : 'U'}
                  </span>
                )}
                <span className="nav-username">{user?.name}</span>
              </div>
              <button onClick={handleLogout} className="nav-link nav-btn-logout">
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">
                Log In
              </Link>
              <Link to="/register" className="nav-link nav-btn-primary">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
