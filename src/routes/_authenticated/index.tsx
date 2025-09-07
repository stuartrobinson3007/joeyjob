import { createFileRoute } from '@tanstack/react-router'

import { TodosTablePage } from '@/features/todos/components/todos-table-page'

export const Route = createFileRoute('/_authenticated/')({
  component: TodosTablePage,
})
