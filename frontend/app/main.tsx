import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { Toaster, toast } from 'react-hot-toast'

// Create a module-level WebSocket singleton to avoid duplicate connections in React StrictMode
let __WS_SINGLETON__: WebSocket | null = null;

const resolveWsUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost:5611/ws'
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

const resolveApiBase = () => {
  if (typeof window !== 'undefined') return window.location.origin
  return import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:5611'
}

import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import TradingPanel from '@/components/trading/TradingPanel'
import Portfolio from '@/components/portfolio/Portfolio'
import AssetCurve from '@/components/portfolio/AssetCurve'
import ComprehensiveView from '@/components/portfolio/ComprehensiveView'
import { AIDecision } from '@/lib/api'

interface User {
  id: number
  username: string
}

interface Account {
  id: number
  user_id: number
  name: string
  account_type: string
  initial_capital: number
  current_cash: number
  frozen_cash: number
}

interface Overview {
  account: Account
  total_assets: number
  positions_value: number
  portfolio?: {
    total_assets: number
    positions_value: number
  }
}
interface Position { id: number; account_id: number; symbol: string; name: string; market: string; quantity: number; available_quantity: number; avg_cost: number; last_price?: number | null; market_value?: number | null }
interface Order { id: number; order_no: string; symbol: string; name: string; market: string; side: string; order_type: string; price?: number; quantity: number; filled_quantity: number; status: string }
interface Trade { id: number; order_id: number; account_id: number; symbol: string; name: string; market: string; side: string; price: number; quantity: number; commission: number; trade_time: string }

