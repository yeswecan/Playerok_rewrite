import React, { useState, useRef } from 'react';
import { throttle } from 'lodash-es';

const MqttTestSenderPage = () => {
  const [manualTopic1, setManualTopic1] = useState('test/notification/1');
  const [manualPayload1, setManualPayload1] = useState('Hello from Row 1!');
  const [manualTopic2, setManualTopic2] = useState('test/notification/2');
  const [manualPayload2, setManualPayload2] = useState('Payload for Row 2');
  const [sliderTopic, setSliderTopic] = useState('test/slider');
  const [sliderValue, setSliderValue] = useState(50); // Default slider value
  const throttledPublishRef = useRef(
    throttle((topic, payload) => {
      fetch('http://127.0.0.1:3000/api/mqtt/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, payload }),
      }).catch(console.error);
    }, 50)
  );
  const handleManualSend = async (topic, payload) => {
    if (!topic) return;
    try {
      const resp = await fetch('http://127.0.0.1:3000/api/mqtt/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, payload }),
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
          placeholder="Manual Topic 1"
          value={manualTopic1}
          onChange={(e) => setManualTopic1(e.target.value)}
          className="border p-2 rounded flex-1"
        />
        <input
          type="text"
          placeholder="Manual Payload 1"
          value={manualPayload1}
          onChange={(e) => setManualPayload1(e.target.value)}
          className="border p-2 rounded flex-1"
        />
        <button
          onClick={() => handleManualSend(manualTopic1, manualPayload1)}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Send 1
        </button>
      </div>
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="Manual Topic 2"
          value={manualTopic2}
          onChange={(e) => setManualTopic2(e.target.value)}
          className="border p-2 rounded flex-1"
        />
        <input
          type="text"
          placeholder="Manual Payload 2"
          value={manualPayload2}
          onChange={(e) => setManualPayload2(e.target.value)}
          className="border p-2 rounded flex-1"
        />
        <button
          onClick={() => handleManualSend(manualTopic2, manualPayload2)}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Send 2
        </button>
      </div>
      <div className="flex space-x-2 items-center pt-4 border-t mt-4">
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