import React from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../../assets/logo.png'
import './Sidebar.css';

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src={logo} alt="Unweave" className='logo-image' />
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <h3 className="section-title">Menu</h3>
          <NavLink to="/split" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            </span>
            <span className="nav-label">Split New Track</span>
          </NavLink>
          <NavLink to="/library" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
            </span>
            <span className="nav-label">Library</span>
          </NavLink>
        </div>
      </nav>

      <div className="sidebar-footer">
        <span className="version">v1.2.0 • Pro</span>
      </div>
    </aside>
  );
};

export default Sidebar;
