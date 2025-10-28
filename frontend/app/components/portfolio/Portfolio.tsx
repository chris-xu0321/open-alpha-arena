import AccountSelector from '@/components/layout/AccountSelector'

interface Account {
  id: number
  user_id: number
  name: string
  account_type: string
  initial_capital: number
  current_cash: number
  frozen_cash: number
}

interface PortfolioProps {
  user: Account
  onSwitchAccount?: (accountId: number) => void
  accountRefreshTrigger?: number
}

export default function Portfolio({
  user,
  onSwitchAccount,
  accountRefreshTrigger
}: PortfolioProps) {
  return (
    <div className="space-y-6">
      {/* Account Selector */}
      {onSwitchAccount && (
        <div className="flex justify-end">
          <AccountSelector
            currentAccount={user}
            onAccountChange={onSwitchAccount}
            refreshTrigger={accountRefreshTrigger}
          />
        </div>
      )}
    </div>
  )
}