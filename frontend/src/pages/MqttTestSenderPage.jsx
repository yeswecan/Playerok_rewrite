import React, { useState, useRef } from 'react';
import { throttle } from 'lodash-es';

const MqttTestSenderPage = () => {
  const [manualTopic, setManualTopic] = useState('');
  const [manualPayload, setManualPayload] = useState('');
  const [sliderTopic, setSliderTopic] = useState('');
  const [sliderValue, setSliderValue] = useState(1);
  const throttledPublishRef = useRef(
    throttle((topic, payload) => {
      fetch('http://127.0.0.1:3000/api/mqtt/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, payload }),
      }).catch(console.error);
    }, 50)
  );
  const handleManualSend = async () => {
    if (!manualTopic) return;
    try {
      const resp = await fetch('http://127.0.0.1:3000/api/mqtt/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: manualTopic, payload: manualPayload }),
      });
      if (!resp.ok) console.error('Publish failed', resp.status);
    } catch (err) {
      console.error('Error publishing manual message', err);
    }
  };
  const handleSliderChange = (e) => {
    const value = e.target.value;
    setSliderValue(value);
    if (sliderTopic) throttledPublishRef.current(sliderTopic, value);
  };
  return (
    <div className="p-4 flex flex-col space-y-4">
      <h1 className="text-2xl font-bold">MQTT Test Sender</h1>
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="Manual Topic"
          value={manualTopic}
          onChange={(e) => setManualTopic(e.target.value)}
          className="border p-2 rounded flex-1"
        />
        <input
          type="text"
          placeholder="Manual Payload"
          value={manualPayload}
          onChange={(e) => setManualPayload(e.target.value)}
          className="border p-2 rounded flex-1"
        />
        <button
          onClick={handleManualSend}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Send
        </button>
      </div>
      <div className="flex space-x-2 items-center">
        <input
          type="text"
          placeholder="Slider Topic"
          value={sliderTopic}
          onChange={(e) => setSliderTopic(e.target.value)}
          className="border p-2 rounded flex-1"
        />
        <input
          type="range"
          min="1"
          max="100"
          value={sliderValue}
          onChange={handleSliderChange}
          className="flex-1"
        />
        <span className="w-12 text-center">{sliderValue}</span>
      </div>
    </div>
  );
};

export default MqttTestSenderPage; 