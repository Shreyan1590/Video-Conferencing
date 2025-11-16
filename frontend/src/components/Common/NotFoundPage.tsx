import React from 'react';
import { useNavigate } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="page-layout">
      <header className="top-bar">
        <div className="logo">Cliqtrix - ProVeloce</div>
        <div className="top-bar-right">
          <button className="secondary-btn" onClick={() => navigate('/')}>
            Go to home
          </button>
        </div>
      </header>
      <main className="lobby-main">
        <section className="lobby-card" style={{ textAlign: 'center' }}>
          <h1>404 – Page not found</h1>
          <p className="schedule-empty">
            The page you are looking for doesn&apos;t exist or has been moved.
          </p>
          <button className="primary-btn" type="button" onClick={() => navigate('/')}>
            Back to home
          </button>
        </section>
      </main>
    </div>
  );
};