const PAGE_TITLES: Record<string, string> = {
  portfolio: 'Simulated Crypto Trading',
  comprehensive: 'Open Alpha Arena',
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [aiDecisions, setAiDecisions] = useState<AIDecision[]>([])
  const [allAssetCurves, setAllAssetCurves] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState<string>('comprehensive')
  const [accountRefreshTrigger, setAccountRefreshTrigger] = useState<number>(0)
  const wsRef = useRef<WebSocket | null>(null)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const chartRefreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastAiDecisionIdRef = useRef<number | null>(null)

  // Helper function to request snapshot and reset 5-minute timer
  const requestSnapshot = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'get_snapshot' }))

      // Reset the 5-minute fallback timer
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
      refreshTimerRef.current = setTimeout(() => {
        console.log('5-minute fallback refresh triggered')
        requestSnapshot()
      }, 300000) // 5 minutes = 300,000ms
    }
  }

  // Helper function to request asset curve update and reset 5-minute chart timer
  const requestAssetCurveUpdate = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'get_asset_curves', timeframe: '1h' }))

      // Reset the 5-minute chart refresh timer
      if (chartRefreshTimerRef.current) {
        clearTimeout(chartRefreshTimerRef.current)
      }
      chartRefreshTimerRef.current = setTimeout(() => {
        console.log('5-minute chart refresh triggered')
        requestAssetCurveUpdate()
      }, 300000) // 5 minutes = 300,000ms
    }
  }

  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout | null = null
    let ws = __WS_SINGLETON__
    const created = !ws || ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED
    
    const connectWebSocket = () => {
      try {
        ws = new WebSocket(resolveWsUrl())
        __WS_SINGLETON__ = ws
        wsRef.current = ws
        
        const handleOpen = () => {
          console.log('WebSocket connected')
          // Start with hardcoded default user for paper trading
          ws!.send(JSON.stringify({ type: 'bootstrap', username: 'default', initial_capital: 10000 }))
        }
        
        const handleMessage = (e: MessageEvent) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.type === 'bootstrap_ok') {
              if (msg.user) {
                setUser(msg.user)
              }
              if (msg.account) {
                setAccount(msg.account)
              }
              // request initial snapshot and start 5-minute timer
              requestSnapshot()
              // request initial asset curve and start 5-minute chart timer
              requestAssetCurveUpdate()
            } else if (msg.type === 'asset_curve_refresh') {
              // Dedicated asset curve update (triggered by orders or 5-min timer)
              setAllAssetCurves(msg.all_asset_curves || [])
            } else if (msg.type === 'snapshot' || msg.type === 'snapshot_fast' || msg.type === 'snapshot_full') {
              // Update all state with snapshot data
              setOverview(msg.overview)
              setPositions(msg.positions)
              setOrders(msg.orders)
              setTrades(msg.trades || [])

              // Check for new AI decisions
              const newAiDecisions = msg.ai_decisions || []
              if (newAiDecisions.length > 0) {
                const latestDecision = newAiDecisions[0]
                const latestDecisionId = latestDecision.id
                const latestOperation = latestDecision.operation?.toLowerCase()

                // If we have a new AI decision (different from last tracked)
                if (lastAiDecisionIdRef.current !== null && latestDecisionId !== lastAiDecisionIdRef.current) {
                  // Only trigger refresh for buy/sell operations, not for hold
                  if (latestOperation === 'buy' || latestOperation === 'sell') {
                    console.log(`New AI ${latestOperation} decision detected, requesting fresh snapshot`)
                    // Request immediate refresh to get latest data
                    setTimeout(() => requestSnapshot(), 500) // Small delay to avoid rapid-fire requests
                  } else {
                    console.log(`New AI ${latestOperation || 'hold'} decision detected, skipping refresh`)
                  }
                }

                // Update the last decision ID tracker
                lastAiDecisionIdRef.current = latestDecisionId
              }

              setAiDecisions(newAiDecisions)
              // Asset curves are now sent separately via asset_curve_refresh
              // Don't update from snapshots anymore
            } else if (msg.type === 'trades') {
              setTrades(msg.trades || [])
            } else if (msg.type === 'order_filled') {
              toast.success('Order filled')
              requestSnapshot()
              // Note: Backend already sends asset_curve_refresh after order fills
              // No need to request here - just wait for the message
            } else if (msg.type === 'order_pending') {
              toast('Order placed, waiting for fill', { icon: '⏳' })
              requestSnapshot()
            } else if (msg.type === 'user_switched') {
              toast.success(`Switched to ${msg.user.username}`)
              setUser(msg.user)
            } else if (msg.type === 'account_switched') {
              toast.success(`Switched to ${msg.account.name}`)
              setAccount(msg.account)
            } else if (msg.type === 'error') {
              console.error(msg.message)
              toast.error(msg.message || 'Order error')
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err)
          }
        }
        
        const handleClose = (event: CloseEvent) => {
          console.log('WebSocket closed:', event.code, event.reason)
          __WS_SINGLETON__ = null
          if (wsRef.current === ws) wsRef.current = null
          
          // Attempt to reconnect after 3 seconds if the close wasn't intentional
          if (event.code !== 1000 && event.code !== 1001) {
            reconnectTimer = setTimeout(() => {
              console.log('Attempting to reconnect WebSocket...')
              connectWebSocket()
            }, 3000)
          }
        }
        
        const handleError = (event: Event) => {
          console.error('WebSocket error:', event)
          // Don't show toast for every error to avoid spam
          // toast.error('Connection error')
        }

        ws.addEventListener('open', handleOpen)
        ws.addEventListener('message', handleMessage)
        ws.addEventListener('close', handleClose)
        ws.addEventListener('error', handleError)
        
        return () => {
          ws?.removeEventListener('open', handleOpen)
          ws?.removeEventListener('message', handleMessage)
          ws?.removeEventListener('close', handleClose)
          ws?.removeEventListener('error', handleError)
        }
      } catch (err) {
        console.error('Failed to create WebSocket:', err)
        // Retry connection after 5 seconds
        reconnectTimer = setTimeout(connectWebSocket, 5000)
      }
    }
    
    if (created) {
      connectWebSocket()
    } else {
      wsRef.current = ws
    }

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
      if (chartRefreshTimerRef.current) {
        clearTimeout(chartRefreshTimerRef.current)
      }
      // Don't close the socket in cleanup to avoid issues with React StrictMode
    }
  }, [])

  const placeOrder = (payload: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WS not connected, cannot place order')
      toast.error('Not connected to server')
      return
    }
    try {
      wsRef.current.send(JSON.stringify({ type: 'place_order', ...payload }))
      toast('Placing order...', { icon: '📝' })
    } catch (e) {
      console.error(e)
      toast.error('Failed to send order')
    }
  }

  const switchUser = (username: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WS not connected, cannot switch user')
      toast.error('Not connected to server')
      return
    }
    try {
      wsRef.current.send(JSON.stringify({ type: 'switch_user', username }))
      toast('Switching account...', { icon: '🔄' })
    } catch (e) {
      console.error(e)
      toast.error('Failed to switch user')
    }
  }

  const switchAccount = (accountId: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WS not connected, cannot switch account')
      toast.error('Not connected to server')
      return
    }
    try {
      wsRef.current.send(JSON.stringify({ type: 'switch_account', account_id: accountId }))
      toast('Switching account...', { icon: '🔄' })
    } catch (e) {
      console.error(e)
      toast.error('Failed to switch account')
    }
  }

  const handleAccountUpdated = () => {
    // Increment refresh trigger to force AccountSelector to refresh
    setAccountRefreshTrigger(prev => prev + 1)

    // Also refresh the current data snapshot
    requestSnapshot()
  }

  if (!user || !account || !overview) return <div className="p-8">Connecting to trading server...</div>

  const renderMainContent = () => {
    switch (currentPage) {
      case 'asset-curve':
        return (
          <main className="flex-1 p-6 overflow-auto">
            <AssetCurve />
          </main>
        )
      case 'comprehensive':
        return (
          <main className="flex-1 p-6 overflow-auto">
            <ComprehensiveView
              overview={overview}
              positions={positions}
              orders={orders}
              trades={trades}
              aiDecisions={aiDecisions}
              allAssetCurves={allAssetCurves}
              wsRef={wsRef}
              onSwitchUser={switchUser}
              onSwitchAccount={switchAccount}
              accountRefreshTrigger={accountRefreshTrigger}
              onRefreshData={requestSnapshot}
            />
          </main>
        )
      default:
        return (
          <main className="flex-1 p-6 overflow-hidden">
            <Portfolio
              user={overview.account}
              onSwitchAccount={switchAccount}
              accountRefreshTrigger={accountRefreshTrigger}
            />
            <div className="flex gap-6 h-[calc(100vh-400px)] mt-4">
              <div className="flex-shrink-0">
                <TradingPanel
                  onPlace={placeOrder}
                  user={overview.account}
                  account={account}
                  positions={positions.map(p => ({ symbol: p.symbol, market: p.market, available_quantity: p.available_quantity }))}
                  lastPrices={Object.fromEntries(positions.map(p => [`${p.symbol}.${p.market}`, p.last_price ?? null]))}
                />
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="h-full">
                  <AssetOverview overview={overview} positions={positions} />
                </div>
              </div>
            </div>
          </main>
        )
    }
  }

  const pageTitle = PAGE_TITLES[currentPage] ?? PAGE_TITLES.portfolio

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onAccountUpdated={handleAccountUpdated}
      />
      <div className="flex-1 flex flex-col">
        <Header
          title={pageTitle}
          currentUser={user}
          currentAccount={account}
          showAccountSelector={currentPage === 'portfolio' || currentPage === 'comprehensive'}
          onUserChange={switchUser}
        />
        {renderMainContent()}
      </div>
    </div>
  )
}

