import express from 'express';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'IRS Hold Hunter API'
  });
});

export default router;
