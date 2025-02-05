import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

let data = { content: "Edit me" };

app.get('/api/content', (req, res) => {
  res.json(data);
});

app.post('/api/content', (req, res) => {
  data = req.body;
  res.json(data);
});

app.listen(3000, () => console.log('Backend running on http://localhost:3000'));