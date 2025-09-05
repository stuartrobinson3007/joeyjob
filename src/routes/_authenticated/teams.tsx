import { createFileRoute } from '@tanstack/react-router'
import { useSetPageMeta } from '@/lib/page-context'
import { Users } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/teams')({
  component: TeamsPage,
})

function TeamsPage() {
  // Set page metadata
  useSetPageMeta({
    title: 'Teams'
  })

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Users className="w-16 h-16 text-muted-foreground mb-4" />
      <h1 className="text-3xl font-bold mb-2">Teams</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Team management functionality will be implemented here.
      </p>
    </div>
  )
}