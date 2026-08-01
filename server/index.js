require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/config', require('./routes/config'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/fornitori', require('./routes/fornitori'));
app.use('/api/preventivi', require('./routes/preventivi'));
app.use('/api/costi', require('./routes/costi'));
app.use('/api/scadenze', require('./routes/scadenze'));
app.use('/api/location', require('./routes/location'));
app.use('/api/documenti', require('./routes/documenti'));
app.use('/api/idee', require('./routes/idee'));
app.use('/api/profilo', require('./routes/profilo'));
app.use('/api/email-config', require('./routes/email-config'));

// Serve React build in production
const clientDist = path.join(__dirname, '../client/dist');
if (require('fs').existsSync(clientDist)) {
  app.use(express.static(clientDist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));
  app.get('/{*splat}', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server avviato su porta ${PORT}`));
