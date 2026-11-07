import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api.js';
import MarkdownRenderer from '../components/MarkdownRenderer.jsx';

export const PostDetail = () => {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setNotFound(false);
    setError(null);

    api
      .get(`/posts/${slug}`)
      .then((res) => {
        if (isMounted) {
          if (res.data && res.data.post) {
            setPost(res.data.post);
          } else {
            setNotFound(true);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          // If 404 or draft not authorized, set notFound
          if (err.message && err.message.toLowerCase().includes('not found')) {
            setNotFound(true);
          } else {
            setError(err.message || 'Failed to load post');
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
      <div className="container">
        <div className="card">
          <p>Loading post...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container not-found-container">
        <div className="card text-center">
          <h2>404 — Story Not Found</h2>
          <p className="subtitle">
            The story you are looking for does not exist or may have been set to private.
          </p>
          <Link to="/" className="btn btn-primary">
            Back to Home Feed
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="alert alert-error">
          <p>{error}</p>
          <Link to="/">Back to Home</Link>
        </div>
      </div>
    );
  }

  if (!post) return null;

  return (
    <article className="container post-detail-container">
      {post.coverImage && (
        <div className="post-detail-cover">
          <img src={post.coverImage} alt={post.title} className="detail-cover-img" />
        </div>
      )}

      <header className="post-detail-header">
        <h1 className="post-detail-title">{post.title}</h1>

        <div className="post-author-bar">
          {post.author?.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt={post.author.name}
              className="author-avatar-lg"
            />
          ) : (
            <div className="author-avatar-lg-fallback">
              {post.author?.name ? post.author.name[0].toUpperCase() : 'U'}
            </div>
          )}
          <div className="author-details">
            <span className="author-name-lg">{post.author?.name || 'Anonymous'}</span>
            <div className="post-submeta">
              <span>
                Published on{' '}
                {new Date(post.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              {post.status === 'draft' && (
                <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>
                  Draft
                </span>
              )}
            </div>
          </div>
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="post-tags-bar">
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
      </header>

      <section className="post-detail-body">
        <MarkdownRenderer content={post.content} />
      </section>

      {post.author?.bio && (
        <footer className="post-author-footer card">
          <h4>About the author</h4>
          <p>{post.author.bio}</p>
        </footer>
      )}
    </article>
  );
};

export default PostDetail;
