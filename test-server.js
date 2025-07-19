const express = require('express');
const app = express();
const port = 3002;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Test server is running' });
});

app.listen(port, () => {
  console.log(`Test server running on port ${port}`);
});