import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import './EditorView.css';

const DraggableStem = ({ stem, onMove }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `browser-${stem}`,
        data: { stem, source: 'browser' }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="stem-browser-item">
            <span className="stem-name">{stem.replace(/\.(wav|mp3|flac)$/, '')}</span>
            <button className="btn-icon" onPointerDown={(e) => { e.stopPropagation(); onMove(stem); }}>
                →
            </button>
        </div>
    );
};

const StemBrowser = ({ stems, onMoveToPlayer }) => {
    return (
        <div className="stem-browser">
            <div className="browser-header">
                <h3>Available Stems</h3>
            </div>
            <div className="browser-list">
                {stems.map(stem => (
                    <DraggableStem key={stem} stem={stem} onMove={onMoveToPlayer} />
                ))}
                {stems.length === 0 && <div className="empty-msg">All stems are in the player</div>}
            </div>
        </div>
    );
};

export default StemBrowser;
