import { useLanguage } from '../hooks/useLanguage'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/taali-ui/ui/select'

export function LanguageSwitcher() {
  const { language, languages, changeLanguage, isReady } = useLanguage()

  if (!isReady) {
    return null
  }

  const currentLanguageInfo = languages[language]

  return (
    <Select value={language} onValueChange={changeLanguage}>
      <SelectTrigger className="w-[140px]">
        <SelectValue>
          <div className="flex items-center gap-2">
            <span>{currentLanguageInfo.flag}</span>
            <span className="hidden sm:inline">{currentLanguageInfo.name}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(languages).map(([code, info]) => (
          <SelectItem key={code} value={code}>
            <div className="flex items-center gap-2">
              <span>{info.flag}</span>
              <span>{info.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
