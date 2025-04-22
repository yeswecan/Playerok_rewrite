const mqttModule = require('mqtt');
const mqtt = mqttModule.default;
const { EventEmitter } = require('events');

class MqttWorker extends EventEmitter {
  constructor(brokerUrl = 'mqtt://localhost:1883', options = {}) {
    super();
    this.brokerUrl = brokerUrl;
    this.options = options;
    this.client = null;
    this.messages = [];
    this.topics = new Set();
    this.maxMessages = 10000;
  }

  start() {
    this.client = mqtt.connect(this.brokerUrl, this.options);
    this.client.on('connect', () => {
      console.log(`[MqttWorker] Connected to MQTT broker at ${this.brokerUrl}`);
      this.client.subscribe('#', (err) => {
        if (err) console.error('MQTT subscribe error:', err);
      });
    });
    this.client.on('message', (topic, msgBuf) => {
      const payload = msgBuf.toString();
      const timestamp = new Date().toISOString();
      const message = { timestamp, topic, payload };
      this._storeMessage(message);
      this.emit('message', message);
    });
    this.client.on('error', (err) => console.error('MQTT error:', err));
  }

  publish(topic, payload) {
    if (!this.client) {
      console.error('MQTT client not connected');
      return;
    }
    const msgStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    // Publish to broker
    this.client.publish(topic, msgStr);
  }

  getMessages() {
    return [...this.messages];
  }

  getTopics() {
    return Array.from(this.topics);
  }

  _storeMessage(message) {
    this.messages.push(message);
    this.topics.add(message.topic);
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
  }
}

module.exports = MqttWorker; 