import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from './context/AuthContext';
import { LoginPage } from './components/Auth/LoginPage';
import { RegisterPage } from './components/Auth/RegisterPage';
import { LobbyPage } from './components/Meeting/LobbyPage';
import { MeetingRoom } from './components/Meeting/MeetingRoom';
import { ScheduleMeetingPage } from './components/Meeting/ScheduleMeetingPage';
import { CreateInstantMeetingPage } from './components/Meeting/CreateInstantMeetingPage';
import { WaitingRoomPage } from './components/Meeting/WaitingRoomPage';
import { NotFoundPage } from './components/Common/NotFoundPage';

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname + location.search;

  if (loading) {
    return (
      <div className="auth-layout">
        <div className="auth-card">
          <div className="spinner-ring" />
          <h1>Loading your workspace…</h1>
        </div>
      </div>
    );
  }
  
  if (!user) {
    // Preserve the current route so we can redirect back after login
    // Only add redirect param if we're not already on login/register pages
    const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
    const redirectPath = !isAuthPage 
      ? `?redirect=${encodeURIComponent(currentPath)}`
      : '';
    return <Navigate to={`/login${redirectPath}`} replace state={{ from: location }} />;
  }
  
  return children;
};

// Redirect logged-in users away from auth pages
const AuthRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-layout">
        <div className="auth-card">
          <div className="spinner-ring" />
          <h1>Loading…</h1>
        </div>
      </div>
    );
  }

  // If user is logged in, redirect to home or the redirect param
  if (user) {
    const params = new URLSearchParams(location.search);
    const redirectTo = params.get('redirect') || '/';
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

const App: React.FC = () => {
  return (
    <div className="app-root">
      <Routes>
        <Route
          path="/login"
          element={
            <AuthRoute>
              <LoginPage />
            </AuthRoute>
          }
        />
        <Route
          path="/register"
          element={
            <AuthRoute>
              <RegisterPage />
            </AuthRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <LobbyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute>
              <ScheduleMeetingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedule/:code"
          element={
            <ProtectedRoute>
              <ScheduleMeetingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/instant"
          element={
            <ProtectedRoute>
              <CreateInstantMeetingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/room/:roomId"
          element={
            <ProtectedRoute>
              <MeetingRoom />
            </ProtectedRoute>
          }
        />
        <Route
          path="/waiting/:roomId"
          element={
            <ProtectedRoute>
              <WaitingRoomPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
};

export default App;


