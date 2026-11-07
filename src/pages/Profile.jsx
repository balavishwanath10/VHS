import React from 'react';
import { useParams } from 'react-router-dom';

export const Profile = () => {
  const { id } = useParams();

  return (
    <div className="container">
      <div className="card">
        <h1>User Profile</h1>
        <p className="subtitle">Developer profile view ({id})</p>
      </div>
    </div>
  );
};

export default Profile;
