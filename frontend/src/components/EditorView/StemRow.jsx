import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import './EditorView.css';

// SVG Icons
const MuteIcon = ({ active }) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        {active ? (
            <>
                <path d="M8 3.5L5 6H3v4h2l3 2.5V3.5z" fill="currentColor" />
                <line x1="10" y1="6" x2="13" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="13" y1="6" x2="10" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </>
        ) : (
            <>
                <path d="M8 3.5L5 6H3v4h2l3 2.5V3.5z" fill="currentColor" />
                <path d="M10 5.5c.5.5 1 1.5 1 2.5s-.5 2-1 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M11.5 4c1 1 1.5 2.5 1.5 4s-.5 3-1.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </>
        )}
    </svg>
);

const SoloIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="2.5" fill="currentColor" />
        <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
);

const DownloadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 2v8m0 0L5 7m3 3l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 12v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

const LockIcon = ({ locked }) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        {locked ? (
            <>
                <rect x="4" y="7" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="10" r="0.8" fill="currentColor" />
            </>
        ) : (
            <>
                <rect x="4" y="7" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 7V5a3 3 0 015-2.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="10" r="0.8" fill="currentColor" />
            </>
        )}
    </svg>
);

const StemRow = ({
    stem,
    sState = { vol: 0.5, muted: false, solo: false, pan: 0, locked: false },
    audioUrl,
    onUpdate,
    onRemove,
    onDownload,
    registerWaveSurfer,
    visible = true,
    isPlaying,
    currentTime,
    audioContext,
}) => {
    const containerRef = useRef(null);
    const wsRef = useRef(null);
    const pannerRef = useRef(null);
    const [isReady, setIsReady] = useState(false);

    const isUnified = stem.includes('.unified');

    // Extract file format
    const getFileFormat = (filename) => {
        const match = filename.match(/\.(wav|mp3|flac)$/i);
        return match ? match[1].toUpperCase() : '';
    };
    const format = getFileFormat(stem);

    useEffect(() => {
        if (!audioUrl || !containerRef.current || !audioContext) return;

        const abortController = new AbortController();
        let ws = null;

        const initWaveSurfer = async () => {
            try {
                // Check abortion before starting
                if (abortController.signal.aborted) return;

                // Initialize WaveSurfer
                const panner = audioContext.createStereoPanner();
                pannerRef.current = panner;

                ws = WaveSurfer.create({
                    container: containerRef.current,
                    waveColor: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
                    progressColor: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() + '5e',
                    barWidth: 1,
                    barGap: 1,
                    barRadius: 2,
                    barHeight: 0.75,
                    responsive: true,
                    height: 'auto',
                    normalize: true,
                    cursorWidth: 0,
                    cursorColor: 'transparent',
                    audioContext: audioContext,
                    audioNodes: [panner]
                });

                wsRef.current = ws;

                // Set up event listeners BEFORE loading
                ws.on('ready', () => {
                    if (abortController.signal.aborted) return;

                    setIsReady(true);
                    ws.setVolume(sState?.muted ? 0 : (sState?.vol ?? 0.5));
                    panner.pan.setValueAtTime(sState?.pan ?? 0, audioContext.currentTime);
                    registerWaveSurfer(stem, ws);
                });

                ws.on('error', (err) => {
                    if (
                        err.name === 'AbortError' ||
                        err.message?.includes('aborted') ||
                        err.toString().includes('aborted')
                    ) return;
                    console.error('WaveSurfer error:', stem, err);
                });

                // Load the audio URL directly (it's already a blob URL from EditorView)
                await ws.load(audioUrl);

                // Check if we were aborted during loading
                if (abortController.signal.aborted) {
                    if (ws) {
                        try {
                            if (ws.unAll) ws.unAll();
                        } catch (e) { /* ignore */ }
                        ws.destroy();
                    }
                    return;
                }

            } catch (err) {
                // Ignore AbortErrors (expected during rapid navigation/updates)
                const isAbort =
                    err.name === 'AbortError' ||
                    err.message === 'The user aborted a request.' ||
                    err.message?.includes('aborted') ||
                    err.toString().includes('aborted');

                if (isAbort) {
                    return;
                }

                // Log other errors
                if (err.name === 'EncodingError') {
                    console.error(`Cannot decode ${stem}: The audio file may be corrupted or in an unsupported format.`, err);
                } else if (err.name === 'NotReadableError') {
                    console.error(`Cannot read ${stem}: File became inaccessible during loading.`, err);
                } else {
                    console.error('StemRow load error:', stem, err);
                }
            }
        };

        initWaveSurfer();

        // Cleanup
        return () => {
            // 1. Abort any ongoing operations
            abortController.abort();

            // 2. Cleanup WaveSurfer instance
            // Use a small timeout to ensure abort signal is processed
            setTimeout(() => {
                if (ws) {
                    try {
                        try { if (ws.unAll) ws.unAll(); } catch (e) { }
                        ws.destroy();
                    } catch (e) {
                        // Silently ignore destruction errors and abort errors
                        const isAbort =
                            e.name === 'AbortError' ||
                            e.message?.includes('aborted') ||
                            e.toString().includes('aborted');

                        if (!isAbort) {
                            console.debug('WaveSurfer destroy warning:', e);
                        }
                    }
                }
            }, 0);

            wsRef.current = null;
            setIsReady(false);

            // 3. Update parent state
            registerWaveSurfer(stem, null);
        };
    }, [audioUrl, stem, audioContext]);

    // Handle State Updates (Vol, Mute, Pan)
    useEffect(() => {
        if (!wsRef.current) return;
        const vol = sState?.vol ?? 0.5;
        const muted = sState?.muted ?? false;
        wsRef.current.setVolume(muted ? 0 : vol);

        pannerRef.current.pan.setValueAtTime(sState?.pan, audioContext.currentTime);
    }, [sState?.vol, sState?.muted, sState?.pan]);

    const handleDownload = () => {
        if (onDownload) {
            onDownload(stem);
        }
    };

    const handleLockToggle = () => {
        onUpdate('locked', !sState?.locked);
    };

    return (
        <div
            className={`stem-row ${sState?.muted ? 'is-muted' : ''} ${sState?.locked ? 'is-locked' : ''}`}
            style={{ display: visible ? 'flex' : 'none' }}
        >
            {/* Left Controls */}
            <div className="stem-controls-left">
                {/* Row 1: Info */}
                <div className="stem-row-top">
                    <button
                        className="btn-icon danger"
                        onClick={() => onRemove(stem)}
                        title="Remove from Player"
                        disabled={sState?.locked}
                    >
                        ←
                    </button>
                    <div className="stem-name" title={stem}>
                        {stem.replace(/\.(wav|mp3|flac)$/, '')}
                        {isUnified && <span className="tag-unified">U</span>}
                    </div>
                    {format && <span className="format-badge">{format}</span>}
                    <div className="stem-actions">
                        <button
                            className="icon-btn"
                            onClick={handleDownload}
                            title="Download Stem"
                            disabled={sState?.locked}
                        >
                            <DownloadIcon />
                        </button>
                        <button
                            className={`icon-btn ${sState?.locked ? 'active' : ''}`}
                            onClick={handleLockToggle}
                            title={sState?.locked ? "Unlock" : "Lock"}
                        >
                            <LockIcon locked={sState?.locked} />
                        </button>
                    </div>
                </div>

                {/* Row 2: Controls */}
                <div className="stem-row-bottom">
                    <button
                        className={`icon-btn btn-mute ${sState?.muted ? 'active' : ''}`}
                        onClick={() => onUpdate('muted', !sState?.muted)}
                        title={sState?.muted ? "Unmute" : "Mute"}
                        disabled={sState?.locked}
                    >
                        <MuteIcon active={sState?.muted} />
                    </button>
                    <button
                        className={`icon-btn btn-solo ${sState?.solo ? 'active' : ''}`}
                        onClick={() => onUpdate('solo', !sState?.solo)}
                        title="Solo"
                        disabled={sState?.locked}
                    >
                        <SoloIcon />
                    </button>
                    <div className="control-group">
                        <label className="control-label">Vol</label>
                        <input
                            className="vol-slider-mini"
                            type="range" min="0" max="1" step="0.01"
                            value={sState?.vol ?? 0.5}
                            onChange={(e) => onUpdate('vol', parseFloat(e.target.value))}
                            disabled={sState?.locked}
                        />
                    </div>
                    <div className="control-group">
                        <label className="control-label">Pan</label>
                        <input
                            className="pan-slider"
                            type="range" min="-1" max="1" step="0.01"
                            value={sState?.pan ?? 0}
                            onChange={(e) => onUpdate('pan', parseFloat(e.target.value))}
                            title={`Pan: ${sState?.pan ?? 0}`}
                            disabled={sState?.locked}
                        />
                    </div>
                </div>
            </div>

            {/* Waveform */}
            <div className="waveform-wrapper">
                <div ref={containerRef} className="waveform-container" />
                {!isReady && <div className="loading-overlay">Loading Waveform...</div>}
                {sState?.locked && <div className="locked-overlay" title="Stem is locked" />}
            </div>
        </div>
    );
};

export default StemRow;

