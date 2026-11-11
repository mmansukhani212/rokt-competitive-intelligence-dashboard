import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createSeedData, makeQuestionnaires } from './data'
import type { AppData } from './types'

const STORAGE_KEY = 'competitor-intelligence-dashboard-demo-v1'
const LEGACY_STORAGE_KEY = 'signal-intelligence-demo-v1'

function addActivity(data: AppData, title: string, detail: string, kind: AppData['activities'][number]['kind'], accountId?: string, recordId?: string): AppData['activities'] {
  return [{ id: 'activity-' + Date.now() + '-' + Math.random().toString(16).slice(2, 7), title, detail, kind, date: new Date().toISOString(), accountId, recordId }, ...data.activities]
}

function canReviewQuestionnaire(status: string) {
  return status === 'Pending Review' || status === 'Auto-Submitted'
}

function expirePending(data: AppData): AppData {
  const now = Date.now()
  const expired = data.questionnaires.filter((form) => form.status === 'Pending Review' && new Date(form.deadlineAt).getTime() <= now)
  if (!expired.length) return data
  const ids = new Set(expired.map((form) => form.id))
  const recordIds = new Set(expired.map((form) => form.recordId))
  const questionnaires = data.questionnaires.map((form) => ids.has(form.id) ? { ...form, status: 'Auto-Submitted' as const } : form)
  const records = data.records.map((record) => recordIds.has(record.id) ? { ...record, reviewStatus: 'Auto-Submitted' as const } : record)
  const activities = expired.reduce((items, form) => {
    const account = data.accounts.find((item) => item.id === form.accountId)
    return [{
      id: 'activity-expiry-' + form.id,
      title: 'Form automatically submitted',
      detail: 'The review window expired. Original AI-detected information was synced.',
      kind: 'status' as const,
      date: new Date().toISOString(),
      accountId: form.accountId,
      recordId: form.recordId,
    }, ...items]
  }, data.activities)
  return { ...data, questionnaires, records, activities }
}

function updateLegacyCopy(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\bsignals?\b/gi, (term) => {
      const replacement = term.toLowerCase().endsWith('s') ? 'mentions' : 'mention'
      return term[0] === term[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement
    }).replace(/\bquestionnaires?\b/gi, (term) => {
      const replacement = term.toLowerCase().endsWith('s') ? 'forms' : 'form'
      if (term === term.toUpperCase()) return replacement.toUpperCase()
      return term[0] === term[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement
    })
  }
  if (Array.isArray(value)) return value.map(updateLegacyCopy)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, updateLegacyCopy(entry)]))
  return value
}

function readInitialData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return createSeedData()
    const savedData = updateLegacyCopy(JSON.parse(raw)) as AppData & { workflow?: unknown; activities: Array<AppData['activities'][number] & { kind: string }> }
    delete savedData.workflow
    savedData.activities = savedData.activities.map((activity) => (activity.kind as string) === 'automation' ? { ...activity, kind: 'status' } : activity)
    savedData.records = savedData.records.map((record) => (record.reviewStatus as string) === 'Synced' ? { ...record, reviewStatus: 'Auto-Submitted' } : record)
    savedData.questionnaires = (savedData.questionnaires || []).map((form) => (form.status as string) === 'Synced' ? { ...form, status: 'Auto-Submitted' } : form)
    const existingRecordIds = new Set(savedData.questionnaires.map((form) => form.recordId))
    savedData.questionnaires = [...savedData.questionnaires, ...makeQuestionnaires(savedData.records, savedData.accounts).filter((form) => !existingRecordIds.has(form.recordId))]
    return expirePending(savedData as AppData)
  } catch {
    return createSeedData()
  }
}

export interface QuestionnaireEdits {
  accurate: 'Yes' | 'No' | ''
  switching: 'Yes' | 'No' | 'Unsure' | ''
  offer: string
  context: string
  nextAction: string
  priority: string
}

