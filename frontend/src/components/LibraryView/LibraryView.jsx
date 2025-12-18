import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import TrackCard from './TrackCard';
import './LibraryView.css';

const LibraryView = ({ items, refresh }) => {
    const [search, setSearch] = useState('');

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="library-view fade-in">
            <header className="library-header">
                <div className="header-content">
                    <h2>Library</h2>
                    <div className="search-wrapper">
                        <span className="search-icon">🔍</span>
                        <input
                            type="search"
                            placeholder="Search tracks..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>
            </header>

            <div className="library-grid-container">
                <div className="library-grid">
                    {filteredItems.map(item => (
                        <Link to={`/library/${item.id}`} key={item.id} style={{ textDecoration: 'none' }}>
                            <TrackCard item={item} />
                        </Link>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="empty-state">
                            <p>No tracks found.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LibraryView;
