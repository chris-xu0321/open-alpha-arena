# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open Alpha Arena is a cryptocurrency trading simulation platform with AI-driven decision making. It combines a Python FastAPI backend with a React TypeScript frontend in a monorepo structure, enabling users to test AI trading strategies on paper trading accounts using real market data from Hyperliquid exchange.

**Tech Stack:**
- Backend: Python 3.13 + FastAPI + SQLAlchemy + APScheduler
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- Database: SQLite
- Market Data: CCXT (Hyperliquid exchange)
- AI Integration: OpenAI-compatible APIs

## Development Commands

### Initial Setup
```bash
# Install all dependencies (JS and Python)
pnpm run install:all
```

### Development Servers
```bash
# Run both backend and frontend concurrently
pnpm run dev

# Run backend only (port 5611)
pnpm run dev:backend

# Run frontend only (port 5621)
pnpm run dev:frontend

# Alternative: Run backend on port 5621 (from backend directory)
cd backend
uv sync
uv run uvicorn main:app --reload --port 5621 --host 0.0.0.0
```

### Building
```bash
# Build frontend (backend has no build step)
pnpm run build

# Or build frontend only
pnpm run build:frontend
```

### Python Environment
```bash
# From backend directory
cd backend

# Sync dependencies
uv sync

# Add new dependency
uv add <package-name>

# Run Python scripts
uv run python <script.py>

# Run uvicorn directly
uv run uvicorn main:app --reload --port 5611 --host 0.0.0.0
```

### Docker
```bash
# Build and run with Docker Compose
docker-compose up --build

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f
```

## Architecture

### Backend Structure (`/backend`)

**Entry Point:** `main.py`
- FastAPI application with CORS middleware
- WebSocket endpoint at `/ws`
- Mounts built frontend static files at `/static`
- SPA fallback routing for React frontend
- Startup: Creates DB tables, seeds configs, initializes default user/account, starts scheduler

**Database Models** (`database/models.py`):
- `User` - Authentication (single "default" user in demo mode)
- `Account` - Trading accounts with AI configuration (model, base_url, api_key)
- `Position` - Current holdings (supports fractional quantities for crypto)
- `Order` - Trading orders (PENDING/FILLED/CANCELLED)
- `Trade` - Executed transactions
- `CryptoKline` - OHLCV market data
- `AIDecisionLog` - AI trading decision history with execution status
- `TradingConfig` - Market-specific trading rules

**API Routes** (`api/`):
- `market_data_routes.py` - Market data endpoints
- `order_routes.py` - Order CRUD and execution
- `account_routes.py` - Account management (create/update AI accounts)
- `crypto_routes.py` - Crypto symbols and prices
- `ranking_routes.py` - Performance rankings
- `config_routes.py` - System configuration
- `ws.py` - WebSocket real-time updates

**Services** (`services/`):
- `scheduler.py` - APScheduler wrapper for periodic tasks
- `market_data.py` - Market data abstraction layer
- `hyperliquid_market_data.py` - CCXT-based exchange integration
- `order_matching.py` - Order validation, creation, and execution engine
- `ai_decision_service.py` - AI model API calls and decision logging
- `trading_commands.py` - AI-driven and random trading logic
- `news_feed.py` - CoinJournal RSS feed integration
- `asset_calculator.py` - Portfolio valuation
- `asset_curve_calculator.py` - Historical performance tracking
- `startup.py` - Service initialization and shutdown

**Repositories** (`repositories/`):
- Centralized data access layer (user, account, order, position, kline)

### Frontend Structure (`/frontend`)

**Entry Point:** `app/main.tsx`
- WebSocket singleton pattern (handles React StrictMode double-mounting)
- Message protocol: bootstrap, snapshot, place_order, switch_account
- Three views: Portfolio, Comprehensive (dashboard), Asset Curve

**Components** (`app/components/`):
- `layout/` - Header, Sidebar, AccountSelector, SettingsDialog
- `trading/` - TradingPanel, OrderForm, TradeButtons
- `portfolio/` - Portfolio, AssetCurve, ComprehensiveView
- `crypto/` - CryptoSelector
- `ui/` - shadcn/ui primitives (Button, Input, Dialog, etc.)

**API Client** (`app/lib/api.ts`):
- REST API client with typed functions
- Base URL: `/api` (proxied in dev via Vite)

## Key Workflows

