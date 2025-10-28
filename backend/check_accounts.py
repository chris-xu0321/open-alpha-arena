#!/usr/bin/env python3
"""Script to check account configuration in the database"""
import sqlite3
import sys

def check_accounts():
    db_path = "data.db"

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Query accounts table
        cursor.execute("""
            SELECT id, name, account_type, ai_model_id, is_active, current_cash
            FROM accounts
            ORDER BY id
        """)

        accounts = cursor.fetchall()

        print("\n" + "="*80)
        print("ACCOUNTS TABLE ANALYSIS")
        print("="*80)

        if not accounts:
            print("\nNo accounts found in database.")
            return

        print(f"\nFound {len(accounts)} account(s):\n")

        for acc in accounts:
            acc_id, name, acc_type, ai_model_id, is_active, cash = acc
            print(f"Account ID: {acc_id}")
            print(f"  Name: {name}")
            print(f"  Type: {acc_type}")
            print(f"  AI Model ID: {ai_model_id if ai_model_id else 'NULL (NOT SET)'}")
            print(f"  Active: {is_active}")
            print(f"  Current Cash: ${cash}")

            # Check if this account would be skipped for AI trading
            if acc_type == "AI":
                if not ai_model_id:
                    print(f"  [X] PROBLEM: No AI model configured - AI trading DISABLED")
                else:
                    valid_models = ["gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "claude-3-opus", "claude-3-sonnet"]
                    if ai_model_id in valid_models:
                        print(f"  [OK] AI model configured correctly")
                    else:
                        print(f"  [X] PROBLEM: Invalid AI model ID - AI trading DISABLED")
            else:
                print(f"  [INFO] Not an AI account - AI trading not applicable")

            print()

        # Check for accounts that need fixing
        cursor.execute("""
            SELECT id, name
            FROM accounts
            WHERE account_type = 'AI' AND (ai_model_id IS NULL OR ai_model_id = '')
        """)

        broken_accounts = cursor.fetchall()

        if broken_accounts:
            print("="*80)
            print("ACCOUNTS NEEDING FIX")
            print("="*80)
            print(f"\nFound {len(broken_accounts)} AI account(s) without ai_model_id:\n")
            for acc_id, name in broken_accounts:
                print(f"  - {name} (ID: {acc_id})")
            print()

        conn.close()

    except sqlite3.Error as e:
        print(f"Database error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    check_accounts()