interface DemoContextValue {
  data: AppData
  toast: string
  setToast: (message: string) => void
  resetDemo: () => void
  approveQuestionnaire: (id: string, edits: QuestionnaireEdits) => boolean
  saveQuestionnaireDraft: (id: string, edits: QuestionnaireEdits) => boolean
  rejectQuestionnaire: (id: string, reason: string) => void
  simulateThreeDays: () => number
  updateAccountStatus: (accountId: string, status: AppData['accounts'][number]['status']) => void
  markNoticeRead: (id: string) => void
  markAllNoticesRead: () => void
}

const DemoContext = createContext<DemoContextValue | null>(null)

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(readInitialData)
  const [toast, setToastState] = useState('')
  const setToast = useCallback((message: string) => {
    setToastState(message)
    window.setTimeout(() => setToastState(''), 3400)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch { /* demo can continue if storage is disabled */ }
  }, [data])

  useEffect(() => {
    const timer = window.setInterval(() => setData((current) => expirePending(current)), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const resetDemo = useCallback(() => {
    const seeded = createSeedData()
    setData(seeded)
    try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_STORAGE_KEY) } catch { /* no-op */ }
    setToast('Demo data has been reset.')
  }, [])

  const approveQuestionnaire = useCallback((id: string, edits: QuestionnaireEdits) => {
    const target = data.questionnaires.find((item) => item.id === id)
    if (!target || !canReviewQuestionnaire(target.status)) { setToast('This form is no longer available for AM review.'); return false }
    if (!edits.accurate || !edits.switching || !edits.offer.trim() || !edits.nextAction.trim()) { setToast('Complete the required fields before approving.'); return false }
    if (edits.accurate === 'No') { setToast('This detection is marked inaccurate. Reject it with a reason instead of approving it.'); return false }
    const updatingAutoSubmitted = target.status === 'Auto-Submitted'
    setData((current) => {
      const form = current.questionnaires.find((item) => item.id === id)
      if (!form || !canReviewQuestionnaire(form.status)) return current
      const questionnaires = current.questionnaires.map((item) => item.id === id ? { ...item, ...edits, status: 'Approved' as const } : item)
      const records = current.records.map((item) => item.id === form.recordId ? {
        ...item,
        reviewStatus: 'Approved' as const,
        verified: true,
        offer: edits.offer,
        amNotes: edits.context,
        nextAction: edits.nextAction,
        priority: edits.priority,
      } : item)
      const activities = addActivity(current,
        updatingAutoSubmitted ? 'Auto-submitted form updated by AM' : 'Form approved',
        updatingAutoSubmitted ? 'The AM reviewed the auto-submitted form and synchronized corrected details.' : 'AM-verified details were synchronized to the intelligence dashboard.',
        'review', form.accountId, form.recordId)
      const notices = [{ id: 'notice-' + Date.now(), text: (current.accounts.find((a) => a.id === form.accountId)?.name || 'Account') + (updatingAutoSubmitted ? ' intelligence was updated and verified.' : ' intelligence was verified and synced.'), date: new Date().toISOString(), read: false }, ...current.notices]
      return { ...current, questionnaires, records, activities, notices }
    })
    setToast(updatingAutoSubmitted ? 'Auto-submitted form updated and synced.' : 'Form approved and intelligence synced.')
    return true
  }, [data.questionnaires, setToast])

  const saveQuestionnaireDraft = useCallback((id: string, edits: QuestionnaireEdits) => {
    const target = data.questionnaires.find((item) => item.id === id)
    if (!target || !canReviewQuestionnaire(target.status)) { setToast('This form is no longer available for AM review.'); return false }
    setData((current) => ({ ...current, questionnaires: current.questionnaires.map((item) => item.id === id && canReviewQuestionnaire(item.status) ? { ...item, ...edits } : item) }))
    setToast(target.status === 'Auto-Submitted' ? 'Auto-submitted form updates saved as a draft.' : 'Form draft saved.')
    return true
  }, [data.questionnaires, setToast])

  const rejectQuestionnaire = useCallback((id: string, reason: string) => {
    if (!reason.trim()) { setToast('Add a short reason before rejecting this detection.'); return }
    setData((current) => {
      const form = current.questionnaires.find((item) => item.id === id)
      if (!form || !canReviewQuestionnaire(form.status)) return current
      const questionnaires = current.questionnaires.map((item) => item.id === id ? { ...item, status: 'Rejected' as const, rejectionReason: reason.trim() } : item)
      const records = current.records.map((item) => item.id === form.recordId ? { ...item, reviewStatus: 'Rejected' as const, verified: false } : item)
      const activityTitle = form.status === 'Auto-Submitted' ? 'Auto-submitted mention rejected by AM' : 'AI detection rejected'
      return { ...current, questionnaires, records, activities: addActivity(current, activityTitle, reason.trim(), 'review', form.accountId, form.recordId) }
    })
    setToast('Detection rejected and excluded from shared reporting.')
  }, [setToast])

  const simulateThreeDays = useCallback(() => {
    let count = 0
    setData((current) => {
      const pending = current.questionnaires.filter((form) => form.status === 'Pending Review')
      count = pending.length
      if (!pending.length) return current
      const expiredIds = new Set(pending.map((form) => form.id))
      const recordIds = new Set(pending.map((form) => form.recordId))
      const timestamp = new Date().toISOString()
      const questionnaires = current.questionnaires.map((form) => expiredIds.has(form.id) ? { ...form, status: 'Auto-Submitted' as const } : form)
      const records = current.records.map((record) => recordIds.has(record.id) ? { ...record, reviewStatus: 'Auto-Submitted' as const } : record)
      const activities = pending.reduce((items, form) => [{
        id: 'activity-sim-' + form.id + '-' + Date.now(),
        title: 'Form automatically submitted',
        detail: 'The simulated three-day review window expired. Original AI information was synced.',
        kind: 'status' as const,
        date: timestamp,
        accountId: form.accountId,
        recordId: form.recordId,
      }, ...items], current.activities)
      return { ...current, questionnaires, records, activities }
    })
    setToast(count ? count + ' form' + (count === 1 ? ' was' : 's were') + ' automatically submitted.' : 'There are no pending forms to expire.')
    return count
  }, [setToast])

  const updateAccountStatus = useCallback((accountId: string, status: AppData['accounts'][number]['status']) => {
    setData((current) => {
      const account = current.accounts.find((item) => item.id === accountId)
      if (!account || account.status === status) return current
      return {
        ...current,
        accounts: current.accounts.map((item) => item.id === accountId ? { ...item, status } : item),
        activities: addActivity(current, 'Account status updated', account.name + ' moved to ' + status.toLowerCase() + '.', 'status', accountId),
      }
    })
    setToast('Account status updated.')
  }, [setToast])

  const markNoticeRead = useCallback((id: string) => {
    setData((current) => ({ ...current, notices: current.notices.map((item) => item.id === id ? { ...item, read: true } : item) }))
  }, [])
  const markAllNoticesRead = useCallback(() => {
    setData((current) => ({ ...current, notices: current.notices.map((item) => ({ ...item, read: true })) }))
  }, [])

  const value = useMemo(() => ({
    data, toast, setToast, resetDemo, approveQuestionnaire, saveQuestionnaireDraft, rejectQuestionnaire, simulateThreeDays, updateAccountStatus, markNoticeRead, markAllNoticesRead,
  }), [data, toast, setToast, resetDemo, approveQuestionnaire, saveQuestionnaireDraft, rejectQuestionnaire, simulateThreeDays, updateAccountStatus, markNoticeRead, markAllNoticesRead])

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo() {
  const context = useContext(DemoContext)
  if (!context) throw new Error('useDemo must be used inside DemoProvider')
  return context
}