function AssetOverview({ overview, positions }: { overview: Overview; positions: Position[] }) {
  if (!overview) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading asset data...</div>
      </div>
    )
  }

  const account = overview.account
  const availableCash = account.current_cash - account.frozen_cash

  return (
    <div className="p-4 space-y-3">
      {/* Account Overview & Performance Cards - Compact Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="bg-secondary p-3 rounded-lg shadow-sm">
          <div className="text-xs font-medium text-secondary-foreground mb-1">Total Assets</div>
          <div className="text-xl font-bold text-secondary-foreground">
            ${overview.total_assets.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Initial: ${account.initial_capital.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-secondary p-3 rounded-lg shadow-sm">
          <div className="text-xs font-medium text-secondary-foreground mb-1">Cash Balance</div>
          <div className="text-xl font-bold text-secondary-foreground">
            ${account.current_cash.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Available: ${availableCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-secondary p-3 rounded-lg shadow-sm">
          <div className="text-xs font-medium text-secondary-foreground mb-1">Positions Value</div>
          <div className="text-xl font-bold text-secondary-foreground">
            ${overview.positions_value.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {positions.length} position{positions.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="bg-secondary p-3 rounded-lg shadow-sm">
          <div className="text-xs font-medium text-secondary-foreground mb-1">Total P&L</div>
          <div className={`text-xl font-bold ${
            overview.total_assets - account.initial_capital >= 0
              ? 'text-green-600'
              : 'text-red-600'
          }`}>
            {overview.total_assets - account.initial_capital >= 0 ? '+' : ''}
            ${(overview.total_assets - account.initial_capital).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        <div className="bg-secondary p-3 rounded-lg shadow-sm">
          <div className="text-xs font-medium text-secondary-foreground mb-1">Return Rate</div>
          <div className={`text-xl font-bold ${
            ((overview.total_assets - account.initial_capital) / account.initial_capital * 100) >= 0
              ? 'text-green-600'
              : 'text-red-600'
          }`}>
            {((overview.total_assets - account.initial_capital) / account.initial_capital * 100) >= 0 ? '+' : ''}
            {((overview.total_assets - account.initial_capital) / account.initial_capital * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Two Column Layout: Positions Breakdown and Asset Allocation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Positions Breakdown */}
        {positions.length > 0 && (
          <div className="bg-secondary p-3 rounded-lg shadow-sm">
            <div className="text-xs font-medium text-secondary-foreground mb-2">Position Breakdown</div>
            <div className="space-y-2">
              {positions.map(position => {
                const positionValue = position.market_value || 0
                const positionPnL = positionValue - (position.quantity * position.avg_cost)
                const positionPnLPercent = ((positionValue / (position.quantity * position.avg_cost)) - 1) * 100

                return (
                  <div key={position.id} className="flex items-center justify-between p-2 bg-background rounded">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-secondary-foreground">{position.symbol}</div>
                      <div className="text-xs text-muted-foreground">{position.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-secondary-foreground">
                        ${positionValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className={`text-xs ${positionPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {positionPnL >= 0 ? '+' : ''}${positionPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {' '}({positionPnL >= 0 ? '+' : ''}{positionPnLPercent.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Asset Allocation */}
        <div className="bg-secondary p-3 rounded-lg shadow-sm self-start">
          <div className="text-xs font-medium text-secondary-foreground mb-2">Asset Allocation</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-sm text-secondary-foreground">Cash</span>
              </div>
              <div className="text-sm font-medium text-secondary-foreground">
                ${account.current_cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                {' '}({((account.current_cash / overview.total_assets) * 100).toFixed(1)}%)
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-sm text-secondary-foreground">Positions</span>
              </div>
              <div className="text-sm font-medium text-secondary-foreground">
                ${overview.positions_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                {' '}({((overview.positions_value / overview.total_assets) * 100).toFixed(1)}%)
              </div>
            </div>
            {/* Visual bar */}
            <div className="w-full h-6 bg-background rounded overflow-hidden flex mt-2">
              <div
                className="bg-blue-500 h-full transition-all"
                style={{ width: `${(account.current_cash / overview.total_assets) * 100}%` }}
              ></div>
              <div
                className="bg-green-500 h-full transition-all"
                style={{ width: `${(overview.positions_value / overview.total_assets) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Toaster position="top-right" />
    <App />
  </React.StrictMode>,
)
