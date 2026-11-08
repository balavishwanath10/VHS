import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api.js';

export const Profile = () => {
  const { id } = useParams();
  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setNotFound(false);

    api
      .get(`/users/${id}`)
      .then((res) => {
        if (isMounted) {
          if (res.data && res.data.user) {
            setProfileUser(res.data.user);
            setPosts(res.data.posts || []);
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
            setError(err.message || 'Failed to load profile');
          }
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <div className="card">
          <p>Loading developer profile...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container" style={{ padding: '3rem 1rem' }}>
        <div className="card text-center">
          <h2>404 — User Not Found</h2>
          <p className="subtitle">
            The developer profile you are looking for does not exist.
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

  if (!profileUser) return null;

  return (
    <div className="container profile-container">
      {/* Profile Header Card */}
      <div className="card profile-card">
        <div className="profile-header-layout">
          <div className="profile-avatar-wrapper">
            {profileUser.avatarUrl ? (
              <img
                src={profileUser.avatarUrl}
                alt={profileUser.name}
                className="profile-avatar-large"
              />
            ) : (
              <div className="profile-avatar-fallback">
                {profileUser.name ? profileUser.name[0].toUpperCase() : 'U'}
              </div>
            )}
          </div>

          <div className="profile-info-wrapper">
            <h1 className="profile-name">{profileUser.name}</h1>
            {profileUser.bio ? (
              <p className="profile-bio">{profileUser.bio}</p>
            ) : (
              <p className="profile-bio text-muted">No bio provided yet.</p>
            )}

            <div className="profile-meta-row">
              <span className="profile-stat">
                Stories: <strong>{posts.length}</strong>
              </span>
              {profileUser.createdAt && (
                <>
                  <span className="stats-separator">•</span>
                  <span className="profile-joined">
                    Joined{' '}
                    {new Date(profileUser.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stories Section */}
      <section className="profile-stories-section">
        <h2 className="section-title">Published Stories</h2>

        {posts.length === 0 ? (
          <div className="card empty-feed text-center">
            <h3>No stories published yet</h3>
            <p className="subtitle">
              {profileUser.name} hasn't published any stories yet.
            </p>
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
                    <div className="author-meta">
                      <span className="post-date">
                        {new Date(post.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <h3 className="post-card-title">
                    <Link to={`/post/${post.slug}`}>{post.title}</Link>
                  </h3>

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
      </section>
    </div>
  );
};

export default Profile;