### Order Placement Flow
1. User inputs order in TradingPanel (frontend)
2. WebSocket message sent to `/ws` with order details
3. Backend `order_matching.create_order()` validates funds/positions
4. Order created in PENDING status
5. **Immediate execution attempt:** `check_and_execute_order()` runs immediately after order creation
6. **Order matching logic:**
   - **MARKET orders**: Execute immediately at current market price (guaranteed fill)
   - **LIMIT BUY orders**: Execute only when `limit_price >= current_market_price`
   - **LIMIT SELL orders**: Execute only when `limit_price <= current_market_price`
7. If executed: Creates Trade, updates Position, adjusts Account cash, marks order as FILLED
8. If not executed: Order stays PENDING (waiting for price conditions to be met)
9. WebSocket broadcasts appropriate message (`order_filled` or `order_pending`)
10. WebSocket sends updated snapshot to all clients
11. Frontend updates UI with new data

### AI Trading Flow (Every 5 Minutes)
1. Scheduler triggers `trading_commands.place_ai_driven_crypto_order()`
2. Get all active AI accounts (with non-default API keys)
3. For each account:
   - Fetch latest prices for BTC, ETH, SOL, BNB, XRP, DOGE
   - Fetch current portfolio from database
   - Fetch latest news from CoinJournal RSS
4. Call AI model API with prompt (portfolio + prices + news)
5. Parse JSON response: `{operation: "buy"|"sell"|"hold", symbol, target_portion_of_balance, reason}`
6. Save decision to `AIDecisionLog` table
7. If buy/sell: Calculate quantity (max 20% of portfolio), create and execute order
8. Broadcast update to WebSocket clients

### Real-Time Updates
- WebSocket clients subscribe to account snapshots (10-second interval)
- Server enriches positions with latest prices
- Broadcasts: positions, orders, trades, AI decisions, account overview
- Frontend reactively updates UI on snapshot receipt

## Important Patterns

### Frozen Cash for Pending Orders
- `Account.frozen_cash` locks funds in pending orders
- Prevents over-committing cash from multiple pending orders
- Available balance = `current_cash - frozen_cash`

### Fractional Crypto Support
- No lot size validation for crypto (unlike traditional stocks)
- Allows quantities like 0.0001 BTC, 0.5 ETH, etc.
- Backend: Quantity converted to `float` in `ws.py:554`
- Frontend: Input field uses `parseFloat` and `step="any"` in `OrderForm.tsx:240`
- See `order_matching.py:56-57` for validation

### Single Default User Pattern
- Backend enforces single "default" user on startup (demo mode)
- Deletes all non-default users and their data
- Maintains multi-user schema for future extensibility
- See `main.py:56-77`

### WebSocket Singleton Management
- Module-level singleton prevents duplicate connections in React StrictMode
- Global `__WS_SINGLETON__` persists across component re-mounts
- See `main.tsx:13-20`

### AI Decision Logging Before Execution
- Creates `AIDecisionLog` entry before attempting order execution
- Maintains audit trail of all AI decisions (including failures)
- `executed` field tracks whether order was successfully placed

### Commission Calculation
```python
commission = max(notional_value * 0.001, 0.10)  # Min $0.10, 0.1% rate
```

## Configuration

### Trading Configuration
- Commission rate: 0.1%
- Min commission: $0.10
- Min order quantity: 1 (crypto supports fractional)
- Auto-trade interval: 300 seconds (5 minutes)
- Max trade ratio: 20% of portfolio per AI decision

### Supported Trading Pairs
Hardcoded AI trading symbols: BTC, ETH, SOL, BNB, XRP, DOGE
(Additional symbols available via Hyperliquid API)

### AI Model Configuration
Per account in `Account` table:
- `model` - Model name (e.g., "gpt-4-turbo")
- `base_url` - API endpoint (e.g., "https://api.openai.com/v1")
- `api_key` - Authentication token (must be non-default to enable AI trading)

### Ports
- Backend: 5611 (default)
- Frontend dev server: 5621
- Docker: 5611 (exposed)

### Environment
- Database: `./data.db` (SQLite, persists in Docker volume at `/app/data`)
- CORS: All origins allowed
- WebSocket: `ws://localhost:5611/ws` (or dynamic protocol/host)

## Database

**Connection:** SQLite at `./data.db` with SQLAlchemy ORM

**Key Tables:**
- `users` - Authentication
- `accounts` - Trading accounts with AI config
- `positions` - Current holdings
- `orders` - Trading orders
- `trades` - Executed transactions
- `crypto_klines` - OHLCV market data cache
- `ai_decision_logs` - AI decision history
- `trading_configs` - Market configuration

**Indexes:** symbol, account_id, timestamp (for query performance)

