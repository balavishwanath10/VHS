import React from 'react';
import { useParams } from 'react-router-dom';

export const PostDetail = () => {
  const { slug } = useParams();

  return (
    <div className="container">
      <div className="card">
        <h1>Post: {slug}</h1>
        <p className="subtitle">Single post reading view foundation</p>
      </div>
    </div>
  );
};

export default PostDetail;
