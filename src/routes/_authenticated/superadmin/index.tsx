import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/superadmin/')({
  beforeLoad: () => {
    throw redirect({
      to: '/superadmin/users',
    })
  },
})