## Testing & Debugging

### Check Backend Health
```bash
curl http://localhost:5611/api/health
```

### View Logs
```bash
# Docker logs
docker-compose logs -f

# Python logging (stdout in dev mode)
uv run uvicorn main:app --reload --log-level debug
```

### Database Inspection
```bash
# From backend directory
sqlite3 data.db

# Useful queries
SELECT * FROM accounts;
SELECT * FROM positions;
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;
SELECT * FROM ai_decision_logs ORDER BY decision_time DESC LIMIT 10;
```

### WebSocket Testing
Use browser console or tools like `wscat`:
```bash
wscat -c ws://localhost:5611/ws

# Send bootstrap message
{"type": "bootstrap", "user": {"username": "default"}, "account": {"id": 1}}

# Request snapshot
{"type": "get_snapshot"}

# Place order
{"type": "place_order", "symbol": "BTC", "side": "BUY", "order_type": "MARKET", "quantity": 0.1}
```

## Common Issues

### Frontend can't connect to backend
- Check backend is running on port 5611
- Verify WebSocket URL in `main.tsx` matches backend port
- Check Vite proxy config in `frontend/vite.config.ts`

### Available cash showing $0
- **Root cause:** TradingPanel receiving wrong user object
- **Fix:** Pass `overview.account` instead of `user` to TradingPanel in `main.tsx`
- The `user` object from WebSocket bootstrap only has `{id, username}`
- The `overview.account` object has full account details including `current_cash` and `frozen_cash`
- See `main.tsx:286`

### Order placement fails with "unexpected keyword argument 'user'"
- **Root cause:** `create_order()` expects `account` parameter, not `user`
- **Fix:** Change `user=user` to `account=account` in `ws.py:562`
- Also ensure market defaults to `"CRYPTO"` not `"US"` in `ws.py:541`

### Orders stay in PENDING status
- **This is expected behavior for LIMIT orders that don't meet execution conditions**
- **MARKET orders:** Execute immediately (use these for instant fills)
- **LIMIT BUY:** Only executes when your limit price >= current market price
  - Example: LIMIT BUY at $95,000 when BTC is $96,000 → stays PENDING
  - Example: LIMIT BUY at $97,000 when BTC is $96,000 → executes immediately
- **LIMIT SELL:** Only executes when your limit price <= current market price
  - Example: LIMIT SELL at $97,000 when BTC is $96,000 → stays PENDING
  - Example: LIMIT SELL at $95,000 when BTC is $96,000 → executes immediately
- This mimics real crypto exchange behavior (Binance, Coinbase, etc.)
- Orders use real-time prices from Hyperliquid via CCXT

### "Only cryptocurrency market supported" error
- **Root cause:** Frontend sending market as `"US"` instead of `"CRYPTO"`
- **Fix:** Change `market` state in `TradingPanel.tsx:25` from `'US'` to `'CRYPTO'`

### Cannot enter fractional quantities (like 0.001 BTC)
- **Root cause:** Input using `parseInt` instead of `parseFloat`
- **Fix:** Update `OrderForm.tsx:240` to use `parseFloat` and add `step="any"` to input

### "datetime is not defined" error in scheduler
- **Root cause:** Missing `datetime` import in `scheduler.py`
- **Fix:** Add `datetime` to imports: `from datetime import datetime, date` (line 12)

### AI trading not working
- Verify account has non-default `api_key` in database
- Check AI model `base_url` is correct and reachable
- Review `ai_decision_logs` table for error messages
- Ensure scheduler is running (logs will show "Starting scheduler")

### Market data not updating
- Verify Hyperliquid exchange is reachable
- Check `crypto_klines` table is being populated
- Review scheduler logs for market data task errors
- CCXT rate limiting may slow down data fetching

### APScheduler warnings about missed run times
- **This is normal:** Snapshot jobs taking longer than 10-second interval
- Happens when fetching market data from external APIs
- Jobs will catch up automatically - functionality not affected
- To reduce warnings: increase snapshot interval or use optimized snapshot function

## Deployment

### Docker Build
Multi-stage build:
1. Frontend stage: Builds React app with Vite
2. Backend stage: Copies built frontend to `/static`, installs Python deps with `uv`

### Production Configuration
- Traefik reverse proxy (configured via Docker labels)
- Domain: `oaa.finan.club`
- HTTPS/TLS with Let's Encrypt
- SQLite database persisted in Docker volume

### Environment Variables
Currently none required (all config in code/database). Future: API keys, database URL, etc.
