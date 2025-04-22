import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';

const MqttLogViewerPage = () => {
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [messageLogEntries, setMessageLogEntries] = useState([]);
  const [errorInfo, setErrorInfo] = useState(null);
  const socketRef = useRef(null);
  const containerRef = useRef(null);
  const WS_URL = 'ws://127.0.0.1:3000'; // explicit IPv4 to avoid IPv6 localhost issues
  const API_MESSAGES_URL = 'http://127.0.0.1:3000/api/mqtt/messages';

  useEffect(() => {
    // Initial load of existing MQTT messages
    (async () => {
      try {
        const resp = await fetch(API_MESSAGES_URL);
        if (resp.ok) {
          const initialMsgs = await resp.json();
          setMessageLogEntries(initialMsgs);
        } else {
          console.error('Initial fetch failed:', resp.status);
        }
      } catch (err) {
        console.error('Error fetching initial messages:', err);
      }
    })();
    // Setup WebSocket for real-time updates
    console.log('[MqttLogViewer] connecting via WebSocket to', WS_URL);
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => setConnectionStatus('Connected');
    socket.onmessage = (event) => {
      try {
        const mqttMessage = JSON.parse(event.data);
        setMessageLogEntries((prevEntries) => [...prevEntries, mqttMessage]);
      } catch (error) {
        console.error('Error parsing MQTT message:', error);
      }
    };
    socket.onerror = (event) => {
      console.error('WebSocket error:', event);
      setErrorInfo(`Failed to connect to ${WS_URL}`);
    };
    socket.onclose = (event) => {
      setConnectionStatus('Disconnected');
      setErrorInfo(`WebSocket closed (code ${event.code}) on ${WS_URL}`);
    };

    return () => socket.close();
  }, []);

  // Polling fallback if WebSocket fails
  useEffect(() => {
    if (connectionStatus !== 'Connected') {
      const poller = setInterval(async () => {
        try {
          const response = await fetch(API_MESSAGES_URL);
          if (response.ok) {
            const data = await response.json();
            setMessageLogEntries(data);
          } else {
            console.error('Polling error status:', response.status);
          }
        } catch (err) {
          console.error('Polling fetch error:', err);
        }
      }, 1000);
      return () => clearInterval(poller);
    }
  }, [connectionStatus]);

  const handleClearLog = () => setMessageLogEntries([]);

  // Auto-scroll to show latest messages
  useLayoutEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messageLogEntries]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">MQTT Log Viewer (WS: {WS_URL})</h1>
      <div className="flex items-center mb-2">
        <span>
          Status: {connectionStatus === 'Connected' ? 'WS Connected' : 'Polling'}
        </span>
        <button onClick={handleClearLog} className="ml-4 px-2 py-1 bg-red-500 text-white rounded">
          Clear Log
        </button>
      </div>
      {errorInfo && <div className="mb-2 px-2 py-1 bg-red-200 text-red-800 rounded">Error: {errorInfo}</div>}
      <div ref={containerRef} className="overflow-auto max-h-[600px] border">
        <table className="w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Timestamp</th>
              <th className="p-2 text-left">Topic</th>
              <th className="p-2 text-left">Payload</th>
            </tr>
          </thead>
          <tbody>
            {messageLogEntries.map((entry, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-2 font-mono text-sm">{entry.timestamp}</td>
                <td className="p-2 text-sm">{entry.topic}</td>
                <td className="p-2 font-mono text-sm break-words">{entry.payload}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MqttLogViewerPage; 