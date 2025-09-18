import * as React from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { ExternalLink, MapPin } from 'lucide-react'
import { formatAddressMultiLine, getMapsLink, hasValidAddress } from '@/utils/maps'

interface FormQuestion {
  questionId: string
  questionText: string
  questionType: string
  answer: any
  fieldName: string
}

interface ContactInfo {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
}

interface Address {
  street?: string
  street2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

interface FormResponses {
  contactInfo?: ContactInfo
  address?: Address
  customQuestions?: FormQuestion[]
  serviceQuestions?: FormQuestion[]
}

interface FormResponseViewerProps {
  responses: FormResponses
}

export function FormResponseViewer({ responses }: FormResponseViewerProps) {
  const { t } = useTranslation('bookings')

  if (!responses || (!responses.customQuestions?.length && !responses.serviceQuestions?.length && !responses.contactInfo)) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        {t('details.noFormResponses')}
      </div>
    )
  }

  const renderQuestionAnswer = (question: FormQuestion) => {
    const formatAnswer = (answer: any, type: string) => {
      if (answer === null || answer === undefined || answer === '') {
        return <span className="text-muted-foreground italic">No answer</span>
      }

      switch (type) {
        case 'select':
        case 'radio':
          return <span className="capitalize">{String(answer)}</span>
        case 'checkbox':
          if (Array.isArray(answer)) {
            return answer.length > 0 ? answer.join(', ') : <span className="text-muted-foreground italic">None selected</span>
          }
          return String(answer)
        case 'boolean':
          return answer ? 'Yes' : 'No'
        case 'number':
          return typeof answer === 'number' ? answer.toString() : String(answer)
        case 'email':
        case 'url':
        case 'tel':
        case 'text':
        case 'textarea':
        default:
          return String(answer)
      }
    }

    return (
      <div key={question.questionId} className="grid gap-2">
        <div className="flex justify-between items-start">
          <span className="text-sm font-medium text-foreground">{question.questionText}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          {formatAnswer(question.answer, question.questionType)}
        </div>
      </div>
    )
  }

  const renderContactInfo = (contactInfo: ContactInfo) => {
    const fields = [
      { label: 'First Name', value: contactInfo.firstName },
      { label: 'Last Name', value: contactInfo.lastName },
      { label: 'Email', value: contactInfo.email },
      { label: 'Phone', value: contactInfo.phone },
      { label: 'Company', value: contactInfo.company },
    ].filter(field => field.value)

    if (fields.length === 0) return null

    return (
      <div className="grid gap-3">
        <h4 className="text-sm font-semibold">Contact Information</h4>
        <div className="grid gap-2">
          {fields.map(field => (
            <div key={field.label} className="flex justify-between">
              <span className="text-sm text-muted-foreground">{field.label}:</span>
              <span className="text-sm font-medium">{field.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderAddress = (address: Address) => {
    if (!hasValidAddress(address)) return null

    return (
      <div className="grid gap-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Address
        </h4>
        <div className="grid gap-3">
          <div className="grid gap-1">
            {formatAddressMultiLine(address).map((line, index) => (
              <div key={index} className="text-sm">
                {line}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {getMapsLink(address, 'view') && (
              <a
                href={getMapsLink(address, 'view')!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Open in Maps
              </a>
            )}
            {getMapsLink(address, 'directions') && (
              <a
                href={getMapsLink(address, 'directions')!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Get Directions
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      {/* Contact Information */}
      {responses.contactInfo && renderContactInfo(responses.contactInfo)}

      {/* Note: Address is now handled separately in the booking detail sheet */}

      {/* Custom Questions */}
      {responses.customQuestions && responses.customQuestions.length > 0 && (
        <div className="grid gap-3">
          <h4 className="text-sm font-semibold">Form Questions</h4>
          <div className="grid gap-4">
            {responses.customQuestions.map(renderQuestionAnswer)}
          </div>
        </div>
      )}

      {/* Service Questions */}
      {responses.serviceQuestions && responses.serviceQuestions.length > 0 && (
        <div className="grid gap-3">
          <h4 className="text-sm font-semibold">Service Questions</h4>
          <div className="grid gap-4">
            {responses.serviceQuestions.map(renderQuestionAnswer)}
          </div>
        </div>
      )}
    </div>
  )
}