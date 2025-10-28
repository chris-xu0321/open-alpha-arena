#!/usr/bin/env python3
"""
Migration Script: Set default ai_model_id for AI accounts

This script fixes AI accounts that were created before the ai_model_id migration.
It sets a default ai_model_id for any AI account that has NULL or empty ai_model_id.

Usage:
    uv run python migrate_ai_accounts.py [--model-id MODEL_ID] [--dry-run]

Options:
    --model-id MODEL_ID    AI model ID to use (default: gpt-4o-mini)
    --dry-run             Show what would be changed without making changes
"""
import sqlite3
import sys
import argparse

VALID_MODEL_IDS = [
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
    "claude-3-opus",
    "claude-3-sonnet"
]

def migrate_accounts(model_id: str, dry_run: bool = False):
    """Migrate AI accounts to have ai_model_id set"""
    db_path = "data.db"

    # Validate model ID
    if model_id not in VALID_MODEL_IDS:
        print(f"Error: Invalid model ID '{model_id}'", file=sys.stderr)
        print(f"Valid model IDs: {', '.join(VALID_MODEL_IDS)}", file=sys.stderr)
        sys.exit(1)

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Find AI accounts without ai_model_id
        cursor.execute("""
            SELECT id, name, current_cash
            FROM accounts
            WHERE account_type = 'AI' AND (ai_model_id IS NULL OR ai_model_id = '')
        """)

        accounts_to_fix = cursor.fetchall()

        if not accounts_to_fix:
            print("\nNo migration needed. All AI accounts have ai_model_id set.")
            conn.close()
            return 0

        print("\n" + "="*80)
        if dry_run:
            print("DRY RUN MODE - No changes will be made")
        else:
            print("MIGRATION: Setting ai_model_id for AI accounts")
        print("="*80)

        print(f"\nFound {len(accounts_to_fix)} AI account(s) without ai_model_id:\n")

        for acc_id, name, cash in accounts_to_fix:
            print(f"  Account ID {acc_id}: {name} (${cash:.2f})")

        print(f"\nModel ID to set: {model_id}")

        if dry_run:
            print("\n[DRY RUN] Would update these accounts but not making changes.")
            conn.close()
            return 0

        # Perform the migration
        print("\nApplying migration...")

        for acc_id, name, _ in accounts_to_fix:
            cursor.execute("""
                UPDATE accounts
                SET ai_model_id = ?
                WHERE id = ?
            """, (model_id, acc_id))
            print(f"  [OK] Updated account {acc_id}: {name}")

        conn.commit()

        print("\n" + "="*80)
        print("MIGRATION COMPLETE")
        print("="*80)
        print(f"\nSuccessfully updated {len(accounts_to_fix)} account(s).")

        # Verify
        cursor.execute("""
            SELECT COUNT(*)
            FROM accounts
            WHERE account_type = 'AI' AND (ai_model_id IS NULL OR ai_model_id = '')
        """)

        remaining = cursor.fetchone()[0]

        if remaining == 0:
            print("\n[OK] All AI accounts now have ai_model_id set.")
        else:
            print(f"\n[WARNING] {remaining} AI account(s) still without ai_model_id.")

        conn.close()

        print("\nPlease restart the backend server for changes to take effect.\n")
        return 0

    except sqlite3.Error as e:
        print(f"\nDatabase error: {e}", file=sys.stderr)
        if conn:
            conn.rollback()
            conn.close()
        return 1
    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        if conn:
            conn.rollback()
            conn.close()
        return 1

def main():
    parser = argparse.ArgumentParser(
        description="Migrate AI accounts to have ai_model_id set",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"Valid model IDs:\n  " + "\n  ".join(VALID_MODEL_IDS)
    )
    parser.add_argument(
        "--model-id",
        default="gpt-4o-mini",
        help="AI model ID to use (default: gpt-4o-mini)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without making changes"
    )

    args = parser.parse_args()

    return migrate_accounts(args.model_id, args.dry_run)

if __name__ == "__main__":
    sys.exit(main())
