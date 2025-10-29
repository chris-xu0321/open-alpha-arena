import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { toast } from 'react-hot-toast'
import AssetCurveWithData from './AssetCurveWithData'
import AccountSelector from '@/components/layout/AccountSelector'
import { AIDecision } from '@/lib/api'

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
}

interface Position {
  id: number
  user_id: number
  symbol: string
  name: string
  market: string
  quantity: number
  available_quantity: number
  avg_cost: number
  last_price?: number | null
  market_value?: number | null
}

interface Order {
  id: number
  order_no: string
  symbol: string
  name: string
  market: string
  side: string
  order_type: string
  price?: number
  quantity: number
  filled_quantity: number
  status: string
}

interface Trade {
  id: number
  order_id: number
  user_id: number
  symbol: string
  name: string
  market: string
  side: string
  price: number
  quantity: number
  commission: number
  trade_time: string
}

const API_BASE = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:5611'

interface ComprehensiveViewProps {
  overview: Overview | null
  positions: Position[]
  orders: Order[]
  trades: Trade[]
  aiDecisions: AIDecision[]
  allAssetCurves: any[]
  wsRef?: React.MutableRefObject<WebSocket | null>
  onSwitchUser: (username: string) => void
  onSwitchAccount: (accountId: number) => void
  onRefreshData: () => void
  accountRefreshTrigger?: number
}

export default function ComprehensiveView({
  overview,
  positions,
  orders,
  trades,
  aiDecisions,
  allAssetCurves,
  wsRef,
  onSwitchUser,
  onSwitchAccount,
  onRefreshData,
  accountRefreshTrigger
}: ComprehensiveViewProps) {

  const switchUser = (username: string) => {
    onSwitchUser(username)
  }

  const switchAccount = (accountId: number) => {
    onSwitchAccount(accountId)
  }

  const cancelOrder = async (orderId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/orders/cancel/${orderId}`, {
        method: 'POST'
      })

      if (response.ok) {
        toast.success('Order cancelled')
        // Refresh data via parent component
        onRefreshData()
      } else {
        throw new Error(await response.text())
      }
    } catch (error) {
      console.error('Failed to cancel order:', error)
      toast.error('Failed to cancel order')
    }
  }

  if (!overview) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading comprehensive view...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-6">

      {/* Main Content */}
      <div className="grid grid-cols-5 gap-4 xl:gap-6">
        {/* Left Side - Asset Curve (40% on XL screens) */}
        <div className="col-span-5 lg:col-span-3 xl:col-span-2">
          <div className="min-h-80 md:min-h-96">
            <AssetCurveWithData data={allAssetCurves} wsRef={wsRef} />
          </div>
        </div>

        {/* Right Side - Portfolio Tabs (60% on XL screens) */}
        <div className="col-span-5 lg:col-span-2 xl:col-span-3">
          <div className="flex justify-end mb-2">
          <AccountSelector
            currentAccount={overview.account}
            onAccountChange={switchAccount}
            refreshTrigger={accountRefreshTrigger}
          />
          </div>
          <Tabs defaultValue="ai-decisions" className="flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="positions">Positions</TabsTrigger>
              <TabsTrigger value="ai-decisions">AI Decisions</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="trades">Trades</TabsTrigger>
            </TabsList>

            <div className="flex-1 mt-4">
              <TabsContent value="positions" className="mt-0 max-h-[800px] overflow-y-auto">
                <PositionList positions={positions} />
              </TabsContent>

              <TabsContent value="ai-decisions" className="mt-0 max-h-[800px] overflow-y-auto">
                <AIDecisionLog aiDecisions={aiDecisions} />
              </TabsContent>

              <TabsContent value="orders" className="mt-0 max-h-[800px] overflow-y-auto">
                <OrderBook orders={orders} onCancelOrder={cancelOrder} />
              </TabsContent>

              <TabsContent value="trades" className="mt-0 max-h-[800px] overflow-y-auto">
                <TradeHistory trades={trades} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

// Order Book Component
function OrderBook({ orders, onCancelOrder }: { orders: Order[], onCancelOrder: (id: number) => void }) {
  const formatPrice = (order: Order) => {
    if (order.price == null) {
      // Market orders have no price
      return order.order_type === 'MARKET' ? 'MARKET' : '-'
    }
    // Format limit order prices
    return order.price.toFixed(2)
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-2 py-1.5 text-sm">Time</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Order No</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Symbol</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Side</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Type</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Price</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Qty</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Status</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map(o => (
            <TableRow key={o.id}>
              <TableCell className="px-2 py-1.5 text-sm">{o.id}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{o.order_no}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{o.symbol}.{o.market}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{o.side}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{o.order_type}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{formatPrice(o)}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{o.quantity}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{o.status}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">
                {o.status === 'PENDING' ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onCancelOrder(o.id)}
                  >
                    Cancel
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// Position List Component
function PositionList({ positions }: { positions: Position[] }) {
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-2 py-1.5 text-sm">Symbol</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Name</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Qty</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Avail</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Avg Cost</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Last Price</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Mkt Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map(p => (
            <TableRow key={p.id}>
              <TableCell className="px-2 py-1.5 text-sm">{p.symbol}.{p.market}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm truncate max-w-[100px]" title={p.name}>{p.name}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{p.quantity}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{p.available_quantity}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{p.avg_cost.toFixed(4)}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{p.last_price != null ? p.last_price.toFixed(4) : '-'}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{p.market_value != null ? `$${p.market_value.toFixed(2)}` : '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// Trade History Component
function TradeHistory({ trades }: { trades: Trade[] }) {
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-2 py-1.5 text-sm">Time</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Order ID</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Symbol</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Side</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Price</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Qty</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Comm</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map(t => (
            <TableRow key={t.id}>
              <TableCell className="px-2 py-1.5 text-sm">{new Date(t.trade_time).toLocaleString()}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{t.order_id}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{t.symbol}.{t.market}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{t.side}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{t.price.toFixed(2)}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{t.quantity}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm">{t.commission.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// AI Decision Log Component
function AIDecisionLog({ aiDecisions }: { aiDecisions: AIDecision[] }) {
  // Limit to 15 most recent decisions
  const displayDecisions = aiDecisions.slice(0, 15)

  return (
    <div className="max-h-[600px] overflow-y-auto overflow-x-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-2 py-1.5 text-sm w-[140px]">Time</TableHead>
            <TableHead className="px-2 py-1.5 text-sm w-[100px]">Operation</TableHead>
            <TableHead className="px-2 py-1.5 text-sm w-[80px]">Executed</TableHead>
            <TableHead className="px-2 py-1.5 text-sm">Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayDecisions.map(d => (
            <TableRow key={d.id}>
              <TableCell className="px-2 py-1.5 text-sm align-top">{new Date(d.decision_time).toLocaleString()}</TableCell>
              <TableCell className="px-2 py-1.5 text-sm align-top">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                  d.operation === 'buy' ? 'bg-green-100 text-green-800' :
                  d.operation === 'sell' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {d.operation.toUpperCase()}
                </span>
              </TableCell>
              <TableCell className="px-2 py-1.5 text-sm align-top">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  d.executed === 'true' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {d.executed === 'true' ? 'Y' : 'N'}
                </span>
              </TableCell>
              <TableCell className="px-2 py-1.5 text-sm align-top whitespace-normal break-words">
                {d.reason}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}