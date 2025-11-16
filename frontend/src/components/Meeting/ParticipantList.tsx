import React from 'react';

interface Props {
  localUserId: string;
  localFullName: string;
  remoteParticipants: { userId: string; fullName: string }[];
  isHost?: boolean;
  onAction?: (userId: string, action: 'mute' | 'stopVideo' | 'remove' | 'ban') => void;
}

export const ParticipantList: React.FC<Props> = ({
  localUserId,
  localFullName,
  remoteParticipants,
  isHost = false,
  onAction
}) => {
  return (
    <div className="participant-list">
      <div className="participant-header">
        <span>People</span>
        <span className="badge">{1 + remoteParticipants.length}</span>
      </div>
      <ul>
        <li className="participant-item">
          <span className="avatar-pill">{localFullName.charAt(0).toUpperCase()}</span>
          <span className="participant-name">You ({localFullName})</span>
        </li>
        {remoteParticipants.map((p) => (
          <li key={p.userId} className="participant-item">
            <span className="avatar-pill">{p.fullName.charAt(0).toUpperCase()}</span>
            <span className="participant-name">{p.fullName}</span>
            {isHost && onAction && p.userId !== localUserId && (
              <div className="participant-actions">
                <button
                  type="button"
                  className="participant-menu-trigger"
                  onClick={(e) => {
                    const menu = e.currentTarget.nextSibling as HTMLDivElement | null;
                    if (menu) {
                      menu.classList.toggle('open');
                    }
                  }}
                >
                  ⋮
                </button>
                <div className="participant-menu">
                  <button type="button" onClick={() => onAction(p.userId, 'mute')}>
                    Mute
                  </button>
                  <button type="button" onClick={() => onAction(p.userId, 'stopVideo')}>
                    Turn off camera
                  </button>
                  <button type="button" onClick={() => onAction(p.userId, 'remove')}>
                    Remove from meeting
                  </button>
                  <button type="button" onClick={() => onAction(p.userId, 'ban')}>
                    Ban from meeting
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};


