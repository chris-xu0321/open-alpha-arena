import React, { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAccounts, getOverview, TradingAccount } from '@/lib/api'

interface Account {
  id: number
  user_id?: number
  username?: string
  name: string
  account_type: string
  initial_capital: number
  current_cash: number
  frozen_cash: number
  model?: string
  is_active?: boolean
}

interface AccountWithAssets extends Account {
  total_assets: number
  positions_value: number
}

interface AccountSelectorProps {
  currentAccount: Account | null
  onAccountChange: (accountId: number) => void
  username?: string
  refreshTrigger?: number  // Add refresh trigger prop
}

// Use relative path to work with proxy
const API_BASE = '/api'

export default function AccountSelector({ currentAccount, onAccountChange, username = "default", refreshTrigger }: AccountSelectorProps) {
  const [accounts, setAccounts] = useState<AccountWithAssets[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingOverviews, setLoadingOverviews] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchAccounts()
  }, [username, refreshTrigger])  // Add refreshTrigger to dependency array

  const fetchAccounts = async () => {
    try {
      setLoading(true)

      // Step 1: Fetch basic account data immediately
      const accountData = await getAccounts()
      console.log('Fetched accounts:', accountData)

      // Step 2: Show accounts with basic info immediately (fast)
      const basicAccounts: AccountWithAssets[] = accountData.map(account => ({
        ...account,
        total_assets: account.current_cash + account.frozen_cash,
        positions_value: 0
      }))

      setAccounts(basicAccounts)
      setLoading(false)

      // Step 3: Load overview data in background for each account (slow)
      const overviewLoadingSet = new Set(accountData.map(a => a.id))
      setLoadingOverviews(overviewLoadingSet)

      // Fetch overviews in parallel and update progressively
      accountData.forEach(async (account) => {
        try {
          const response = await fetch(`${API_BASE}/account/${account.id}/overview`)
          if (response.ok) {
            const accountOverview = await response.json()
            console.log(`Account ${account.id} overview loaded:`, accountOverview)

            // Update this specific account's data
            setAccounts(prev => prev.map(a =>
              a.id === account.id
                ? {
                    ...a,
                    total_assets: accountOverview.total_assets || a.current_cash + a.frozen_cash,
                    positions_value: accountOverview.positions_value || 0
                  }
                : a
            ))
          } else {
            console.warn(`Failed to fetch overview for account ${account.id}:`, response.status, response.statusText)
          }
        } catch (error) {
          console.warn(`Failed to fetch overview for account ${account.id}:`, error)
        } finally {
          // Remove this account from loading set
          setLoadingOverviews(prev => {
            const newSet = new Set(prev)
            newSet.delete(account.id)
            return newSet
          })
        }
      })

    } catch (error) {
      console.error('Error fetching accounts:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="w-48">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="w-64">
        <div className="text-sm text-muted-foreground p-2 border rounded">
          No accounts found
        </div>
      </div>
    )
  }

  const displayName = (account: AccountWithAssets, isLoadingOverview: boolean = false) => {
    const accountName = account.name || account.username || `${account.account_type} Account`
    if (isLoadingOverview && account.positions_value === 0) {
      // Show cash while loading overview
      return `${accountName} (Cash: $${account.current_cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
    }
    return `${accountName} ($${account.total_assets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
  }

  // Find the current account in our loaded accounts list (which has total_assets)
  const currentAccountWithAssets = currentAccount 
    ? accounts.find(a => a.id === currentAccount.id) 
    : null

  return (
    <div className="w-full">
      <Select
        value={currentAccount?.id.toString() || ''}
        onValueChange={(value) => onAccountChange(parseInt(value))}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select Account" className="truncate">
            <span className="truncate block">
              {currentAccountWithAssets
                ? displayName(currentAccountWithAssets, loadingOverviews.has(currentAccountWithAssets.id))
                : currentAccount
                  ? `${currentAccount.name || 'Unknown Account'} (Loading...)`
                  : 'Select Account'
              }
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => {
            const isLoadingOverview = loadingOverviews.has(account.id)
            return (
              <SelectItem key={account.id} value={account.id.toString()}>
                <div className="flex flex-col">
                  <span className="font-medium">
                    {displayName(account, isLoadingOverview)}
                    {isLoadingOverview && account.positions_value === 0 && ' ⏳'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Cash: ${account.current_cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} |
                    Positions: {isLoadingOverview && account.positions_value === 0 ? '...' : `$${account.positions_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    {account.model && ` | ${account.model}`}
                  </span>
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}