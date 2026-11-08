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
              <Link to="/settings" className="nav-link">
                Settings
              </Link>
              <Link to={`/profile/${user?._id || user?.id}`} className="nav-user" title="View Profile">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="nav-avatar" />
                ) : (
                  <span className="nav-user-initial">
                    {user?.name ? user.name[0].toUpperCase() : 'U'}
                  </span>
                )}
                <span className="nav-username">{user?.name}</span>
              </Link>
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
