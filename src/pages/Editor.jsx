import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api.js';
import MarkdownRenderer from '../components/MarkdownRenderer.jsx';
import { isValidHttpUrl } from '../utils/markdownParser.js';

export const Editor = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const isEditing = Boolean(id && id !== 'new');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  const [loadingPost, setLoadingPost] = useState(isEditing);
  const [loadingTags, setLoadingTags] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('write'); // 'write' or 'preview'

  // Load available tags on mount
  useEffect(() => {
    let isMounted = true;
    api
      .get('/tags')
      .then((res) => {
        if (isMounted) {
          setAvailableTags(res.data.tags || []);
          setLoadingTags(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoadingTags(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Load existing post if editing
  useEffect(() => {
    if (!isEditing) return;

    let isMounted = true;
    setLoadingPost(true);
    setError(null);

    api
      .get(`/posts/${id}`)
      .then((res) => {
        if (isMounted && res.data && res.data.post) {
          const post = res.data.post;
          setTitle(post.title || '');
          setContent(post.content || '');
          setCoverImage(post.coverImage || '');
          if (Array.isArray(post.tags)) {
            setSelectedTags(
              post.tags.map((t) => (typeof t === 'object' ? t._id : t))
            );
          }
          setLoadingPost(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load post for editing');
          setLoadingPost(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id, isEditing]);

  // Toggle tag selection
  const handleTagToggle = (tagId) => {
    if (submitting) return;
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  // Submit post (as draft or published)
  const handleSave = async (targetStatus) => {
    setError(null);

    // Validate title presence
    if (!title || !title.trim()) {
      setError('Title is required');
      return;
    }

    // Validate content presence for publishing
    if (targetStatus === 'published' && (!content || !content.trim())) {
      setError('Content is required to publish a story');
      return;
    }

    // Validate cover image URL if provided
    if (coverImage && coverImage.trim()) {
      if (!isValidHttpUrl(coverImage.trim())) {
        setError('Cover image must be a valid HTTP or HTTPS URL');
        return;
      }
    }

    setSubmitting(true);

    const payload = {
      title: title.trim(),
      content: content || '',
      status: targetStatus,
      coverImage: coverImage.trim(),
      tags: selectedTags,
    };

    try {
      let savedPost;
      if (isEditing) {
        const response = await api.put(`/posts/${id}`, payload);
        savedPost = response.data.post;
      } else {
        const response = await api.post('/posts', payload);
        savedPost = response.data.post;
      }

      if (targetStatus === 'published' && savedPost?.slug) {
        navigate(`/post/${savedPost.slug}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to save story'
      );
      setSubmitting(false);
    }
  };

  if (loadingPost) {
    return (
      <div className="container" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <div className="card">
          <p>Loading story for editing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container editor-container">
      <header className="page-header editor-header">
        <div>
          <h1>{isEditing ? 'Edit Story' : 'Create New Story'}</h1>
          <p className="subtitle">
            Write in Markdown with live preview and syntax highlighting.
          </p>
        </div>

        <div className="editor-actions">
          <Link to="/dashboard" className="btn btn-secondary">
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => handleSave('draft')}
            className="btn btn-secondary"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            type="button"
            onClick={() => handleSave('published')}
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </header>

      {error && (
        <div className="alert alert-error">
          <p>{error}</p>
        </div>
      )}

      <div className="card editor-card">
        {/* Title Input */}
        <div className="form-group">
          <label htmlFor="editor-title" className="form-label">
            Story Title
          </label>
          <input
            id="editor-title"
            type="text"
            className="form-input editor-title-input"
            placeholder="Give your story a clear title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />
        </div>

        {/* Cover Image Input */}
        <div className="form-group">
          <label htmlFor="editor-cover" className="form-label">
            Cover Image URL (Optional)
          </label>
          <input
            id="editor-cover"
            type="url"
            className="form-input"
            placeholder="https://example.com/banner.jpg"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            disabled={submitting}
          />
        </div>

        {/* Tag Selector */}
        <div className="form-group">
          <label className="form-label">Select Relevant Tags</label>
          {loadingTags ? (
            <p className="form-help">Loading available tags...</p>
          ) : availableTags.length === 0 ? (
            <p className="form-help">No tags available.</p>
          ) : (
            <div className="editor-tags-selector">
              {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag._id);
                return (
                  <button
                    key={tag._id}
                    type="button"
                    onClick={() => handleTagToggle(tag._id)}
                    className={`tag-toggle-btn ${isSelected ? 'selected' : ''}`}
                    disabled={submitting}
                  >
                    #{tag.name}
                    {isSelected && <span className="tag-check"> ✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tab Controls: Write vs Preview */}
        <div className="editor-tabs-bar">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'write' ? 'active' : ''}`}
            onClick={() => setActiveTab('write')}
          >
            Write
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Live Preview
          </button>
        </div>

        {/* Editor Body: Textarea or Markdown Preview */}
        <div className="editor-pane-wrapper">
          {activeTab === 'write' ? (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <textarea
                id="editor-content"
                className="form-input editor-textarea"
                placeholder="Write your story using Markdown (supports # headings, **bold**, `code`, ```fenced code blocks, > quotes, and lists)..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                disabled={submitting}
              />
            </div>
          ) : (
            <div className="editor-preview-container">
              <MarkdownRenderer
                content={content || '*No content written yet to preview.*'}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Editor;
