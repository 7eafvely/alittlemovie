html, body {
  margin: 0;
  padding: 0;
  font-family: Arial, Helvetica, sans-serif;
  background: #0a1220;
  color: #edf6ff;
}

* {
  box-sizing: border-box;
}

button,
textarea {
  font: inherit;
}

.studio-shell {
  min-height: 100vh;
  display: flex;
  background: linear-gradient(135deg, #0a1220, #101a2d 40%, #111827);
}

.sidebar {
  width: 220px;
  background: rgba(15, 23, 42, 0.85);
  border-right: 1px solid rgba(148, 163, 184, 0.3);
  padding: 24px 18px;
}

.brand {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 32px;
  color: #7dd3fc;
}

.nav-item {
  width: 100%;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  color: #dbeafe;
  padding: 12px 14px;
  border-radius: 12px;
  margin-bottom: 10px;
  cursor: pointer;
}

.nav-item.active {
  background: rgba(96, 165, 250, 0.15);
  border-color: rgba(125, 211, 252, 0.4);
}

.workspace {
  flex: 1;
  padding: 24px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 0.8rem;
  color: #7dd3fc;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.topbar h1 {
  margin: 0;
  font-size: clamp(1.8rem, 2vw, 2.6rem);
}

.content-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 20px;
}

.panel {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 20px 30px rgba(15, 23, 42, 0.2);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.panel-header span {
  color: #93c5fd;
  font-size: 0.85rem;
}

textarea {
  width: 100%;
  min-height: 280px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.9);
  color: #e2e8f0;
  padding: 16px;
  resize: vertical;
  line-height: 1.6;
}

.panel-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.primary-btn {
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  font-weight: 600;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.scene-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.scene-card {
  background: rgba(15, 118, 110, 0.12);
  border: 1px solid rgba(45, 212, 191, 0.28);
  border-radius: 14px;
  padding: 16px;
}

.scene-card h3 {
  margin: 0 0 12px;
  color: #a7f3d0;
}

.shot-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shot-card {
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  padding: 10px 12px;
}

.shot-card span {
  display: inline-block;
  font-weight: 700;
  margin-bottom: 6px;
  color: #bfdbfe;
}

.shot-card p {
  margin: 0;
  color: #dbeafe;
  line-height: 1.5;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  border: 1px dashed rgba(148, 163, 184, 0.35);
  border-radius: 16px;
  color: #cbd5e1;
}

@media (max-width: 900px) {
  .studio-shell {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  }

  .content-grid {
    grid-template-columns: 1fr;
  }
}
