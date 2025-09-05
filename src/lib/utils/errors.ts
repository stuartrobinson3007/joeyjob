export class AppError extends Error {
  constructor(
    public userMessage: string,
    public technicalMessage: string,
    public statusCode: number = 500,
    public context?: any
  ) {
    super(technicalMessage)
    this.name = 'AppError'
  }
}

export class AuthError extends AppError {
  constructor(userMessage: string, technicalMessage: string = 'Authentication failed') {
    super(userMessage, technicalMessage, 401)
    this.name = 'AuthError'
  }
}

export class PermissionError extends AppError {
  constructor(userMessage: string = "You don't have permission to perform this action", technicalMessage: string = 'Permission denied') {
    super(userMessage, technicalMessage, 403)
    this.name = 'PermissionError'
  }
}

export class ValidationError extends AppError {
  constructor(userMessage: string, technicalMessage: string = 'Validation failed', errors?: any) {
    super(userMessage, technicalMessage, 400, { errors })
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(
      `${resource} not found`,
      `Resource not found: ${resource}`,
      404
    )
    this.name = 'NotFoundError'
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

export function handleError(error: unknown): {
  userMessage: string
  technicalMessage: string
  statusCode: number
  context?: any
} {
  if (isAppError(error)) {
    return {
      userMessage: error.userMessage,
      technicalMessage: error.technicalMessage,
      statusCode: error.statusCode,
      context: error.context
    }
  }

  if (error instanceof Error) {
    console.error('Unhandled error:', error)
    return {
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: error.message,
      statusCode: 500
    }
  }

  console.error('Unknown error:', error)
  return {
    userMessage: 'An unexpected error occurred. Please try again.',
    technicalMessage: 'Unknown error',
    statusCode: 500
  }
}

