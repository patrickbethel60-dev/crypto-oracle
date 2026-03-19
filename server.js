require('dotenv').config();

const fetch = require('node-fetch');
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ── Database ──────────────────────────────────────────────────────────────────
const db = mysql.createConnection({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
    } else {
        console.log('Connected to Aiven database!');
    }
});

// ── Gemini Helper ─────────────────────────────────────────────────────────────
// Uses direct REST API so no package version issues
async function callGemini(prompt, systemPrompt, history = []) {
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const MODEL = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;

    // Build contents array from history + new message
    const contents = [];

    // Add history
    history.forEach(msg => {
        contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        });
    });

    // Add current message
    contents.push({
        role: 'user',
        parts: [{ text: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt }]
    });

    const body = {
        contents,
        generationConfig: { maxOutputTokens: 800 }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        // Check for quota exceeded error
        if (data.error) {
            if (data.error.message.includes('Quota exceeded')) {
                console.log('Quota exceeded, using fallback response');
                return getFallbackResponse(prompt);
            }
            throw new Error(data.error.message);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return text;
        
    } catch (error) {
        console.error('Gemini API error:', error.message);
        return getFallbackResponse(prompt);
    }
}

function getFallbackResponse(prompt) {
    // Check if this is a prediction request
    if (prompt.includes('"verdict": "BULLISH"')) {
        // Extract coin name from the prompt
        const coinMatch = prompt.match(/Analyze (.*?) with/);
        const coin = coinMatch ? coinMatch[1] : 'Bitcoin';
        
        // Return a reasonable fallback prediction
        return `{
  "verdict": "NEUTRAL",
  "confidence": 50,
  "summary": "Unable to get AI analysis due to API quota limits. Based on basic market data, the trend appears neutral with typical volatility for ${coin}.",
  "factors": [
    {"icon": "⚠️", "text": "AI analysis temporarily unavailable"},
    {"icon": "📊", "text": "Check back in 60 seconds when quota resets"},
    {"icon": "💡", "text": "Market data still updating live"}
  ],
  "priceTarget": "See chart for current levels"
}`;
    }
    
    // Check if this is a chat request
    if (prompt.includes('User question:')) {
        return "I'm currently at my API quota limit. Please wait about 60 seconds and try again. In the meantime, you can still see live price data and charts!";
    }
    
    // Generic fallback
    return "Service temporarily unavailable. Please wait a moment and try again.";
}
// ── Price History ─────────────────────────────────────────────────────────────

app.post('/prices', (req, res) => {
    const { coin, price, price_change_24h, volume, market_cap, high_24h, low_24h } = req.body;
    db.query(
        'INSERT INTO crypto_prices (coin, price, price_change_24h, volume, market_cap, high_24h, low_24h) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [coin, price, price_change_24h, volume, market_cap, high_24h, low_24h],
        (err) => {
            if (err) return res.status(500).json({ error: 'Failed to save price' });
            res.json({ message: 'Price saved' });
        }
    );
});

app.get('/prices/:coin', (req, res) => {
    const limit = req.query.limit || 100;
    db.query(
        'SELECT * FROM crypto_prices WHERE coin = ? ORDER BY recorded_at DESC LIMIT ?',
        [req.params.coin, parseInt(limit)],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Failed to get prices' });
            res.json(results);
        }
    );
});

// ── Predictions ───────────────────────────────────────────────────────────────

app.post('/predictions', (req, res) => {
    const { coin, verdict, confidence, summary, price_target, factors, price_at_prediction } = req.body;
    db.query(
        'INSERT INTO crypto_predictions (coin, verdict, confidence, summary, price_target, factors, price_at_prediction) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [coin, verdict, confidence, summary, price_target, JSON.stringify(factors), price_at_prediction],
        (err) => {
            if (err) {
                console.error('Save prediction error:', err.message);
                return res.status(500).json({ error: 'Failed to save prediction' });
            }
            res.json({ message: 'Prediction saved' });
        }
    );
});

app.get('/predictions/all', (req, res) => {
    db.query(
        'SELECT * FROM crypto_predictions ORDER BY created_at DESC LIMIT 50',
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Failed to get predictions' });
            res.json(results);
        }
    );
});

app.get('/predictions/:coin', (req, res) => {
    const limit = req.query.limit || 20;
    db.query(
        'SELECT * FROM crypto_predictions WHERE coin = ? ORDER BY created_at DESC LIMIT ?',
        [req.params.coin, parseInt(limit)],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Failed to get predictions' });
            res.json(results);
        }
    );
});

// ── Trends ────────────────────────────────────────────────────────────────────

