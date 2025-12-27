import React, { createContext, useState, useContext } from 'react';
import ContextMenu from './ContextMenu';

const ContextMenuContext = createContext();

export function ContextMenuProvider({ children }) {
    const [menu, setMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
        items: []
    });

    const openMenu = (x, y, items) => {
        setMenu({
            visible: true,
            x,
            y,
            items
        });
    };

    const closeMenu = () => {
        setMenu(m => ({ ...m, visible: false }));
    };

    return (
        <ContextMenuContext.Provider value={{ openMenu, closeMenu }}>
            {children}
            <ContextMenu {...menu} onClose={closeMenu} />
        </ContextMenuContext.Provider>
    );
}

// Custom hook to use the context menu
export function useContextMenu() {
    const context = useContext(ContextMenuContext);
    if (!context) {
        throw new Error('useContextMenu must be used within a ContextMenuProvider');
    }
    return context;
}