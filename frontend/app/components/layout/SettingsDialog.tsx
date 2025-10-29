import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getAvailableModels,
  type TradingAccount,
  type TradingAccountCreate,
  type TradingAccountUpdate,
  type AIModel
} from '@/lib/api'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccountUpdated?: () => void
}

export default function SettingsDialog({ open, onOpenChange, onAccountUpdated }: SettingsDialogProps) {
  const [accounts, setAccounts] = useState<TradingAccount[]>([])
  const [availableModels, setAvailableModels] = useState<AIModel[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Add mode state
  const [name, setName] = useState('')
  const [selectedModelId, setSelectedModelId] = useState('')
  const [initialCapital, setInitialCapital] = useState('10000')

  // Edit mode state
  const [editName, setEditName] = useState('')
  const [editCurrentCash, setEditCurrentCash] = useState('')

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const data = await getAccounts()
      setAccounts(data)
    } catch (error) {
      console.error('Failed to load accounts:', error)
      toast.error('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableModels = async () => {
    try {
      const response = await getAvailableModels()
      setAvailableModels(response.models || [])
    } catch (error) {
      console.error('Failed to load AI models:', error)
      toast.error('Failed to load AI models')
    }
  }

  useEffect(() => {
    if (open) {
      loadAccounts()
      loadAvailableModels()
      setError(null)
      setShowAddForm(false)
      setEditingId(null)
    }
  }, [open])

  const handleCreateAccount = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!name || !name.trim()) {
        setError('Account name is required')
        setLoading(false)
        return
      }

      if (!selectedModelId) {
        setError('Please select an AI model')
        setLoading(false)
        return
      }

      const accountData: TradingAccountCreate = {
        name: name.trim(),
        ai_model_id: selectedModelId,
        initial_capital: parseFloat(initialCapital) || 10000,
        account_type: 'AI'
      }

      console.log('Creating account with data:', accountData)
      await createAccount(accountData)

      // Reset form
      setName('')
      setSelectedModelId('')
      setInitialCapital('10000')
      setShowAddForm(false)

      await loadAccounts()
      toast.success('Account created successfully!')
      onAccountUpdated?.()
    } catch (error) {
      console.error('Failed to create account:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account'
      setError(errorMessage)
      toast.error(`Failed to create account: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateAccount = async () => {
    if (!editingId) return

    try {
      setLoading(true)
      setError(null)

      if (!editName || !editName.trim()) {
        setError('Account name is required')
        setLoading(false)
        return
      }

      const updateData: TradingAccountUpdate = {
        name: editName.trim(),
        current_cash: parseFloat(editCurrentCash)
      }

      console.log('Updating account with data:', updateData)
      await updateAccount(editingId, updateData)

      setEditingId(null)
      setEditName('')
      setEditCurrentCash('')

      await loadAccounts()
      toast.success('Account updated successfully!')
      onAccountUpdated?.()
    } catch (error) {
      console.error('Failed to update account:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update account'
      setError(errorMessage)
      toast.error(`Failed to update account: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async (accountId: number, accountName: string) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete "${accountName}"?\n\n` +
      `This will permanently delete:\n` +
      `- All positions\n` +
      `- All orders and trades\n` +
      `- All AI decision history\n\n` +
      `This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      setDeletingId(accountId)
      setError(null)

      console.log('Deleting account:', accountId)
      const result = await deleteAccount(accountId)

      // Show success message
      toast.success(result.message || 'Account deleted successfully')

      // Refresh account list
      await loadAccounts()

      // Notify parent to refresh and handle account switching if needed
      onAccountUpdated?.()
    } catch (error: any) {
      console.error('Failed to delete account:', error)

      // Handle specific errors
      const errorMessage = error.message || 'Failed to delete account'

      if (errorMessage.includes('last account') || errorMessage.includes('at least one')) {
        toast.error('Cannot delete the last account. You must have at least one account.')
        setError('Cannot delete the last account. You must have at least one account.')
      } else if (errorMessage.includes('not found')) {
        toast.error('Account not found or already deleted.')
        setError('Account not found or already deleted.')
        await loadAccounts() // Refresh to show current state
      } else {
        toast.error(errorMessage)
        setError(errorMessage)
      }
    } finally {
      setDeletingId(null)
    }
  }

  const startEdit = (account: TradingAccount) => {
    setEditingId(account.id)
    setEditName(account.name)
    setEditCurrentCash(account.current_cash?.toString() || '0')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditCurrentCash('')
    setError(null)
  }

  const getSelectedModel = () => {
    return availableModels.find(m => m.id === selectedModelId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Account Management</DialogTitle>
          <DialogDescription>
            Manage your trading accounts and AI configurations
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6 overflow-y-auto flex-1 pr-2">
          {/* Existing Accounts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Trading Accounts</h3>
              <Button
                onClick={() => setShowAddForm(!showAddForm)}
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Account
              </Button>
            </div>

            {loading && accounts.length === 0 ? (
              <div>Loading accounts...</div>
            ) : (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div key={account.id} className="border rounded-lg p-4">
                    {editingId === account.id ? (
                      <div className="space-y-3">
                        <Input
                          placeholder="Account name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-sm"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Current cash"
                          value={editCurrentCash}
                          onChange={(e) => setEditCurrentCash(e.target.value)}
                          className="text-sm"
                        />
                        <div className="text-sm p-3 bg-gray-50 rounded border">
                          <div className="font-semibold text-gray-700 mb-1">AI Model (read-only)</div>
                          <div className="text-gray-600">
                            {account.model ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {account.model}
                              </span>
                            ) : (
                              <span className="text-gray-400">No model configured</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleUpdateAccount} disabled={loading} size="sm">
                            {loading ? 'Saving...' : 'Save'}
                          </Button>
                          <Button onClick={cancelEdit} variant="outline" size="sm" disabled={loading}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="font-medium">{account.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {account.model ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {account.model}
                              </span>
                            ) : (
                              <span>No model configured</span>
                            )}
                          </div>
                          {account.base_url && (
                            <div className="text-xs text-muted-foreground truncate">
                              Endpoint: {account.base_url}
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground">
                            Cash: ${account.current_cash?.toLocaleString() || '0'}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => startEdit(account)}
                            variant="outline"
                            size="sm"
                            title="Edit account"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteAccount(account.id, account.name)}
                            variant="outline"
                            size="sm"
                            disabled={accounts.length <= 1 || deletingId === account.id}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={accounts.length <= 1 ? "Cannot delete the last account" : "Delete account"}
                          >
                            {deletingId === account.id ? (
                              <span className="h-4 w-4 animate-spin">⏳</span>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Account Form */}
          {showAddForm && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-medium">Add New Account</h3>
              <div className="space-y-3">
                <Input
                  placeholder="Account name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-sm"
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">AI Model</label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select an AI model</option>
                    {availableModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedModelId && getSelectedModel() && (
                  <div className="text-sm p-3 bg-gray-50 rounded border space-y-1">
                    <div className="text-gray-600">
                      <span className="font-semibold">Model:</span> {getSelectedModel()?.model}
                    </div>
                    <div className="text-gray-600 truncate">
                      <span className="font-semibold">Endpoint:</span> {getSelectedModel()?.base_url}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Initial Capital</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="10000"
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleCreateAccount} disabled={loading}>
                    {loading ? 'Creating...' : 'Create Account'}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowAddForm(false)
                      setName('')
                      setSelectedModelId('')
                      setInitialCapital('10000')
                    }}
                    variant="outline"
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