app.post('/trends', (req, res) => {
    const { coin, price, price_change, description } = req.body;
    db.query(
        'INSERT INTO crypto_trends (coin, price, price_change, description) VALUES (?, ?, ?, ?)',
        [coin, price, price_change, description],
        (err) => {
            if (err) return res.status(500).json({ error: 'Failed to save trend' });
            res.json({ message: 'Trend saved' });
        }
    );
});

app.get('/trends/:coin', (req, res) => {
    const limit = req.query.limit || 30;
    db.query(
        'SELECT * FROM crypto_trends WHERE coin = ? ORDER BY recorded_at DESC LIMIT ?',
        [req.params.coin, parseInt(limit)],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Failed to get trends' });
            res.json(results);
        }
    );
});

// ── Alerts ────────────────────────────────────────────────────────────────────

app.post('/alerts', (req, res) => {
    const { coin, alert_type, target_price, message } = req.body;
    db.query(
        'INSERT INTO crypto_alerts (coin, alert_type, target_price, message) VALUES (?, ?, ?, ?)',
        [coin, alert_type, target_price, message],
        (err, result) => {
            if (err) {
                console.error('Alert error:', err.message);
                return res.status(500).json({ error: 'Failed to create alert' });
            }
            res.json({ message: 'Alert created', id: result.insertId });
        }
    );
});

app.get('/alerts/all', (req, res) => {
    db.query(
        'SELECT * FROM crypto_alerts ORDER BY created_at DESC LIMIT 50',
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Failed to get alerts' });
            res.json(results);
        }
    );
});

app.get('/alerts', (req, res) => {
    db.query(
        'SELECT * FROM crypto_alerts WHERE triggered = FALSE ORDER BY created_at DESC',
        (err, results) => {
            if (err) {
                console.error('Get alerts error:', err.message);
                return res.status(500).json({ error: 'Failed to get alerts' });
            }
            res.json(results);
        }
    );
});

app.put('/alerts/:id/trigger', (req, res) => {
    db.query(
        'UPDATE crypto_alerts SET triggered = TRUE, triggered_at = NOW() WHERE id = ?',
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: 'Failed to trigger alert' });
            res.json({ message: 'Alert triggered' });
        }
    );
});

app.delete('/alerts/:id', (req, res) => {
    db.query(
        'DELETE FROM crypto_alerts WHERE id = ?',
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: 'Failed to delete alert' });
            res.json({ message: 'Alert deleted' });
        }
    );
});

// ── Stats ─────────────────────────────────────────────────────────────────────

app.get('/stats', (req, res) => {
    db.query(`
        SELECT
            (SELECT COUNT(*) FROM crypto_prices) as total_price_records,
            (SELECT COUNT(*) FROM crypto_predictions) as total_predictions,
            (SELECT COUNT(*) FROM crypto_trends) as total_trends,
            (SELECT COUNT(*) FROM crypto_alerts WHERE triggered = FALSE) as active_alerts,
            (SELECT COUNT(*) FROM crypto_alerts WHERE triggered = TRUE) as triggered_alerts
    `, (err, results) => {
        if (err) return res.status(500).json({ error: 'Failed to get stats' });
        res.json(results[0]);
    });
});

// ── AI Chat ───────────────────────────────────────────────────────────────────

app.post('/chat', async (req, res) => {
    const { messages, systemPrompt } = req.body;
    console.log('Chat request received, messages:', messages?.length);

    try {
        const lastMessage = messages[messages.length - 1]?.content || '';
        const history = messages.slice(0, -1);
        const text = await callGemini(lastMessage, systemPrompt, history);
        console.log('Gemini chat response received');
        // Return in format index.html expects
        res.json({ content: [{ text }] });
    } catch(e) {
        console.error('Chat error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ── AI Prediction ─────────────────────────────────────────────────────────────

app.post('/predict', async (req, res) => {
    const { coin, coinData, trends } = req.body;
    console.log('Prediction request for:', coin);

    try {
        const prompt = `You are an expert crypto analyst. Analyze ${coin} with this live data:
${JSON.stringify(coinData, null, 2)}

Recent trends: ${JSON.stringify(trends)}

Respond ONLY with this exact JSON (no markdown, no extra text):
{
  "verdict": "BULLISH" or "BEARISH" or "NEUTRAL",
  "confidence": number 0-100,
  "summary": "2 sentence analysis",
  "factors": [
    {"icon": "emoji", "text": "factor 1"},
    {"icon": "emoji", "text": "factor 2"},
    {"icon": "emoji", "text": "factor 3"}
  ],
  "priceTarget": "short price target string"
}`;

        let text = await callGemini(prompt, null, []);
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const prediction = JSON.parse(text);
        console.log('Prediction result:', prediction.verdict);
        res.json(prediction);
    } catch(e) {
        console.error('Predict error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.listen(3000, () => {
    console.log('Crypto server running on port 3000');
});
