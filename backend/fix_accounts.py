#!/usr/bin/env python3
"""Script to fix AI accounts without ai_model_id"""
import sqlite3
import sys

def fix_accounts():
    db_path = "data.db"
    default_model_id = "gpt-4o-mini"  # Use the working model from account 1

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Find AI accounts without ai_model_id
        cursor.execute("""
            SELECT id, name
            FROM accounts
            WHERE account_type = 'AI' AND (ai_model_id IS NULL OR ai_model_id = '')
        """)

        broken_accounts = cursor.fetchall()

        if not broken_accounts:
            print("\nNo accounts need fixing. All AI accounts have ai_model_id set.")
            conn.close()
            return

        print("\n" + "="*80)
        print("FIXING AI ACCOUNTS")
        print("="*80)
        print(f"\nFound {len(broken_accounts)} AI account(s) to fix:\n")

        for acc_id, name in broken_accounts:
            print(f"  - {name} (ID: {acc_id})")

        print(f"\nWill set ai_model_id to: {default_model_id}")
        print("\nProceeding with fix...")

        # Update accounts
        for acc_id, name in broken_accounts:
            cursor.execute("""
                UPDATE accounts
                SET ai_model_id = ?
                WHERE id = ?
            """, (default_model_id, acc_id))
            print(f"  [OK] Updated {name} (ID: {acc_id})")

        conn.commit()

        print("\n" + "="*80)
        print("FIX COMPLETE")
        print("="*80)
        print(f"\nSuccessfully updated {len(broken_accounts)} account(s).")
        print("\nVerifying changes...\n")

        # Verify the changes
        cursor.execute("""
            SELECT id, name, ai_model_id
            FROM accounts
            WHERE account_type = 'AI'
            ORDER BY id
        """)

        all_accounts = cursor.fetchall()

        for acc_id, name, ai_model_id in all_accounts:
            status = "[OK]" if ai_model_id else "[X]"
            print(f"{status} Account {acc_id} ({name}): ai_model_id = {ai_model_id}")

        conn.close()

        print("\n" + "="*80)
        print("All AI accounts should now be enabled for AI trading.")
        print("Please restart the backend server to see the changes take effect.")
        print("="*80 + "\n")

    except sqlite3.Error as e:
        print(f"Database error: {e}", file=sys.stderr)
        if conn:
            conn.rollback()
            conn.close()
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        if conn:
            conn.rollback()
            conn.close()
        sys.exit(1)

if __name__ == "__main__":
    fix_accounts()
