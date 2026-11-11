export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low'
export type AccountStatus = 'New Risk' | 'Under Review' | 'Action in Progress' | 'Monitoring' | 'Resolved' | 'Churned' | 'Healthy'
export type ReviewStatus = 'Pending Review' | 'Approved' | 'Auto-Submitted' | 'Rejected'
export type QuestionnaireStatus = ReviewStatus

export interface AccountManager {
  id: string
  name: string
  initials: string
  role: string
}

export interface Competitor {
  id: string
  name: string
  accent: string
  descriptor: string
  incentives: string[]
}

export interface Account {
  id: string
  name: string
  industry: string
  ownerId: string
  monthlyRevenue: number
  health: number
  status: AccountStatus
  product: string
  usage: string
  region: string
}

export interface IntelligenceRecord {
  id: string
  accountId: string
  competitorId: string
  context: string
  score: number
  detectedAt: string
  callDate: string
  reason: string
  offer: string
  sentiment: string
  churnLikelihood: number
  summary: string
  transcript: string
  confidence: number
  product: string
  reviewStatus: ReviewStatus
  verified: boolean
  amNotes?: string
  nextAction?: string
  priority?: string
}

export interface Questionnaire {
  id: string
  recordId: string
  accountId: string
  ownerId: string
  detectedAt: string
  deadlineAt: string
  status: QuestionnaireStatus
  accurate: 'Yes' | 'No' | ''
  switching: 'Yes' | 'No' | 'Unsure' | ''
  offer: string
  context: string
  nextAction: string
  priority: string
  rejectionReason?: string
}

export interface Activity {
  id: string
  title: string
  detail: string
  kind: 'detection' | 'review' | 'risk' | 'status'
  date: string
  accountId?: string
  recordId?: string
}

export interface Notice {
  id: string
  text: string
  date: string
  read: boolean
}

export type ActivityLog = Activity
export type Notification = Notice

export interface AppData {
  accounts: Account[]
  managers: AccountManager[]
  competitors: Competitor[]
  records: IntelligenceRecord[]
  questionnaires: Questionnaire[]
  activities: ActivityLog[]
  notices: Notification[]
}
