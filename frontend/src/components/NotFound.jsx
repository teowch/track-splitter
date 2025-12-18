import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NotFound.css';

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div className="not-found-container">
            <h1>404</h1>
            <h2>Page Not Found</h2>
            <p>The page or track you are looking for does not exist.</p>
            <button className="primary-btn" onClick={() => navigate('/library')}>
                Go to Library
            </button>
        </div>
    );
};

export default NotFound;
