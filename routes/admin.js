const express = require('express');
const router = express.Router();

const ADMIN_PASSWORD = 'vasanth0722';

// Login
router.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        // In a real app, use JWT. Here, simple success is enough for the requested scope.
        res.json({ success: true, token: 'admin-session-token' });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

// Get Stats
router.get('/stats', (req, res) => {
    res.json({
        requestCount: global.requestCount || 0,
        priorityMode: global.priorityMode || false
    });
});

// Toggle Priority Mode
router.post('/toggle-priority', (req, res) => {
    const { enabled } = req.body;
    global.priorityMode = enabled;
    console.log(`[Admin] Priority Mode set to: ${enabled}`);
    res.json({ success: true, priorityMode: global.priorityMode });
});

module.exports = router;
