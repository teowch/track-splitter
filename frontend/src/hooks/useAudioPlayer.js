import { useState, useRef, useEffect, useCallback } from 'react';

export const useAudioPlayer = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [mainVolume, setMainVolume] = useState(0.5);

    // Refs
    const wsRefs = useRef({}); // Map: stemId -> WaveSurfer instance
    const isScrubbingRef = useRef(false);
    const sliderRef = useRef(false);

    // State to force re-renders if needed, though usually refs are enough for internal engine

    // Sync Loop
    useEffect(() => {
        let animationFrame;

        const loop = () => {
            if (isPlaying && !isScrubbingRef.current && !sliderRef.current) {
                // Find a primary instance to read time from
                const primaryId = Object.keys(wsRefs.current)[0];
                if (primaryId && wsRefs.current[primaryId]) {
                    const t = wsRefs.current[primaryId].getCurrentTime();
                    // Avoid excessive state updates
                    if (Math.abs(t - currentTime) > 0.1) {
                        setCurrentTime(t);
                    }
                }
            }
            animationFrame = requestAnimationFrame(loop);
        };

        if (isPlaying) {
            loop();
        }

        return () => cancelAnimationFrame(animationFrame);
    }, [isPlaying]);

    const registerWaveSurfer = useCallback((id, ws) => {
        if (ws) {
            wsRefs.current[id] = ws;
            // Sync new instance to global state
            ws.setVolume(mainVolume); // This might need to be per-stem masked by solo/mute logic, but base volume is main
            ws.setTime(currentTime);

            // Update duration if not set
            const d = ws.getDuration();
            if (d > 0 && Math.abs(d - duration) > 0.1) {
                setDuration(d);
            }
            // Listen for ready to update duration?
            ws.on('ready', () => {
                setDuration(prev => Math.max(prev, ws.getDuration()));
            });
        } else {
            delete wsRefs.current[id];
        }
    }, [currentTime, mainVolume, duration]);

    const togglePlay = useCallback(() => {
        setIsPlaying(prev => {
            const next = !prev;
            Object.values(wsRefs.current).forEach(ws => {
                if (next) ws.play();
                else ws.pause();
            });
            return next;
        });
    }, []);

    const seek = useCallback((time) => {
        setCurrentTime(time);
        Object.values(wsRefs.current).forEach(ws => {
            ws.setTime(time);
        });
    }, []);

    const setVolume = useCallback((vol) => {
        setMainVolume(vol);
        // Note: Individual stem volume logic (mute/solo) should be handled by the consumer (EditorView)
        // possibly by passing a specific volume to the StemRow, which multiplies by mainVolume.
        // But if we want global volume, we can do it here if we track stem states?
        // Better: let EditorView calculate effective volume = stemVol * mainVol
        // and call setVolume on the WS instance directly?
        // OR: useAudioPlayer exposes a `updateVolume(id, vol)`?
        // For now, simpliest split: EditorView manages "Logic Mixer", useAudioPlayer manages "Transport".
    }, []);

    // When isPlaying changes, ensure sync
    useEffect(() => {
        Object.values(wsRefs.current).forEach(ws => {
            if (isPlaying) ws.play();
            else ws.pause();
        });
    }, [isPlaying]);

    return {
        isPlaying,
        currentTime,
        duration,
        mainVolume,
        setMainVolume: setVolume,
        togglePlay,
        seek,
        registerWaveSurfer,
        sliderRef,
        isScrubbingRef
    };
};
