import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api.js';

export const TagPosts = () => {
  const { slug } = useParams();
  const [tag, setTag] = useState(null);
  const [posts, setPosts] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setNotFound(false);
    setError(null);

    api
      .get(`/tags/${slug}/posts`)
      .then((res) => {
        if (isMounted) {
          if (res.data && res.data.tag) {
            setTag(res.data.tag);
            setPosts(res.data.posts || []);
            setCount(res.data.count || 0);
          } else {
            setNotFound(true);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          if (err.response?.status === 404 || err.message?.includes('not found')) {
            setNotFound(true);
          } else {
            setError(err.message || 'Failed to load stories for this tag');
          }
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <div className="card">
          <p>Loading stories for tag #{slug}...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container" style={{ padding: '3rem 1rem' }}>
        <div className="card text-center">
          <h2>404 — Tag Not Found</h2>
          <p className="subtitle">
            The topic tag <strong>#{slug}</strong> does not exist or has not been created yet.
          </p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Back to Home Feed
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '3rem 1rem' }}>
        <div className="alert alert-error">
          <p>{error}</p>
          <Link to="/">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container tag-posts-container">
      <header className="page-header tag-page-header">
        <h1>#{tag?.name || slug}</h1>
        <p className="subtitle">
          Showing {count} published {count === 1 ? 'story' : 'stories'} in this topic.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="card empty-feed text-center">
          <h3>No published stories yet</h3>
          <p className="subtitle">
            There are currently no published stories tagged with #{tag?.name || slug}.
          </p>
          <Link to="/editor/new" className="btn btn-primary">
            Write the First Story
          </Link>
        </div>
      ) : (
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
                    {post.author?._id ? (
                      <Link to={`/profile/${post.author._id}`} className="author-name">
                        {post.author.name}
                      </Link>
                    ) : (
                      <span className="author-name">{post.author?.name || 'Anonymous'}</span>
                    )}
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
                    {post.tags.map((t) => (
                      <Link
                        key={t._id || t.slug}
                        to={`/tag/${t.slug}`}
                        className={`tag-pill ${t.slug === slug ? 'tag-pill-active' : ''}`}
                      >
                        #{t.name}
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

export default TagPosts;
