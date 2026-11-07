import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';

export const Dashboard = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    api
      .get('/posts/mine')
      .then((res) => {
        if (isMounted) {
          setPosts(res.data.posts || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load your stories');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDelete = async (postId, postTitle) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${postTitle}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(postId);
    setDeleteError(null);

    try {
      await api.delete(`/posts/${postId}`);
      // Remove deleted post from local state without full page refresh
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete post');
    } finally {
      setDeletingId(null);
    }
  };

  const draftCount = posts.filter((p) => p.status === 'draft').length;
  const publishedCount = posts.filter((p) => p.status === 'published').length;

  return (
    <div className="container dashboard-container">
      <header className="page-header dashboard-header">
        <div>
          <h1>My Stories</h1>
          <p className="subtitle">
            Welcome back, {user?.name || 'Developer'}! Manage your drafts and published articles.
          </p>
        </div>
        <div className="dashboard-actions">
          <Link to="/editor/new" className="btn btn-primary">
            Write New Story
          </Link>
        </div>
      </header>

      {deleteError && (
        <div className="alert alert-error">
          <p>{deleteError}</p>
        </div>
      )}

      {loading && (
        <div className="card text-center">
          <p>Loading your stories...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <p>Error: {error}</p>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="card empty-dashboard text-center">
          <h3>You haven't written any stories yet</h3>
          <p className="subtitle">
            Share your technical expertise, tutorials, or engineering experiences with the community.
          </p>
          <Link to="/editor/new" className="btn btn-primary">
            Write Your First Story
          </Link>
        </div>
      )}

      {!loading && !error && posts.length > 0 && (
        <>
          <div className="dashboard-stats-bar">
            <span>
              Total: <strong>{posts.length}</strong>
            </span>
            <span className="stats-separator">•</span>
            <span>
              Published: <strong>{publishedCount}</strong>
            </span>
            <span className="stats-separator">•</span>
            <span>
              Drafts: <strong>{draftCount}</strong>
            </span>
          </div>

          <div className="dashboard-posts-list">
            {posts.map((post) => (
              <article key={post._id} className="card dashboard-post-card">
                <div className="dashboard-card-main">
                  <div className="dashboard-post-header">
                    <span
                      className={`badge ${
                        post.status === 'draft' ? 'badge-draft' : 'badge-published'
                      }`}
                    >
                      {post.status === 'draft' ? 'Draft' : 'Published'}
                    </span>
                    <span className="dashboard-post-date">
                      {new Date(post.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <h3 className="dashboard-post-title">
                    {post.status === 'published' ? (
                      <Link to={`/post/${post.slug}`}>{post.title}</Link>
                    ) : (
                      <Link to={`/editor/${post._id}`}>{post.title}</Link>
                    )}
                  </h3>

                  <p className="dashboard-post-excerpt">{post.excerpt}</p>

                  {post.tags && post.tags.length > 0 && (
                    <div className="post-card-tags">
                      {post.tags.map((tag) => (
                        <span key={tag._id || tag.slug} className="tag-pill">
                          #{tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="dashboard-post-controls">
                  <Link
                    to={`/editor/${post._id}`}
                    className="btn btn-secondary btn-sm"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(post._id, post.title)}
                    className="btn btn-danger btn-sm"
                    disabled={deletingId === post._id}
                  >
                    {deletingId === post._id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
