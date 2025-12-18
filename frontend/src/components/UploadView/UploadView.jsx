import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './UploadView.css';

const API_BASE = 'http://127.0.0.1:5000/api';

const UploadView = ({ onUploadSuccess }) => {
    const navigate = useNavigate();
    const [mode, setMode] = useState('file'); // 'file' | 'url'
    const [file, setFile] = useState(null);
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
            setMode('file');
        }
    };

    const handleUpload = async () => {
        setIsLoading(true);
        setError(null);

        try {
            let res;
            if (mode === 'file') {
                if (!file) return;
                const formData = new FormData();
                formData.append('file', file);
                res = await axios.post(`${API_BASE}/separate`, formData);
            } else {
                if (!url) return;
                res = await axios.post(`${API_BASE}/separate-url`, { url });
            }

            if (onUploadSuccess) {
                await onUploadSuccess();
            }

            navigate(`/library/${res.data.id}`);
        } catch (err) {
            setError(err.response?.data?.error || 'Error processing request');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="upload-view fade-in">
            <div className="upload-card">
                <header>
                    <h2>Start New Project</h2>
                    <p className="subtitle">Upload an audio file or paste a YouTube link to split stems.</p>
                </header>

                <div className="mode-switcher">
                    <button
                        className={`switcher-btn ${mode === 'file' ? 'active' : ''}`}
                        onClick={() => setMode('file')}
                    >
                        File Upload
                    </button>
                    <button
                        className={`switcher-btn ${mode === 'url' ? 'active' : ''}`}
                        onClick={() => setMode('url')}
                    >
                        YouTube URL
                    </button>
                </div>

                <div className="input-area">
                    {mode === 'file' ? (
                        <div
                            className={`drop-zone ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <input
                                type="file"
                                accept=".mp3,.wav,.ogg,.flac"
                                onChange={(e) => setFile(e.target.files[0])}
                                id="file-input"
                                className="hidden-input"
                            />
                            <label htmlFor="file-input">
                                {file ? (
                                    <div className="file-selected">
                                        <span className="icon">🎵</span>
                                        <span className="filename">{file.name}</span>
                                        <span className="change-text">Click to change</span>
                                    </div>
                                ) : (
                                    <div className="placeholder">
                                        <span className="icon">📂</span>
                                        <p>Drag & Drop audio file here</p>
                                        <span className="sub">or click to browse</span>
                                    </div>
                                )}
                            </label>
                        </div>
                    ) : (
                        <div className="url-section">
                            <input
                                type="text"
                                placeholder="Paste Youtube Link here..."
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="styled-input"
                            />
                        </div>
                    )}
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="actions">
                    <button
                        onClick={handleUpload}
                        disabled={(mode === 'file' && !file) || (mode === 'url' && !url) || isLoading}
                        className="btn btn-primary btn-large"
                    >
                        {isLoading ? (
                            <>
                                <div className="loader"></div>
                                <span>Processing...</span>
                            </>
                        ) : (
                            <span>Separate Tracks</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadView;
