import { Link } from '@tanstack/react-router'

import { useTranslation } from '@/i18n/hooks/useTranslation'

export default function Header() {
  const { t } = useTranslation('common')

  return (
    <header className="p-2 flex gap-2 bg-white text-black justify-between">
      <nav className="flex flex-row">
        <div className="px-2 font-bold">
          <Link to="/">{t('navigation.home')}</Link>
        </div>
      </nav>
    </header>
  )
}
