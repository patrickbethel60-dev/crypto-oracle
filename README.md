
# CryptoOracle — Live Crypto Intelligence Platform

![CryptoOracle Preview](https://via.placeholder.com/1200x600/0c1120/f7931a?text=CryptoOracle+Dashboard)

CryptoOracle is a real-time cryptocurrency intelligence platform that provides live price tracking, AI-powered market predictions, and an interactive chat assistant powered by Google's Gemini AI. The platform monitors Bitcoin, Ethereum, Solana, and BNB with historical data storage and price alerts.

## 🚀 Features

### 📊 Live Market Data
- Real-time price tracking for BTC, ETH, SOL, and BNB
- Interactive charts with multiple timeframes (1D, 7D, 1M, 1Y)
- Sparklines for quick trend visualization
- 24-hour highs/lows, market cap, and volume data

### 🤖 AI-Powered Predictions
- Market sentiment analysis using Gemini AI
- Confidence scores and detailed factor breakdown
- Historical prediction tracking
- Manual prediction trigger for any coin

### 💬 Smart Chat Assistant
- Context-aware AI chat with live market data
- Pre-built suggestion buttons for common queries
- Real-time price data included in conversations
- Powered by Gemini 2.0 Flash model

### 🔔 Price Alerts
- Set custom price alerts (above/below)
- Persistent storage with MySQL database
- Desktop notifications when alerts trigger
- Visual indicator for triggered alerts

### 📈 Historical Tracking
- All price movements stored in database
- Trend detection and categorization
- Prediction history with actual prices
- Session-based realtime charts

## 🛠️ Technology Stack

### Frontend
- HTML5, CSS3, JavaScript (Vanilla)
- Chart.js for data visualization
- Google Fonts (Syne, Space Mono)
- Responsive design with CSS Grid/Flexbox

### Backend
- Node.js with Express
- MySQL database (Aiven Cloud)
- Google Gemini AI API
- CoinGecko API for market data

### Database Schema
```sql
-- Price history table
CREATE TABLE crypto_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coin VARCHAR(10),
    price DECIMAL(20,8),
    price_change_24h DECIMAL(10,2),
    volume DECIMAL(30,2),
    market_cap DECIMAL(30,2),
    high_24h DECIMAL(20,8),
    low_24h DECIMAL(20,8),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Predictions table
CREATE TABLE crypto_predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coin VARCHAR(10),
    verdict ENUM('BULLISH','BEARISH','NEUTRAL'),
    confidence INT,
    summary TEXT,
    price_target VARCHAR(100),
    factors JSON,
    price_at_prediction DECIMAL(20,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trends table
CREATE TABLE crypto_trends (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coin VARCHAR(10),
    price DECIMAL(20,8),
    price_change DECIMAL(10,2),
    description VARCHAR(255),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alerts table
CREATE TABLE crypto_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coin VARCHAR(10),
    alert_type ENUM('above','below'),
    target_price DECIMAL(20,8),
    message VARCHAR(255),
    triggered BOOLEAN DEFAULT FALSE,
    triggered_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
