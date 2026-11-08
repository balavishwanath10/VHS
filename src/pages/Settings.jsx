import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import { isValidHttpUrl } from '../utils/markdownParser.js';

export const Settings = () => {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Sync state if user loads later
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    // Validate name presence
    if (!name || !name.trim()) {
      setErrorMsg('Name is required');
      return;
    }

    // Validate bio length
    if (bio && bio.length > 200) {
      setErrorMsg('Bio cannot exceed 200 characters');
      return;
    }

    // Validate avatar URL format if provided
    if (avatarUrl && avatarUrl.trim()) {
      if (!isValidHttpUrl(avatarUrl.trim())) {
        setErrorMsg('Avatar URL must be a valid HTTP or HTTPS URL');
        return;
      }
    }

    setSubmitting(true);

    try {
      const response = await api.put('/users/me', {
        name: name.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim(),
      });

      const updatedUser = response.data.user;
      if (updateUser) {
        updateUser(updatedUser);
      }
      setSuccessMsg('Profile updated successfully');
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to update profile'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container settings-container">
      <header className="page-header">
        <h1>Account Settings</h1>
        <p className="subtitle">
          Manage your developer profile and personal details.
        </p>
      </header>

      {successMsg && (
        <div className="alert alert-success">
          <p>{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-error">
          <p>{errorMsg}</p>
        </div>
      )}

      <div className="card settings-card">
        <form onSubmit={handleSubmit}>
          {/* Email (Readonly) */}
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input form-input-readonly"
              value={user?.email || ''}
              readOnly
              disabled
            />
            <p className="form-help">Your email address cannot be changed.</p>
          </div>

          {/* Full Name */}
          <div className="form-group">
            <label htmlFor="settings-name" className="form-label">
              Display Name
            </label>
            <input
              id="settings-name"
              type="text"
              className="form-input"
              placeholder="e.g. Linus Torvalds"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          {/* Bio */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="settings-bio" className="form-label">
                Bio
              </label>
              <span className={`char-counter ${bio.length > 200 ? 'counter-danger' : ''}`}>
                {bio.length} / 200
              </span>
            </div>
            <textarea
              id="settings-bio"
              className="form-input"
              placeholder="Tell other developers about yourself, your tech stack, or what you're building..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={200}
              disabled={submitting}
            />
          </div>

          {/* Avatar URL */}
          <div className="form-group">
            <label htmlFor="settings-avatar" className="form-label">
              Avatar Image URL
            </label>
            <input
              id="settings-avatar"
              type="url"
              className="form-input"
              placeholder="https://example.com/avatar.jpg"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              disabled={submitting}
            />
            <p className="form-help">Enter a direct link to an avatar image (HTTPS).</p>
          </div>

          {/* Avatar Preview */}
          {avatarUrl && isValidHttpUrl(avatarUrl.trim()) && (
            <div className="avatar-preview-container">
              <span className="form-help" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Avatar Preview:
              </span>
              <img
                src={avatarUrl.trim()}
                alt="Avatar Preview"
                className="author-avatar"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}

          <div className="settings-actions" style={{ marginTop: '1.5rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
