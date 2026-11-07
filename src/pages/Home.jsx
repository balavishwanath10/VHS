import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';

export const Home = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    api
      .get('/posts')
      .then((res) => {
        if (isMounted) {
          setPosts(res.data.posts || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load posts');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="container home-container">
      <header className="page-header">
        <h1>Recent Developer Stories</h1>
        <p className="subtitle">
          Read, write, and deepen your developer knowledge on VHS.
        </p>
      </header>

      {loading && (
        <div className="feed-loading">
          <p>Loading stories...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <p>Error loading feed: {error}</p>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="card empty-feed">
          <h3>No published stories found</h3>
          <p>There are no stories published yet. Be the first to share your thoughts!</p>
          <Link to="/editor/new" className="btn btn-primary">
            Write a Story
          </Link>
        </div>
      )}

      {!loading && !error && posts.length > 0 && (
        <div className="posts-feed">
          {posts.map((post) => (
            <article key={post._id} className="card post-feed-card">
              {post.coverImage && (
                <div className="post-card-cover">
                  <Link to={`/post/${post.slug}`}>
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="cover-img"
                      loading="lazy"
                    />
                  </Link>
                </div>
              )}

              <div className="post-card-body">
                <div className="post-author-row">
                  {post.author?.avatarUrl ? (
                    <img
                      src={post.author.avatarUrl}
                      alt={post.author.name}
                      className="author-avatar"
                    />
                  ) : (
                    <div className="author-avatar-fallback">
                      {post.author?.name ? post.author.name[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <div className="author-meta">
                    <span className="author-name">{post.author?.name || 'Anonymous'}</span>
                    <span className="post-date">
                      {new Date(post.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                <h2 className="post-card-title">
                  <Link to={`/post/${post.slug}`}>{post.title}</Link>
                </h2>

                <p className="post-card-excerpt">{post.excerpt}</p>

                {post.tags && post.tags.length > 0 && (
                  <div className="post-card-tags">
                    {post.tags.map((tag) => (
                      <Link
                        key={tag._id || tag.slug}
                        to={`/tag/${tag.slug}`}
                        className="tag-pill"
                      >
                        #{tag.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
