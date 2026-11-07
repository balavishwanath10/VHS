import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export const Settings = () => {
  const { user } = useAuth();

  return (
    <div className="container">
      <div className="card">
        <h1>Settings</h1>
        <p className="subtitle">Account and profile preferences ({user?.email})</p>
      </div>
    </div>
  );
};

export default Settings;
