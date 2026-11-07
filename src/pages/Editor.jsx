import React from 'react';
import { useParams } from 'react-router-dom';

export const Editor = () => {
  const { id } = useParams();

  return (
    <div className="container">
      <div className="card">
        <h1>{id ? `Edit Story (${id})` : 'Create New Story'}</h1>
        <p className="subtitle">Markdown post editor foundation</p>
      </div>
    </div>
  );
};

export default Editor;
