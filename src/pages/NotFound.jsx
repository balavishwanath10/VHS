import React from 'react';
import { Link } from 'react-router-dom';

export const NotFound = () => {
  return (
    <div className="container">
      <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <h1>404 — Page Not Found</h1>
        <p className="subtitle">The page you're looking for does not exist or has been moved.</p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
