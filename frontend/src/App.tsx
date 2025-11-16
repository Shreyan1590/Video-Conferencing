import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

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
    return <Navigate to="/login" replace />;
  }
  return children;
};

const App: React.FC = () => {
  return (
    <div className="app-root">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
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


