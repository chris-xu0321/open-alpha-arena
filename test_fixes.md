# Testing Guide for Order Execution & AI Trading Fixes

## Quick Start

```bash
# Start the backend
cd backend
uv run uvicorn main:app --reload --port 5611 --host 0.0.0.0
```

## What to Look For on Startup

### Expected Output on Startup:

```
INFO:     Scheduler service started
INFO:     Market scheduled tasks have been set up
INFO:     Automatic cryptocurrency trading task started (5-minute interval)
INFO:     Price cache cleanup task started (2-minute interval)

# Then you should see ONE of these banners:

# If AI trading is DISABLED (default state):
WARNING:  ============================================================
WARNING:  ⚠ AI TRADING IS DISABLED
WARNING:    Reason: No accounts with valid API keys found
WARNING:    Action Required:
WARNING:      1. Open the web interface
WARNING:      2. Go to Settings
WARNING:      3. Update account API key with a valid OpenAI-compatible key
WARNING:      4. AI trading will start automatically at next 5-minute cycle
WARNING:  ============================================================

# OR if AI trading is ACTIVE (after configuring API key):
INFO:     ============================================================
INFO:     ✓ AI TRADING IS ACTIVE
INFO:       Active Accounts: 1
INFO:         - GPT (Model: gpt-4o)
INFO:       Trading Interval: Every 5 minutes
INFO:     ============================================================

INFO:     All services initialized successfully
```

## Test 1: Order Execution Logging

### Steps:
1. Start backend with the command above
2. Open web interface at http://localhost:5611
3. Place a MARKET BUY order for 0.01 BTC

### Expected Logs:
```
INFO:     MARKET order abc123 ready to execute at $96543.21
INFO:     ✓ Order abc123 executed successfully at $96543.21
```

### If Order Stays PENDING:
```
ERROR:    Error checking order abc123: [error details]
ERROR:    MARKET order abc123 failed to execute due to price fetch error.
ERROR:    Symbol: BTC, Market: CRYPTO
```

This tells you exactly why the order didn't execute (likely Hyperliquid API issue).

## Test 2: AI Trading Status (Disabled)

### Steps:
1. Start backend (fresh install with default API key)
2. Check logs for the warning banner (see above)
3. Wait 5 minutes for first AI trading cycle

### Expected Logs Every 5 Minutes:
```
INFO:     === AI Trading Cycle Starting ===
WARNING:  ⚠ AI Trading Disabled: No accounts with valid API keys
WARNING:    → Please configure at least one account with a real API key in Settings
INFO:     === AI Trading Cycle Skipped: No valid accounts ===
```

## Test 3: Enable AI Trading

### Steps:
1. Open web interface at http://localhost:5611
2. Click "Settings" (top right)
3. Update account settings:
   - **API Key:** Your actual OpenAI API key (or compatible)
   - **Model:** gpt-4o (or your preferred model)
   - **Base URL:** https://api.openai.com/v1 (or your endpoint)
4. Save settings
5. Wait for next 5-minute AI trading cycle (or restart backend)

### Expected Logs on Next Cycle:
```
INFO:     === AI Trading Cycle Starting ===
INFO:     ✓ AI Trading Active: 1 account(s) with valid API keys
INFO:     === Processing 1 AI account(s) ===
INFO:     ✓ Fetched prices for 6 symbols: BTC, ETH, SOL, BNB, XRP, DOGE
INFO:     Processing AI trading for account: GPT
INFO:     AI decision for GPT: buy BTC (portion: 15.00%) - Bitcoin showing bullish momentum
INFO:     MARKET order xyz789 ready to execute at $96543.21
INFO:     ✓ Order xyz789 executed successfully at $96543.21
INFO:     AI order executed: account=GPT BUY BTC xyz789 quantity=0.015 reason='Bitcoin showing bullish momentum'
```

## Test 4: Price Fetch Errors

### Simulate API Failure:
If Hyperliquid API is down or rate-limited:

### Expected Logs:
```
ERROR:    ⚠ Failed to fetch market prices for AI trading
ERROR:      → Attempted symbols: BTC, ETH, SOL, BNB, XRP, DOGE
ERROR:      → AI trading cycle aborted
```

This prevents AI trading from making blind trades without price data.

## Troubleshooting

### Orders Stay PENDING
**Check logs for:**
- `"Error checking order"` - Price fetch failed
- `"MARKET order failed due to price fetch error"` - Critical issue with market data API

**Solutions:**
- Verify internet connection
- Check if Hyperliquid API is accessible
- Check backend logs for CCXT/network errors

### AI Trading Not Starting
**Check logs for:**
- `"⚠ AI TRADING IS DISABLED"` banner on startup
- `"No accounts with valid API keys"` warnings every 5 minutes

**Solutions:**
- Update account API key in Settings UI
- Verify API key is not "default-key-please-update-in-settings"
- Restart backend to see new startup banner

### AI Trading Making Bad Decisions
**Check logs for:**
- `"AI decision for [account]:"` - Shows what AI decided
- `"reason:"` - AI's explanation for the trade

**Solutions:**
- Review AI decision logs in UI
- Adjust AI model parameters in Settings
- Consider using a different model or base_url

## Success Criteria

✅ **Order Execution Working:**
- MARKET orders execute within 1 second
- Clear log messages showing execution status
- Orders don't stay PENDING without explanation

✅ **AI Trading Working:**
- Startup banner shows "✓ AI TRADING IS ACTIVE"
- Every 5 minutes: AI trading cycle runs successfully
- AI decisions logged with reasoning
- Orders created and executed based on AI decisions

✅ **Error Handling Working:**
- Clear error messages when price fetch fails
- Clear warnings when API keys are invalid
- No silent failures - everything is logged

## Common Log Patterns

### Healthy System:
```
[Startup] ✓ AI TRADING IS ACTIVE
[Every 10s] Snapshot updates sent to clients
[Every 5min] === AI Trading Cycle Starting ===
[Every 5min] AI order executed successfully
[Order] MARKET order ready to execute
[Order] ✓ Order executed successfully
```

### System Needs Configuration:
```
[Startup] ⚠ AI TRADING IS DISABLED
[Every 5min] === AI Trading Cycle Skipped ===
[Every 5min] No accounts with valid API keys
```

### System Has Issues:
```
[Order] Error checking order: [exception]
[AI] ⚠ Failed to fetch market prices
[AI] AI API request failed after 3 attempts
```

## Next Steps

After testing, if issues persist:
1. Check backend logs for full error stack traces
2. Verify Hyperliquid API is accessible: `curl https://api.hyperliquid.xyz/info`
3. Test API key with: `curl -H "Authorization: Bearer YOUR_KEY" https://api.openai.com/v1/models`
4. Check CCXT library installation: `uv pip list | grep ccxt`

## Notes

- **5-minute cycle:** AI trading runs every 300 seconds (configurable in startup.py)
- **Price cache:** Prices cached for 60 seconds to reduce API calls
- **Rate limiting:** CCXT automatically handles Hyperliquid rate limits
- **Logging levels:** Use `--log-level debug` for maximum verbosity
