import React from 'react'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/taali-ui/ui/separator'

interface PageHeaderProps {
  title?: string
  breadcrumb?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
}

/**
 * Reusable page header component that provides consistent layout and styling.
 *
 * Usage examples:
 *
 * Simple title:
 * <PageHeader title={t('title')} />
 *
 * With actions:
 * <PageHeader title={t('title')} actions={<Button>{t('common:actions.invite')}</Button>} />
 *
 * With custom breadcrumb:
 * <PageHeader breadcrumb={<Breadcrumb>...</Breadcrumb>} actions={<Button>{t('common:actions.done')}</Button>} />
 */
export function PageHeader({ title, breadcrumb, actions, children }: PageHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 bg-background">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="" />
        <Separator orientation="vertical" className="mr-2 h-4!" />
        {breadcrumb ? breadcrumb : title ? <span className="text-sm">{title}</span> : children}
      </div>
      {actions && <div className="ml-auto px-4">{actions}</div>}
    </header>
  )
}
