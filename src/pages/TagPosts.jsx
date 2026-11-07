import React from 'react';
import { useParams } from 'react-router-dom';

export const TagPosts = () => {
  const { slug } = useParams();

  return (
    <div className="container">
      <div className="card">
        <h1>Tag: #{slug}</h1>
        <p className="subtitle">Tag-filtered stories view foundation</p>
      </div>
    </div>
  );
};

export default TagPosts;
