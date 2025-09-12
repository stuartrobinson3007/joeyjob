export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope: string | null
}

export interface TokenErrorResponse {
  error: string
  error_description?: string
}

export interface TokenData {
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface ApiResponse {
  [key: string]: any
}

export interface Customer {
  ID: number
  GivenName: string
  FamilyName: string
  Email: string
  Phone: string
  Address: {
    Address?: string
    Line1?: string
    City: string
    State: string
    PostalCode: string
    Country: string
  }
  Sites?: Array<{
    ID: number
    Name: string
  }>
}

export interface Job {
  ID: number
  Type: 'Service' | 'Project' | 'Prepaid'
  Name: string
  Description: string
  Customer: number
  Site?: number
  Stage?: 'Pending' | 'Progress' | 'Complete' | 'Invoiced' | 'Archived'
  DateIssued?: string
}

export interface Schedule {
  ID: number
  Staff: number
  Date: string
  Blocks: Array<{
    StartTime: string
    EndTime: string
    ScheduleRate: number
  }>
}

export interface AvailabilityEntry {
  Date: string
  StartTime: string
  EndTime: string
  ScheduleType: string
  TotalHrs: number
  Reference: string
}

export interface Employee {
  ID: number
  CompanyID: string
  Name: string
  Email?: string
  Active?: boolean
  GivenName?: string
  FamilyName?: string
}

export interface EmployeeAvailabilityRequest {
  employeeId: number
  startDate: string
  endDate: string
}

export interface CreateCustomerRequest {
  GivenName: string
  FamilyName: string
  Email: string
  Phone: string
  Address: {
    Address?: string
    Line1?: string
    City: string
    State: string
    PostalCode: string
    Country: string
  }
}

export interface CreateJobRequest {
  Type: 'Service' | 'Project' | 'Prepaid'
  Name: string
  Description: string
  Notes?: string
  Customer: number
  Site?: number
}

export interface ScheduleJobRequest {
  Staff: number
  Blocks: Array<{
    StartTime: string
    EndTime: string
    Date: string
  }>
}

export interface SimproConfig {
  baseUrl: string
  tokenUrl: string
  clientId: string
  clientSecret: string
}