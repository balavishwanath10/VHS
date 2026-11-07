import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';

export const Home = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/posts')
      .then((res) => {
        setPosts(res.data.posts || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="container">
      <header className="page-header">
        <h1>Recent Stories</h1>
        <p className="subtitle">Discover insights and articles from developer peers</p>
      </header>

      {loading && <p>Loading articles...</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && posts.length === 0 && (
        <div className="card">
          <p>No published articles found yet. Be the first to share your knowledge!</p>
          <Link to="/editor/new" className="btn btn-primary">
            Start Writing
          </Link>
        </div>
      )}

      <div className="posts-list">
        {posts.map((post) => (
          <article key={post._id} className="card post-card">
            <h2>
              <Link to={`/post/${post.slug}`}>{post.title}</Link>
            </h2>
            <p className="post-excerpt">{post.excerpt}</p>
            <div className="post-meta">
              <span>By {post.author?.name || 'Anonymous'}</span>
              <span> &bull; </span>
              <span>{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default Home;
