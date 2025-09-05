import { createFileRoute } from '@tanstack/react-router'
import { Users, Building2, FileText, TrendingUp } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/superadmin/')({
  component: SuperAdminDashboard,
})

function SuperAdminDashboard() {
  // In a real app, you'd fetch these stats from the server
  const stats = {
    totalUsers: 0,
    totalOrganizations: 0,
    totalTodos: 0,
    activeUsers: 0,
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Super Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          color="bg-primary"
        />
        <StatCard
          title="Organizations"
          value={stats.totalOrganizations}
          icon={Building2}
          color="bg-success"
        />
        <StatCard
          title="Total Todos"
          value={stats.totalTodos}
          icon={FileText}
          color="bg-info"
        />
        <StatCard
          title="Active Users"
          value={stats.activeUsers}
          icon={TrendingUp}
          color="bg-warning"
        />
      </div>

      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <p className="text-muted-foreground">No recent activity to display.</p>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }: {
  title: string
  value: number
  icon: any
  color: string
}) {
  return (
    <div className="bg-card rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`${color} p-3 rounded-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <p className="text-muted-foreground text-sm">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}