import { createFileRoute } from '@tanstack/react-router'
import { TodosPage } from '@/features/todos/components/todos-page'

export const Route = createFileRoute('/_authenticated/todos')({
  component: TodosPage,
})