import { createFileRoute } from '@tanstack/react-router'
import { SessionDisplay } from '@/components/SessionDisplay'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="container mx-auto py-8">
      <SessionDisplay />
    </div>
  )
}
