import React, { useEffect, useState } from 'react';
import CryptoJS from 'crypto-js';

import { useSocket } from '../../context/SocketContext';

interface ChatMessage {
  id: string;
  userId?: string;
  fullName?: string;
  message: string;
  timestamp: number;
  system?: boolean;
  targetUserId?: string;
}

interface Props {
  roomId: string;
  userId: string;
  fullName: string;
  participants?: { userId: string; fullName: string }[];
}

const deriveRoomKey = (roomId: string) => {
  // Simple deterministic key derivation for demo purposes.
  // For real E2E, use a secure key exchange (e.g. Diffie–Hellman) and per-session keys.
  return CryptoJS.SHA256(`cliqtrix-chat-${roomId}`).toString();
};

export const ChatPanel: React.FC<Props> = ({ roomId, userId, fullName, participants = [] }) => {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [targetUserId, setTargetUserId] = useState<string | 'everyone'>('everyone');
  const [pickerOpen, setPickerOpen] = useState(false);
  const roomKey = deriveRoomKey(roomId);

  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (data: {
      userId: string;
      fullName: string;
      message: string;
      timestamp: number;
      targetUserId?: string;
    }) => {
      try {
        const bytes = CryptoJS.AES.decrypt(data.message, roomKey);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8) || '[unable to decrypt]';
        setMessages((prev) => [
          ...prev,
          {
            id: `${data.userId}-${data.timestamp}`,
            ...data,
            message: decrypted,
            system: false
          }
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `${data.userId}-${data.timestamp}`,
            userId: data.userId,
            fullName: data.fullName,
            message: '[unable to decrypt]',
            timestamp: data.timestamp,
            system: false
          }
        ]);
      }
    };

    const handleSystemMessage = (data: { message: string; timestamp: number }) => {
      setMessages((prev) => [
        ...prev,
        { id: `system-${data.timestamp}`, message: data.message, timestamp: data.timestamp, system: true }
      ]);
    };

    socket.on('chat-message', handleChatMessage);
    socket.on('system-message', handleSystemMessage);

    return () => {
      socket.off('chat-message', handleChatMessage);
      socket.off('system-message', handleSystemMessage);
    };
  }, [socket]);

  const handleSend = () => {
    if (!socket || !input.trim()) return;
    const ciphertext = CryptoJS.AES.encrypt(input.trim(), roomKey).toString();
    const target =
      targetUserId === 'everyone' || targetUserId === '' ? undefined : (targetUserId as string);
    socket.emit('chat-message', { roomId, userId, fullName, message: ciphertext, targetUserId: target });
    setInput('');
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span>In-call messages</span>
        <div className="chat-target-wrapper">
          <button
            type="button"
            className="secondary-btn chat-target-toggle"
            onClick={() => setPickerOpen((open) => !open)}
          >
            {targetUserId === 'everyone'
              ? 'Everyone'
              : participants.find((p) => p.userId === targetUserId)?.fullName ?? 'Everyone'}
          </button>
          {pickerOpen && (
            <div className="chat-target-menu">
              <button
                type="button"
                className="chat-target-item"
                onClick={() => {
                  setTargetUserId('everyone');
                  setPickerOpen(false);
                }}
              >
                Everyone
              </button>
              {participants.map((p) => (
                <button
                  key={p.userId}
                  type="button"
                  className="chat-target-item"
                  onClick={() => {
                    setTargetUserId(p.userId);
                    setPickerOpen(false);
                  }}
                >
                  {p.fullName}
                  {p.userId === userId && ' (You)'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="chat-messages">
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.system ? 'chat-message system' : m.userId === userId ? 'chat-message self' : 'chat-message'}
          >
            {!m.system && (
              <div className="chat-meta">
                <span className="chat-user">{m.fullName ?? m.userId}</span>
                <span className="chat-time">
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
            <div className="chat-text">{m.message}</div>
          </div>
        ))}
      </div>
      <div className="chat-input-row">
        <div className="chat-input-shell">
          <input
            type="text"
            placeholder="Send a message to everyone"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
          />
          <button className="chat-send-btn" type="button" onClick={handleSend}>
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
};


