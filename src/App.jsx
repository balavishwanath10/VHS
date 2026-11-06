import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get('/api/health')
      .then((response) => {
        setHealthData(response.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="container">
      <header>
        <h1>VHS — Hashnode Platform</h1>
        <p className="subtitle">
          Developer-First Blogging &amp; Publishing Platform (Unified MERN Foundation)
        </p>
      </header>

      <main>
        <div className="card">
          <h2>Application Health &amp; Diagnostics</h2>
          {loading && <p>Checking system health...</p>}
          {error && (
            <div>
              <span className="badge badge-warning">API Warning</span>
              <p>Failed to connect to /api/health: {error}</p>
            </div>
          )}
          {healthData && (
            <div>
              <p>
                <strong>API Status:</strong>{' '}
                <span className="badge badge-success">{healthData.status}</span>
              </p>
              <p>
                <strong>Message:</strong> {healthData.message}
              </p>
              <p>
                <strong>Environment:</strong> {healthData.environment}
              </p>
              <p>
                <strong>Database Status:</strong>{' '}
                <span
                  className={`badge ${
                    healthData.database.connected
                      ? 'badge-success'
                      : 'badge-warning'
                  }`}
                >
                  {healthData.database.status}
                </span>
              </p>
              <pre>{JSON.stringify(healthData, null, 2)}</pre>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Architecture Foundation</h3>
          <ul>
            <li>Unified Single-Process Architecture (Express + Vite)</li>
            <li>Single root package.json</li>
            <li>React 18 + Vite (SPA Client)</li>
            <li>Express 4 REST API (/api prefix)</li>
            <li>Mongoose 8 Database Connector</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default App;
