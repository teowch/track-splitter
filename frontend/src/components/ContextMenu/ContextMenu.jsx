import { forwardRef, useImperativeHandle, useState, useEffect, useRef } from 'react';
import './ContextMenu.css';

/*
 * ContextMenu Component
 * 
 * A reusable context menu that appears on right-click.
 * This component should be rendered ONCE in App.jsx and controlled via ref.
 * 
 * ============================================================================
 * HOW TO USE:
 * ============================================================================
 * 
 * STEP 1: In App.jsx, create a ref and render the ContextMenu once
 * ------------------------------------------------------------------------
 * 
 * import { useRef } from 'react';
 * import ContextMenu from './components/ContextMenu/ContextMenu';
 * 
 * function App() {
 *   const contextMenuRef = useRef(null);
 *   
 *   return (
 *     <div className="app-container">
 *       <Sidebar />
 *       <main className="main-content">
 *         // Your routes and components here
 *       </main>
 *       
 *       // Render ContextMenu once at the app level
 *       <ContextMenu ref={contextMenuRef} />
 *     </div>
 *   );
 * }
 * 
 * STEP 2: Pass the ref down to child components that need it
 * ------------------------------------------------------------------------
 * You can pass it as a prop or use React Context for deeper components.
 * 
 * Example passing as prop:
 * <EditorView contextMenuRef={contextMenuRef} />
 * 
 * STEP 3: Use the context menu in your component
 * ------------------------------------------------------------------------
 * 
 * function MyComponent({ contextMenuRef }) {
 *   const handleContextMenu = (e) => {
 *     e.preventDefault(); // Prevent default browser context menu
 *     
 *     // Show the context menu at the click position
 *     contextMenuRef.current?.show(
 *       e.clientX,
 *       e.clientY,
 *       [
 *         {
 *           label: 'Delete',
 *           onClick: () => handleDelete(),
 *           danger: true // Makes the item red
 *         },
 *         {
 *           label: 'Rename',
 *           onClick: () => handleRename()
 *         },
 *         { separator: true }, // Adds a separator line
 *         {
 *           label: 'Properties',
 *           onClick: () => handleProperties(),
 *           disabled: true // Grays out and disables the item
 *         }
 *       ]
 *     );
 *   };
 *   
 *   return (
 *     <div onContextMenu={handleContextMenu}>
 *       Right-click me!
 *     </div>
 *   );
 * }
 * 
 * ============================================================================
 * MENU ITEM PROPERTIES:
 * ============================================================================
 * 
 * Each menu item object can have the following properties:
 * 
 * - label (string, required): The text to display for the menu item
 * - onClick (function, required): The function to call when clicked
 * - danger (boolean, optional): If true, styles the item red (for destructive actions)
 * - disabled (boolean, optional): If true, grays out and disables the item
 * - separator (boolean, optional): If true, renders a separator line instead of a menu item
 *                                  (when separator is true, other properties are ignored)
 * 
 * ============================================================================
 */

function ContextMenu({ visible, x, y, items, onClose }) {
    const menuRef = useRef(null);
    const [adjustedPosition, setAdjustedPosition] = useState({ x, y });

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        // Add listener with a slight delay to prevent immediate closing
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    // Adjust position to keep menu within viewport
    useEffect(() => {
        if (!visible || !menuRef.current) return;

        const menu = menuRef.current;
        const menuRect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let adjustedX = x;
        let adjustedY = y;

        // Adjust horizontal position if menu overflows right edge
        if (x + menuRect.width > viewportWidth) {
            adjustedX = viewportWidth - menuRect.width - 10;
        }

        // Adjust vertical position if menu overflows bottom edge
        if (y + menuRect.height > viewportHeight) {
            adjustedY = viewportHeight - menuRect.height - 10;
        }

        // Update position if adjustment is needed
        if (adjustedX !== x || adjustedY !== y) {
            setAdjustedPosition({ x: adjustedX, y: adjustedY });
        } else {
            setAdjustedPosition({ x, y });
        }
    }, [visible, x, y]);

    if (!visible) return null;

    // Handle item click
    const handleItemClick = (item) => {
        if (item.disabled) return;

        // Call the item's onClick handler
        if (item.onClick) {
            item.onClick();
        }

        // Hide the menu after clicking
        onClose();
    };


    return (
        <div
            ref={menuRef}
            className="context-menu"
            style={{
                left: `${adjustedPosition.x}px`,
                top: `${adjustedPosition.y}px`
            }}
        >
            {items.map((item, index) => {
                // Render separator
                if (item.separator) {
                    return <div key={`separator-${index}`} className="context-menu-separator" />;
                }

                // Render menu item
                return (
                    <button
                        key={index}
                        className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`}
                        onClick={() => handleItemClick(item)}
                        disabled={item.disabled}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

ContextMenu.displayName = 'ContextMenu';

export default ContextMenu;
