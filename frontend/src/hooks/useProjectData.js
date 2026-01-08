import { useState, useEffect, useCallback } from 'react';
import { getProjectStatus, downloadStem } from '../services/api';

export const useProjectData = (track) => {
    // track object comes from parent (App or Router loader), but we might want to refresh it?
    // Actually EditorView receives `track` prop.
    // This hook will manage the "Active Stems" and "Audio URLs" (blobs).

    const [activeStemIds, setActiveStemIds] = useState([]);
    const [audioUrls, setAudioUrls] = useState({});
    const [loadingStems, setLoadingStems] = useState({});

    // Initial Load
    useEffect(() => {
        // Reset state when track changes
        setActiveStemIds([]);
        setAudioUrls({});

        if (!track) return;

        const loadAll = async () => {
            const allFiles = [...track.stems];
            if (track.original) allFiles.push(track.original);

            // We load blobs for ALL files initially? The original code did.
            // This might be heavy for large projects, but let's replicate logic for now.
            for (const s of allFiles) {
                setLoadingStems(prev => ({ ...prev, [s]: true }));
                try {
                    const blob = await downloadStem(track.id, s);
                    setAudioUrls(prev => ({ ...prev, [s]: URL.createObjectURL(blob) }));
                } catch (e) {
                    console.error("Error loading stem", s, e);
                } finally {
                    setLoadingStems(prev => ({ ...prev, [s]: false }));
                }
            }
        };
        loadAll();

        return () => {
            // Cleanup Blobs
            Object.values(audioUrls).forEach(u => URL.revokeObjectURL(u));
        };
    }, [track?.id]); // Only reload if ID changes

    const addToPlayer = useCallback((stem) => {
        setActiveStemIds(prev => prev.includes(stem) ? prev : [...prev, stem]);
    }, []);

    const removeFromPlayer = useCallback((stem) => {
        setActiveStemIds(prev => prev.filter(id => id !== stem));
    }, []);

    const loadNewStems = useCallback(async (newStemsList) => {
        // filter already loaded
        const unique = newStemsList.filter(s => !audioUrls[s]);

        for (const s of unique) {
            setLoadingStems(prev => ({ ...prev, [s]: true }));
            try {
                const blob = await downloadStem(track.id, s);
                setAudioUrls(prev => ({ ...prev, [s]: URL.createObjectURL(blob) }));
            } catch (e) {
                console.error("Error loading new stem", s, e);
            } finally {
                setLoadingStems(prev => ({ ...prev, [s]: false }));
            }
        }
    }, [track?.id, audioUrls]);

    return {
        activeStemIds,
        audioUrls,
        loadingStems,
        addToPlayer,
        removeFromPlayer,
        loadNewStems
    };
};
