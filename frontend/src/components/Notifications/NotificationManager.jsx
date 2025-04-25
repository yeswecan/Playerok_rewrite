import React, { useState, useEffect, useRef, useCallback } from 'react';
import Notification from './Notification';

const WS_URL = 'ws://127.0.0.1:3000'; // Match the log viewer
const DISMISS_TIMEOUT = 3000; // 3 seconds
const ANIMATION_DURATION = 300; // ms, should match CSS animation

const NotificationManager = () => {
  // State maps topic -> { payload, count, timestamp, timerId, status: 'visible' | 'dismissing' }
  const [notifications, setNotifications] = useState({});
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  // Function to actually remove the notification from state
  const removeNotification = useCallback((topic) => {
    setNotifications((prev) => {
      const { [topic]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Function to initiate dismissal (start animation)
  const startDismissNotification = useCallback((topic) => {
    setNotifications((prev) => {
      if (!prev[topic]) return prev; // Already gone
      // Clear the auto-dismiss timer if it exists
      if (prev[topic].timerId) clearTimeout(prev[topic].timerId);
      return {
        ...prev,
        [topic]: { ...prev[topic], status: 'dismissing', timerId: null }, // Mark as dismissing
      };
    });
  }, []);

  const connectWebSocket = useCallback(() => {
    console.log('[NotificationManager] Connecting WebSocket...');
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('[NotificationManager] Already connected.');
      return;
    }
    clearTimeout(reconnectTimerRef.current); // Clear any pending reconnect timer

    socketRef.current = new WebSocket(WS_URL);

    socketRef.current.onopen = () => {
      console.log('[NotificationManager] WebSocket Connected');
    };

    socketRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { topic, payload, timestamp } = message;

        setNotifications((prev) => {
          const existing = prev[topic];
          // Clear previous dismiss timer if it exists for this topic
          if (existing?.timerId) {
            clearTimeout(existing.timerId);
          }
          // Set new auto-dismiss timer
          const newTimerId = setTimeout(() => {
            startDismissNotification(topic); // Start dismissal instead of immediate removal
          }, DISMISS_TIMEOUT);

          return {
            ...prev,
            [topic]: {
              payload: payload,
              count: existing?.status !== 'dismissing' ? (existing?.count || 0) + 1 : 1, // Reset count if reappearing
              timestamp: timestamp,
              timerId: newTimerId,
              status: 'visible', // Ensure it's visible
            },
          };
        });
      } catch (error) {
        console.error('[NotificationManager] Error parsing message:', error);
      }
    };

    socketRef.current.onerror = (error) => {
      console.error('[NotificationManager] WebSocket Error:', error);
      // Optionally attempt to reconnect after a delay
    };

    socketRef.current.onclose = (event) => {
      console.log('[NotificationManager] WebSocket Disconnected:', event.code, event.reason);
      // Simple reconnect attempt after 5 seconds
      if (!event.wasClean) { // Don't auto-reconnect if closed cleanly
           clearTimeout(reconnectTimerRef.current);
           reconnectTimerRef.current = setTimeout(connectWebSocket, 5000);
      }
    };
  }, [startDismissNotification]); // Use startDismissNotification

  useEffect(() => {
    connectWebSocket();
    // Cleanup on unmount
    return () => {
        clearTimeout(reconnectTimerRef.current);
      if (socketRef.current) {
        socketRef.current.close(1000, 'Component unmounting'); // 1000 is normal closure
      }
      // Clear any pending dismiss timers by accessing the latest state via a functional update or ref if needed,
      // but since we are clearing ALL on unmount, getting the state at that moment is usually sufficient.
      // We need to get the *current* state when cleaning up.
      setNotifications(currentNotifications => {
          Object.values(currentNotifications).forEach(n => clearTimeout(n.timerId));
          return {}; // Optionally clear the state on unmount
      });
    };
  }, [connectWebSocket]); // <- REMOVED 'notifications' dependency

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col-reverse">
      {/* Render notifications from newest (bottom) to oldest (top) */}
      {Object.entries(notifications)
        // Optional: Sort by timestamp if needed, though insertion order might suffice
        // .sort(([, a], [, b]) => b.timestamp.localeCompare(a.timestamp))
        .map(([topic, data]) => (
          <Notification
            key={topic} // Use topic as key
            topic={topic}
            payload={data.payload}
            count={data.count}
            status={data.status}
            onDismissAnimationEnd={() => removeNotification(topic)} // Pass final removal func
          />
        ))}
    </div>
  );
};

export default NotificationManager; 