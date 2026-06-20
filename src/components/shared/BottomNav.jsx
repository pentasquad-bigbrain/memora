import { NavLink, useNavigate } from 'react-router-dom'

export default function BottomNav() {
  const navigate = useNavigate()

  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <i className="ti ti-home" aria-hidden="true" />
        <span>Home</span>
      </NavLink>

      <NavLink to="/tasks" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <i className="ti ti-checkbox" aria-hidden="true" />
        <span>Tasks</span>
      </NavLink>

      <button className="nav-fab" onClick={() => navigate('/capture')} aria-label="Capture">
        <i className="ti ti-plus" aria-hidden="true" />
      </button>

      <NavLink to="/vault" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <i className="ti ti-photo" aria-hidden="true" />
        <span>Vault</span>
      </NavLink>

      <NavLink to="/journal" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <i className="ti ti-notebook" aria-hidden="true" />
        <span>Journal</span>
      </NavLink>
    </nav>
  )
}
