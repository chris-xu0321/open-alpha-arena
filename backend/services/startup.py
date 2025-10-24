"""Application startup initialization service"""

import logging
import threading

from services.auto_trader import (
    place_ai_driven_crypto_order,
    place_random_crypto_order,
    AUTO_TRADE_JOB_ID,
    AI_TRADE_JOB_ID
)
from services.scheduler import start_scheduler, setup_market_tasks, task_scheduler

logger = logging.getLogger(__name__)


def initialize_services():
    """Initialize all services"""
    try:
        # Start the scheduler
        start_scheduler()
        logger.info("Scheduler service started")

        # Set up market-related scheduled tasks
        setup_market_tasks()
        logger.info("Market scheduled tasks have been set up")

        # Start automatic cryptocurrency trading simulation task (5-minute interval)
        schedule_auto_trading(interval_seconds=300)
        logger.info("Automatic cryptocurrency trading task started (5-minute interval)")

        # Add price cache cleanup task (every 2 minutes)
        from services.price_cache import clear_expired_prices
        task_scheduler.add_interval_task(
            task_func=clear_expired_prices,
            interval_seconds=120,  # Clean every 2 minutes
            task_id="price_cache_cleanup"
        )
        logger.info("Price cache cleanup task started (2-minute interval)")

        # Check AI trading configuration status
        _check_ai_trading_status()

        logger.info("All services initialized successfully")

    except Exception as e:
        logger.error(f"Service initialization failed: {e}")
        raise


def _check_ai_trading_status():
    """Check and report AI trading configuration status on startup"""
    try:
        from database.connection import SessionLocal
        from services.ai_decision_service import get_active_ai_accounts

        db = SessionLocal()
        try:
            accounts = get_active_ai_accounts(db)
            if accounts:
                logger.info("=" * 60)
                logger.info("✓ AI TRADING IS ACTIVE")
                logger.info(f"  Active Accounts: {len(accounts)}")
                for acc in accounts:
                    logger.info(f"    - {acc.name} (Model: {acc.model})")
                logger.info("  Trading Interval: Every 5 minutes")
                logger.info("=" * 60)
            else:
                logger.warning("=" * 60)
                logger.warning("⚠ AI TRADING IS DISABLED")
                logger.warning("  Reason: No accounts with valid API keys found")
                logger.warning("  Action Required:")
                logger.warning("    1. Open the web interface")
                logger.warning("    2. Go to Settings")
                logger.warning("    3. Update account API key with a valid OpenAI-compatible key")
                logger.warning("    4. AI trading will start automatically at next 5-minute cycle")
                logger.warning("=" * 60)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to check AI trading status: {e}")


def shutdown_services():
    """Shut down all services"""
    try:
        from services.scheduler import stop_scheduler
        stop_scheduler()
        logger.info("All services have been shut down")
        
    except Exception as e:
        logger.error(f"Failed to shut down services: {e}")


async def startup_event():
    """FastAPI application startup event"""
    initialize_services()


async def shutdown_event():
    """FastAPI application shutdown event"""
    await shutdown_services()


def schedule_auto_trading(interval_seconds: int = 300, max_ratio: float = 0.2, use_ai: bool = True) -> None:
    """Schedule automatic trading tasks
    
    Args:
        interval_seconds: Interval between trading attempts
        max_ratio: Maximum portion of portfolio to use per trade
        use_ai: If True, use AI-driven trading; if False, use random trading
    """
    from services.auto_trader import (
        place_ai_driven_crypto_order,
        place_random_crypto_order,
        AUTO_TRADE_JOB_ID,
        AI_TRADE_JOB_ID
    )

    def execute_trade():
        try:
            if use_ai:
                place_ai_driven_crypto_order(max_ratio)
            else:
                place_random_crypto_order(max_ratio)
            logger.info("Initial auto-trading execution completed")
        except Exception as e:
            logger.error(f"Error during initial auto-trading execution: {e}")

    if use_ai:
        task_func = place_ai_driven_crypto_order
        job_id = AI_TRADE_JOB_ID
        logger.info("Scheduling AI-driven crypto trading")
    else:
        task_func = place_random_crypto_order
        job_id = AUTO_TRADE_JOB_ID
        logger.info("Scheduling random crypto trading")

    # Schedule the recurring task
    task_scheduler.add_interval_task(
        task_func=task_func,
        interval_seconds=interval_seconds,
        task_id=job_id,
        max_ratio=max_ratio,
    )
    
    # Execute the first trade immediately in a separate thread to avoid blocking
    initial_trade = threading.Thread(target=execute_trade, daemon=True)
    initial_trade.start()