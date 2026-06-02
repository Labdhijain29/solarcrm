import InventoryDispatchPage from './InventoryDispatchPage'

export default function DispatchManagerDashboard({ defaultTab = 'dispatch' }) {
  return <InventoryDispatchPage defaultTab={defaultTab} dashboardType="dispatch" />
}
