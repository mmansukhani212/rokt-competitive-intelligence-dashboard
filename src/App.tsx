import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity as ActivityIcon, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Bot, Building2, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Download, ExternalLink, FileCheck2, Filter,
  Fingerprint, Gauge, LayoutDashboard, Menu, MoreHorizontal, RefreshCw, Search, ShieldAlert, Sparkles, Target, Users,
  X, Zap, CircleX, CircleDot, BarChart3, MessageSquareText, ArrowUpDown,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { competitors, managers, scoreToRisk } from './data'
import { useDemo } from './store'
import type { Account, AccountStatus, IntelligenceRecord, Questionnaire, RiskLevel } from './types'

const UIContext = createContext<{ openAccount: (id: string) => void; openReview: (id: string) => void; openHelp: () => void } | null>(null)
function useUI() {
  const value = useContext(UIContext)
  if (!value) throw new Error('UI context is not available')
  return value
}

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/intelligence', label: 'Intelligence Dashboard', icon: Target },
  { to: '/accounts', label: 'At-Risk Accounts', icon: ShieldAlert },
  { to: '/competitors', label: 'Competitor Insights', icon: BarChart3 },
  { to: '/reviews', label: 'AM Review Queue', icon: FileCheck2, badge: true },
]

const riskColors: Record<RiskLevel, string> = {
  Critical: '#397d98',
  High: '#2b5dc8',
  Medium: '#ae7725',
  Low: '#8997a8',
}

const HUBSPOT_RECORD_URL = 'https://app-na2.hubspot.com/contacts/247811175/record/0-3/364458171069/'
const CHART_TOOLTIP_CONTENT: React.CSSProperties = { backgroundColor: '#ffffff', border: '1px solid #dfe6ee', borderRadius: 10, boxShadow: '0 12px 30px #21324a12', padding: '8px 10px', fontSize: 12 }
const CHART_TOOLTIP_LABEL: React.CSSProperties = { color: '#65778d', fontWeight: 650, marginBottom: 3 }
const CHART_TOOLTIP_ITEM: React.CSSProperties = { color: '#334b66', fontSize: 12 }
const DATE_RANGE_DAYS: Record<string, number> = { 'Last 7 days': 7, 'Last 14 days': 14, 'Last 30 days': 30, 'Last 90 days': 90, 'Last 365 days': 365 }
const DATE_RANGE_OPTIONS = ['Last 7 days', 'Last 14 days', 'Last 30 days', 'Last 90 days', 'Last 365 days', 'All time', 'Custom date range']

function ChartTooltip(props: React.ComponentProps<typeof Tooltip>) {
  return <Tooltip {...props} contentStyle={CHART_TOOLTIP_CONTENT} labelStyle={CHART_TOOLTIP_LABEL} itemStyle={CHART_TOOLTIP_ITEM} />
}

function isWithinDateRange(value: string, range: string, startDate: string, endDate: string) {
  const timestamp = new Date(value).getTime()
  if (range === 'All time') return true
  if (range === 'Custom date range') {
    if (!startDate || !endDate) return false
    const start = new Date(startDate + 'T00:00:00').getTime()
    const end = new Date(endDate + 'T23:59:59.999').getTime()
    return start <= end && timestamp >= start && timestamp <= end
  }
  const days = DATE_RANGE_DAYS[range]
  return Number.isFinite(days) && timestamp >= Date.now() - days * 86400000
}

const accountStatuses: AccountStatus[] = ['New Risk', 'Under Review', 'Action in Progress', 'Monitoring', 'Resolved', 'Churned']
function money(value: number, compact = false) {
  if (compact && Math.abs(value) >= 1000000) return '$' + (value / 1000000).toFixed(2) + 'M'
  if (compact && Math.abs(value) >= 1000) return '$' + (value / 1000).toFixed(value >= 10000 ? 0 : 1) + 'K'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}
function dateLabel(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', options || { month: 'short', day: 'numeric' }).format(new Date(value))
}
function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}
function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (character) => character.toUpperCase())
}
function dayDistance(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000))
}
function riskClass(risk: string) {
  return 'risk-badge risk-' + risk.toLowerCase()
}
function latestRecord(records: IntelligenceRecord[], accountId: string) {
  return records.filter((record) => record.accountId === accountId && record.reviewStatus !== 'Rejected').sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))[0]
}
function latestAccountMention(records: IntelligenceRecord[], accountId: string) {
  return records.filter((record) => record.accountId === accountId).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))[0]
}
function initials(name: string) {
  return name.split(/[\s&]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}
function activeRiskAccounts(accounts: Account[], records: IntelligenceRecord[]) {
  return accounts.filter((account) => {
    const latest = latestRecord(records, account.id)
    return !!latest && latest.score >= 35 && !['Resolved', 'Churned', 'Healthy'].includes(account.status)
  })
}
function currentRecordRisk(data: ReturnType<typeof useDemo>['data'], account: Account) {
  const record = latestRecord(data.records, account.id)
  return record ? record.score : Math.max(0, 30 - account.health / 5)
}

function RiskBadge({ score }: { score: number }) {
  const level = scoreToRisk(score)
  return <span className={riskClass(level)}><span className="risk-dot" />{level}<span className="risk-score">{score}</span></span>
}
function ReviewBadge({ status }: { status: string }) {
  const cls = status.toLowerCase().replace(/ /g, '-')
  const Icon = status === 'Approved' ? CheckCircle2 : status === 'Pending Review' ? Clock3 : status === 'Auto-Submitted' ? Zap : status === 'Rejected' ? CircleX : Check
  return <span className={'review-badge review-' + cls}><Icon size={12} strokeWidth={2.2} />{status}</span>
}
function Avatar({ name, color = 'pink' }: { name: string; color?: string }) {
  return <span className={'avatar avatar-' + color} aria-label={name}>{initials(name)}</span>
}
function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="section-header">
    <div>
      <h1>{titleCase(title)}</h1>
      {description && <p className="section-description">{description}</p>}
    </div>
    {action && <div className="section-actions">{action}</div>}
  </div>
}
function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><span className="empty-icon"><CircleCheck2Fallback /></span><strong>{titleCase(title)}</strong><p>{text}</p></div>
}
function CircleCheck2Fallback() {
  return <CheckCircle2 size={20} />
}
function TableShell({ children }: { children: React.ReactNode }) {
  return <div className="table-scroll"><table className="data-table">{children}</table></div>
}
function PanelTitle({ title, note, action }: { title: string; note?: string; action?: React.ReactNode }) {
  return <div className="panel-title"><div><h2>{titleCase(title)}</h2>{note && <p>{note}</p>}</div>{action}</div>
}

function Shell() {
  const { data, toast, markAllNoticesRead, markNoticeRead, resetDemo } = useDemo()
  const location = useLocation()
  const navigate = useNavigate()
  const { search: routeSearch } = useLocation()
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const globalSearchRef = useRef<HTMLInputElement>(null)
  const pending = data.questionnaires.filter((form) => form.status === 'Pending Review').length
  useEffect(() => { setMobileMenu(false) }, [location.pathname, routeSearch])
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); globalSearchRef.current?.focus() }
      if (event.key === 'Escape') {
        setSelectedAccountId(null)
        setSelectedReviewId(null)
        setHelpOpen(false)
        setNotificationOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const ui = useMemo(() => ({
    openAccount: (id: string) => setSelectedAccountId(id),
    openReview: (id: string) => setSelectedReviewId(id),
    openHelp: () => setHelpOpen(true),
  }), [])

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    if (globalSearch.trim()) navigate('/intelligence?q=' + encodeURIComponent(globalSearch.trim()))
    else navigate('/intelligence')
  }

  return <UIContext.Provider value={ui}>
    <div className="app-shell">
      {mobileMenu && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
      <aside className={'sidebar ' + (mobileMenu ? 'sidebar-open' : '')}>
        <div className="brand-lockup">
          <Fingerprint className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Rokt</span>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ to, label, icon: Icon, end, badge }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => 'nav-link ' + (isActive ? 'nav-active' : '')}>
            <Icon size={17} strokeWidth={1.85} />
            <span>{titleCase(label)}</span>
            {badge && pending > 0 && <span className="nav-count">{pending}</span>}
          </NavLink>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-chip"><span className="live-dot" /> DEMO ENVIRONMENT</div>
          <button className="sidebar-link" onClick={() => setHelpOpen(true)}><CircleHelp size={16} /> How it works</button>
          <button className="sidebar-link" onClick={resetDemo}><RefreshCw size={16} /> Reset demo data</button>
          <div className="sidebar-profile">
            <Avatar name="Alex Morgan" />
            <div><strong>Alex Morgan</strong><small>Account Manager</small></div>
            <MoreHorizontal size={17} className="muted-icon" />
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-button" aria-label={mobileMenu ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenu} onClick={() => setMobileMenu((open) => !open)}><Menu size={19} /></button>
            <form className="global-search" onSubmit={submitSearch}>
              <Search size={15} />
              <input ref={globalSearchRef} aria-label="Search accounts and intelligence" value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search accounts, mentions..." />
              <kbd>⌘ K</kbd>
            </form>
          </div>
          <div className="topbar-tools">
            <span className="topbar-updated">Updated {data.activities[0] ? dateTime(data.activities[0].date) : 'just now'}</span>
            <div className="notification-wrap">
              <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotificationOpen(!notificationOpen)}>
                <Bell size={18} />{data.notices.some((notice) => !notice.read) && <i />}
              </button>
              {notificationOpen && <div className="notification-popover">
                <div className="popover-heading"><strong>Notifications</strong><button onClick={markAllNoticesRead}>Mark all read</button></div>
                {data.notices.slice(0, 5).map((notice) => <button className="notice-row notice-button" key={notice.id} onClick={() => markNoticeRead(notice.id)}><span className={notice.read ? 'notice-dot read' : 'notice-dot'} /><span><p>{notice.text}</p><small>{dateTime(notice.date)}</small></span></button>)}
                {!data.notices.length && <p className="muted small-pad">You're all caught up.</p>}
              </div>}
            </div>
          </div>
        </header>
        <main className="page-content">
          <div className="eyebrow product-masthead">Competitive Intelligence Dashboard</div>
          <Outlet context={{}} />
        </main>
        <footer className="demo-footer"><span><span className="footer-dot" /> DEMO ENVIRONMENT</span><span>All accounts, conversations, competitors, financial figures, and activity records are fictional and created for demonstration purposes.</span></footer>
      </div>

      {selectedAccountId && <AccountDrawer accountId={selectedAccountId} onClose={() => setSelectedAccountId(null)} onReview={setSelectedReviewId} />}
      {selectedReviewId && <QuestionnaireDrawer formId={selectedReviewId} onClose={() => setSelectedReviewId(null)} />}
      {helpOpen && <HowItWorksModal onClose={() => setHelpOpen(false)} />}
      {toast && <div className="toast" role="status"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  </UIContext.Provider>
}

function HowItWorksModal({ onClose }: { onClose: () => void }) {
  const steps = [
    ['01', 'Detect', 'AI trackers scan recorded calls for competitor offers, pricing pressure, and signs of switching intent.'],
    ['02', 'Validate', 'The account manager receives a prefilled form and has three days to review it.'],
    ['03', 'Act', 'Approved or auto-submitted insights appear in one shared view so teams can prioritize retention.'],
  ]
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="how-modal" role="dialog" aria-modal="true" aria-labelledby="how-title">
      <button className="icon-button modal-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
      <div className="eyebrow">THE REVIEW WORKFLOW</div><h2 id="how-title">From conversation to action.</h2>
      <p className="modal-intro">A lightweight, human-reviewed loop turns unstructured calls into timely retention work.</p>
      <div className="how-steps">{steps.map(([num, title, copy]) => <div className="how-step" key={num}><span>{num}</span><div><strong>{title}</strong><p>{copy}</p></div></div>)}</div>
      <div className="how-foot"><span>AI detected</span><ArrowRight size={14} /><span>AM verified</span><ArrowRight size={14} /><span>Dashboard synced</span></div>
      <button className="button button-primary full-button" onClick={onClose}>Explore the dashboard <ArrowRight size={15} /></button>
    </div>
  </div>
}

function AccountDrawer({ accountId, onClose, onReview }: { accountId: string; onClose: () => void; onReview: (id: string) => void }) {
  const { data, updateAccountStatus } = useDemo()
  const navigate = useNavigate()
  const account = data.accounts.find((item) => item.id === accountId)
  if (!account) return null
  const record = latestAccountMention(data.records, accountId)
  const manager = data.managers.find((item) => item.id === account.ownerId)
  const competitor = record && data.competitors.find((item) => item.id === record.competitorId)
  const form = record && data.questionnaires.find((item) => item.recordId === record.id)
  const activity = data.activities.filter((item) => item.accountId === accountId).slice(0, 5)
  const score = record?.score ?? 18
  const canReviewForm = form?.status === 'Pending Review' || form?.status === 'Auto-Submitted'
  const amReviewStage = form?.status === 'Auto-Submitted'
    ? { title: 'AM review window expired', detail: 'No AM response within three days · form auto-submitted', done: true }
    : form?.status === 'Approved'
      ? { title: 'AM review completed', detail: 'Approved by AM · details verified', done: true }
      : form?.status === 'Rejected'
        ? { title: 'AM review completed', detail: 'Rejected by AM · ' + (form.rejectionReason || 'mention excluded from shared reporting'), done: true }
        : form
          ? { title: 'AM review', detail: 'Awaiting AM review · due ' + dateLabel(form.deadlineAt), done: false }
          : { title: 'AM review', detail: record ? 'Waiting for a review form' : 'Waiting for a competitor mention', done: false }
  const submissionStage = form?.status === 'Auto-Submitted'
    ? { title: 'Form submitted', detail: 'Auto-submitted after three days · available to the team', done: true }
    : form?.status === 'Approved'
      ? { title: 'Form submitted', detail: 'Approved by AM · verified details synced', done: true }
      : form?.status === 'Rejected'
        ? { title: 'Review decision recorded', detail: 'Rejected by AM · excluded from shared reporting', done: true }
        : form
          ? { title: 'Form submitted', detail: 'Awaiting AM review and submission', done: false }
          : { title: 'Form submitted', detail: record ? 'No form submission recorded' : 'Waiting for a competitor mention', done: false }
  const reviewHistory = [
    { title: 'Call recorded', detail: record ? 'Fictional recording · ' + dateLabel(record.callDate) : 'No linked call recording', done: !!record },
    { title: 'Competitor mention detected', detail: record ? competitor?.name + ' · confidence ' + record.confidence + '%' : 'No mention detected', done: !!record },
    { title: 'Competitor mention form generated', detail: form ? 'Generated from call · ' + dateTime(form.detectedAt) : record ? 'No form generated for this mention' : 'Waiting for a competitor mention', done: !!form },
    amReviewStage,
    submissionStage,
  ]
  return <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="detail-drawer account-detail-drawer" role="dialog" aria-modal="true" aria-label={account.name + ' account detail'}>
      <div className="drawer-topline"><span>ACCOUNT PROFILE</span><button className="icon-button" aria-label="Close account details" onClick={onClose}><X size={18} /></button></div>
      <div className="drawer-heading">
        <div className="account-avatar"><Building2 size={21} /></div>
        <div><h2>{account.name}</h2><p>{account.industry} <span>·</span> {account.region}</p></div>
      </div>
      <div className="drawer-summary-grid">
        <div><span>Risk score</span><RiskBadge score={score} /></div>
        <div><span>Monthly revenue</span><strong>{money(account.monthlyRevenue)}</strong></div>
        <div><span>Account health</span><strong>{account.health}<small>/100</small></strong></div>
      <div><span>Competitor</span><strong>{competitor?.name || 'No recent mention'}</strong></div>
      </div>
      <div className="drawer-section">
        <div className="drawer-section-heading"><h3>Account status</h3><span className="verified-label"><span />Updates everywhere</span></div>
        <div className="status-select-wrap"><select aria-label="Update account status" className="field-select status-select" value={account.status} onChange={(event) => updateAccountStatus(account.id, event.target.value as AccountStatus)}>
          {accountStatuses.map((status) => <option key={status}>{status}</option>)}
          {account.status === 'Healthy' && <option>Healthy</option>}
        </select><ChevronDown size={14} aria-hidden="true" /></div>
      </div>
      <div className="drawer-section">
        <div className="drawer-section-heading"><h3>Competitor mention</h3>{record && <ReviewBadge status={record.reviewStatus} />}</div>
        {record ? <>
          <div className="detail-pair"><span>Date detected</span><strong>{dateTime(record.detectedAt)}</strong></div>
          <div className="detail-pair"><span>Offer type</span><strong>{record.reason}</strong></div>
          <div className="detail-pair"><span>Offer mentioned</span><strong>{record.offer}</strong></div>
          <div className="transcript-card"><div><Bot size={14} /> AI DETECTED · {record.confidence}% CONFIDENCE</div><blockquote>“{record.transcript}”</blockquote><p>{record.summary}</p></div>
          <div className="detail-pair"><span>Estimated churn likelihood</span><strong>{record.churnLikelihood}%</strong></div>
          {record.verified && <div className="am-verified-card"><div><CheckCircle2 size={13} />AM VERIFIED</div><p>{record.amNotes || 'Account manager confirmed the competitor mention.'}</p>{record.nextAction && <small>Next action · {record.nextAction}</small>}</div>}
        </> : <EmptyState title="No competitor mention detected" text="This account has no competitor mentions yet." />}
      </div>
      <div className="drawer-section">
        <div className="drawer-section-heading"><h3>Account team</h3></div>
        <div className="owner-row"><Avatar name={manager?.name || 'Alex Morgan'} /><div><strong>{manager?.name || 'Alex Morgan'}</strong><small>{manager?.role || 'Account manager'}</small></div></div>
        <div className="detail-pair"><span>Product usage</span><strong>{account.usage}</strong></div>
      </div>
      <div className="drawer-section">
        <div className="drawer-section-heading"><h3>Review history</h3></div>
        <div className="timeline">
          {reviewHistory.map((stage, index) => <div className={'timeline-item ' + (stage.done ? 'timeline-done' : '')} key={index}><span>{stage.done ? <Check size={11} /> : index + 1}</span><div><strong>{stage.title}</strong><small>{stage.detail}</small></div></div>)}
        </div>
        {activity.length > 0 && <div className="recent-account-activity"><span>RECENT ACTIVITY</span>{activity.slice(0, 3).map((item) => <p key={item.id}><i />{item.title}<small>{dateTime(item.date)}</small></p>)}</div>}
      </div>
      <div className="drawer-actions">
        {canReviewForm && form ? <button className="button button-primary" onClick={() => { onClose(); onReview(form.id) }}>Review form <ArrowRight size={14} /></button> : form ? <button className="button button-secondary" onClick={() => { onClose(); onReview(form.id) }}>View form <FileCheck2 size={14} /></button> : <button className="button button-secondary" disabled>No form</button>}
        <button className="button button-secondary" disabled={!record} onClick={() => { navigate('/intelligence'); onClose() }}>Intelligence dashboard <ExternalLink size={14} /></button>
        <a className="button button-secondary drawer-hubspot-link" href={HUBSPOT_RECORD_URL} target="_blank" rel="noreferrer">HubSpot record <ExternalLink size={14} /></a>
      </div>
    </aside>
  </div>
}

function QuestionnaireDrawer({ formId, onClose }: { formId: string; onClose: () => void }) {
  const { data, approveQuestionnaire, saveQuestionnaireDraft } = useDemo()
  const form = data.questionnaires.find((item) => item.id === formId)
  const record = form && data.records.find((item) => item.id === form.recordId)
  const account = form && data.accounts.find((item) => item.id === form.accountId)
  const owner = form && data.managers.find((item) => item.id === form.ownerId)
  const competitor = record && data.competitors.find((item) => item.id === record.competitorId)
  const [accurate, setAccurate] = useState<Questionnaire['accurate']>(form?.accurate || '')
  const [switching, setSwitching] = useState<Questionnaire['switching']>(form?.switching || '')
  const [offer, setOffer] = useState(form?.offer || '')
  const [context, setContext] = useState(form?.context || '')
  const [nextAction, setNextAction] = useState(form?.nextAction || 'Schedule a competitive value review')
  const [priority, setPriority] = useState(form?.priority || 'High')
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.floor(((form ? new Date(form.deadlineAt).getTime() : Date.now()) - Date.now()) / 1000)))
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(Math.max(0, Math.floor(((form ? new Date(form.deadlineAt).getTime() : Date.now()) - Date.now()) / 1000))), 1000)
    return () => window.clearInterval(timer)
  }, [form?.deadlineAt])
  if (!form || !record || !account) return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="detail-drawer"><button onClick={onClose} className="icon-button"><X /></button><EmptyState title="Form unavailable" text="This review may have been reset." /></aside></div>
  const isAutoSubmitted = form.status === 'Auto-Submitted'
  const canEditForm = form.status === 'Pending Review' || isAutoSubmitted
  const countdown = seconds > 0 ? Math.floor(seconds / 86400) + 'd ' + Math.floor((seconds % 86400) / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm' : 'Expired'
  if (!canEditForm) return <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="detail-drawer completed-review-drawer" role="dialog" aria-modal="true" aria-label="Completed form details"><div className="drawer-topline"><span>FORM RECORD</span><button className="icon-button" aria-label="Close review details" onClick={onClose}><X size={18} /></button></div><div className="completed-review-heading"><span className="completed-review-icon"><FileCheck2 size={20} /></span><div><h2>{account.name}</h2><p>{competitor?.name} · {dateTime(form.detectedAt)}</p></div></div><div className="completed-review-status"><span>Submission status</span><ReviewBadge status={form.status} /></div><div className="drawer-section"><div className="drawer-section-heading"><h3>AI-detected information</h3><span className="ai-detected"><Sparkles size={12} />AI DETECTED</span></div><div className="detail-pair"><span>Risk level</span><RiskBadge score={record.score} /></div><div className="detail-pair"><span>Offer type</span><strong>{record.reason}</strong></div><div className="detail-pair"><span>Offer or incentive</span><strong>{record.offer}</strong></div><div className="transcript-card"><div><Bot size={14} />CALL EXCERPT</div><blockquote>“{record.transcript}”</blockquote><p>{record.summary}</p></div></div><div className="drawer-section"><div className="drawer-section-heading"><h3>Account manager notes</h3><span className="verified-label"><span />{record.verified ? 'AM VERIFIED' : 'ORIGINAL AI DETAILS'}</span></div><p className="completed-notes">{form.context || record.amNotes || 'No additional AM notes were added.'}</p><div className="detail-pair"><span>Recommended action</span><strong>{form.nextAction || record.nextAction || 'No action recorded'}</strong></div><div className="detail-pair"><span>Priority</span><strong>{form.priority || record.priority || scoreToRisk(record.score)}</strong></div>{form.rejectionReason && <div className="rejection-note"><strong>Rejection reason</strong><p>{form.rejectionReason}</p></div>}</div><div className="drawer-section"><div className="detail-pair"><span>Review deadline</span><strong>{dateTime(form.deadlineAt)}</strong></div><div className="detail-pair"><span>Account manager</span><strong>{owner?.name || 'Alex Morgan'}</strong></div></div><div className="drawer-actions"><button className="button button-secondary full-button" onClick={onClose}>Close</button></div></aside></div>
  function submit(event: React.FormEvent) {
    event.preventDefault()
    const success = approveQuestionnaire(formId, { accurate, switching, offer, context, nextAction, priority })
    if (success) onClose()
  }
  return <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="detail-drawer review-drawer" role="dialog" aria-modal="true" aria-labelledby="form-title">
      <div className="drawer-topline"><span>HUBSPOT DEMO FORM</span><button className="icon-button" aria-label="Close review" onClick={onClose}><X size={18} /></button></div>
      <div className="review-heading"><div><div className="eyebrow">AM VALIDATION · {form.id.toUpperCase()}</div><h2 id="form-title">{isAutoSubmitted ? 'Review auto-submitted form' : 'Verify this mention'}</h2><p>{isAutoSubmitted ? 'Check for missed or incorrect details, then update the shared form.' : 'Confirm the conversation details before they enter shared reporting.'}</p></div><span className="deadline-pill"><Clock3 size={14} />{isAutoSubmitted ? 'Auto-submitted' : countdown + ' left'}</span></div>
      {isAutoSubmitted && <div className="auto-submitted-note"><Zap size={15} /><p>This form was submitted automatically after the three-day review window. Your corrections will replace the original details in shared intelligence.</p></div>}
      <form onSubmit={submit} className="review-form">
        <div className="form-section">
          <div className="form-section-title"><span>01</span><div><h3>Account information</h3><p>Matched from the call recording</p></div></div>
          <div className="form-grid">
            <label>Account name<input value={account.name} readOnly /></label>
            <label>Account manager<input value={owner?.name || 'Alex Morgan'} readOnly /></label>
            <label>Client call date<input value={dateTime(record.callDate)} readOnly /></label>
            <label>Recording reference<input value={'CALL-' + record.id.toUpperCase()} readOnly /></label>
          </div>
        </div>
        <div className="form-section ai-section">
          <div className="form-section-title"><span>02</span><div><h3>AI-detected intelligence</h3><p><span className="ai-detected"><Sparkles size={12} /> AI DETECTED</span> · {record.confidence}% confidence</p></div></div>
          <div className="form-grid">
            <label>Competitor mentioned<input value={competitor?.name || ''} readOnly /></label>
            <label>Threat type<input value={record.reason} readOnly /></label>
            <label className="span-2">Conversation excerpt<textarea rows={3} value={'“' + record.transcript + '”'} readOnly /></label>
            <label className="span-2">AI-generated summary<textarea rows={2} value={record.summary} readOnly /></label>
            <label className="span-2">Offer or incentive<input value={record.offer} readOnly /></label>
            <label>Client sentiment<input value={record.sentiment} readOnly /></label>
            <label>Estimated churn likelihood<input value={record.churnLikelihood + '% · ' + scoreToRisk(record.score) + ' risk'} readOnly /></label>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title"><span>03</span><div><h3>Account manager validation</h3><p><span className="verified-label"><span />REQUIRES VERIFICATION</span></p></div></div>
          <div className="form-grid">
            <label>Is the mention accurate?<select required value={accurate} onChange={(event) => setAccurate(event.target.value as Questionnaire['accurate'])}><option value="">Select an answer</option><option>Yes</option><option>No</option></select></label>
            <label>Actively considering a switch?<select required value={switching} onChange={(event) => setSwitching(event.target.value as Questionnaire['switching'])}><option value="">Select an answer</option><option>Yes</option><option>No</option><option>Unsure</option></select></label>
            <label className="span-2">Verified offer or incentive<input value={offer} onChange={(event) => setOffer(event.target.value)} placeholder="What did the client say was offered?" required /></label>
            <label className="span-2">Additional context<textarea rows={3} value={context} onChange={(event) => setContext(event.target.value)} placeholder="Add context from your customer relationship..." /></label>
            <label className="span-2">Recommended next action<input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="What should happen next?" required /></label>
            <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label>
          </div>
        </div>
        <div className="review-form-footer">
          <div><span className="save-indicator"><span />{isAutoSubmitted ? 'Edits stay local until you update the submitted form' : 'Unsaved edits stay local until approval'}</span><small>{isAutoSubmitted ? 'Auto-submitted after the review deadline: ' : 'Auto-submit deadline: '}{dateTime(form.deadlineAt)}</small></div>
          <button type="button" className="button button-secondary" onClick={() => { if (saveQuestionnaireDraft(formId, { accurate, switching, offer, context, nextAction, priority })) onClose() }}>Save for later</button>
          <button className="button button-primary" type="submit"><Check size={15} />{isAutoSubmitted ? 'Verify and update' : 'Approve and sync'}</button>
        </div>
      </form>
    </aside>
  </div>
}

function OverviewPage() {
  const { data, setToast } = useDemo()
  const { openAccount } = useUI()
  const [range, setRange] = useState('All time')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const accountsAtRisk = activeRiskAccounts(data.accounts, data.records)
  const approvedMentions = data.records.filter((record) => record.reviewStatus !== 'Rejected')
  const selectedRecords = approvedMentions.filter((record) => isWithinDateRange(record.detectedAt, range, startDate, endDate))
  const openExposure = accountsAtRisk.reduce((sum, account) => sum + account.monthlyRevenue, 0)
  const topAccounts = [...accountsAtRisk].sort((a, b) => currentRecordRisk(data, b) - currentRecordRisk(data, a)).slice(0, 6)
  const riskData = (['Critical', 'High', 'Medium', 'Low'] as RiskLevel[]).map((risk) => ({
    name: risk,
    value: data.accounts.filter((account) => scoreToRisk(currentRecordRisk(data, account)) === risk && !['Resolved', 'Churned'].includes(account.status)).length,
    color: riskColors[risk],
  }))
  const competitorData = data.competitors.map((competitor) => {
    const mentions = approvedMentions.filter((record) => record.competitorId === competitor.id)
    return { name: competitor.name.replace(' Digital', '').replace(' Media', ''), mentions: mentions.length, exposure: [...new Set(mentions.filter((record) => !['Resolved', 'Churned'].includes(data.accounts.find((item) => item.id === record.accountId)?.status || 'Healthy')).map((record) => record.accountId))].reduce((sum, id) => sum + (data.accounts.find((item) => item.id === id)?.monthlyRevenue || 0), 0), fill: competitor.accent }
  })
  const allRecordDates = selectedRecords.map((record) => new Date(record.detectedAt).getTime()).filter(Number.isFinite)
  const chartStart = range === 'Custom date range' && startDate ? new Date(startDate + 'T00:00:00').getTime()
    : DATE_RANGE_DAYS[range] ? Date.now() - (DATE_RANGE_DAYS[range] - 1) * 86400000
      : allRecordDates.length ? Math.min(...allRecordDates) : Date.now() - 6 * 86400000
  const chartEnd = range === 'Custom date range' && endDate ? new Date(endDate + 'T23:59:59.999').getTime() : Date.now()
  const firstChartDay = new Date(chartStart)
  firstChartDay.setHours(0, 0, 0, 0)
  const lastChartDay = new Date(chartEnd)
  const calendarDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const daySpan = Math.max(1, Math.floor((calendarDay(lastChartDay) - calendarDay(firstChartDay)) / 86400000) + 1)
  const bucketCount = daySpan <= 14 ? daySpan : 12
  const totalDuration = Math.max(86400000, chartEnd - firstChartDay.getTime() + 1)
  const trendData = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = daySpan <= 14 ? new Date(firstChartDay.getFullYear(), firstChartDay.getMonth(), firstChartDay.getDate() + index).getTime() : firstChartDay.getTime() + totalDuration * index / bucketCount
    const bucketEnd = daySpan <= 14 ? new Date(firstChartDay.getFullYear(), firstChartDay.getMonth(), firstChartDay.getDate() + index + 1).getTime() : firstChartDay.getTime() + totalDuration * (index + 1) / bucketCount
    const bucketDate = new Date(bucketStart + (bucketEnd - bucketStart) / 2)
    const label = new Intl.DateTimeFormat('en-US', daySpan <= 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' }).format(bucketDate)
    const bucketRecords = selectedRecords.filter((record) => {
      const detectedAt = new Date(record.detectedAt).getTime()
      return detectedAt >= bucketStart && (index === bucketCount - 1 ? detectedAt <= chartEnd : detectedAt < bucketEnd)
    })
    return { label, mentions: bucketRecords.length, highRisk: bucketRecords.filter((record) => record.score >= 65).length }
  })
  const feed = data.activities.slice(0, 6)
  function exportCsv() {
    const header = 'Account,Competitor,Risk score,Risk level,Monthly revenue,Account manager,Review status,Detected at'
    const rows = approvedMentions.map((record) => {
      const account = data.accounts.find((item) => item.id === record.accountId)!
      const competitor = data.competitors.find((item) => item.id === record.competitorId)!
      const owner = data.managers.find((item) => item.id === account.ownerId)!
      return [account.name, competitor.name, record.score, scoreToRisk(record.score), account.monthlyRevenue, owner.name, record.reviewStatus, dateLabel(record.detectedAt)].map((value) => '"' + String(value).replace(/"/g, '""') + '"').join(',')
    })
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'competitor-intelligence-report.csv'; anchor.click(); URL.revokeObjectURL(url)
    setToast('Intelligence report exported.')
  }
  return <>
    <SectionHeader title="Overview" description="Monitor competitor activity, identify revenue risks, and take action before accounts churn." action={<button className="button button-primary" onClick={exportCsv}><Download size={15} />Export report</button>} />
    <div className="overview-toolbar"><span className="updated-label"><span className="live-dot" />Live demo data <span>·</span> Updated just now</span><div className="overview-date-controls"><label className="select-with-icon"><CalendarDays size={14} /><select aria-label="Select overview date range" value={range} onChange={(event) => setRange(event.target.value)}>{DATE_RANGE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={14} /></label>{range === 'Custom date range' && <div className="custom-date-range"><label><span>From</span><input type="date" aria-label="Overview start date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label><label><span>To</span><input type="date" aria-label="Overview end date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label></div>}</div></div>
    <section className="kpi-grid" aria-label="Key portfolio metrics">
      <MetricCard label="Accounts monitored" value={data.accounts.length.toLocaleString()} icon={Building2} subtext="Across 3 regions" trend="+12 this quarter" />
      <MetricCard label="Accounts at risk" value={accountsAtRisk.length.toString()} icon={ShieldAlert} subtext="Critical + high priority" trend={accountsAtRisk.filter((account) => currentRecordRisk(data, account) >= 65).length + ' high priority'} tone="risk" />
      <MetricCard label="Competitor mentions" value={approvedMentions.length.toString()} icon={MessageSquareText} subtext={selectedRecords.length + ' in selected period'} trend="+18% vs. prior period" />
      <MetricCard label="Revenue at risk" value={money(openExposure, true)} icon={Gauge} subtext="Estimated monthly exposure" trend="Across active accounts" tone="dark" />
      <MetricCard label="Pending AM reviews" value={data.questionnaires.filter((form) => form.status === 'Pending Review').length.toString()} icon={Clock3} subtext="Awaiting validation" trend="3 due in 24 hours" tone="review" />
    </section>
    <section className="chart-grid chart-grid-main">
      <div className="panel trend-panel"><PanelTitle title="Competitor mention trend" note="Mentions by detection date; dark line marks high and critical risk" action={<span className="chart-legend"><i className="legend-magenta" />All mentions <i className="legend-dark" />High risk</span>} />
        <div className="chart-box chart-large"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData} margin={{ top: 12, right: 7, left: -20, bottom: 0 }}>
          <defs><linearGradient id="mentionsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2b5dc8" stopOpacity={0.16} /><stop offset="92%" stopColor="#2b5dc8" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="#dfe6ee" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8997a8', fontSize: 12 }} dy={9} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8997a8', fontSize: 12 }} />
          <ChartTooltip contentStyle={CHART_TOOLTIP_CONTENT} labelStyle={CHART_TOOLTIP_LABEL} itemStyle={CHART_TOOLTIP_ITEM} />
          <Area type="monotone" dataKey="mentions" name="All mentions" stroke="#2b5dc8" strokeWidth={2.5} fill="url(#mentionsFill)" activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="highRisk" name="High risk" stroke="#172b44" strokeWidth={2} dot={false} />
        </AreaChart></ResponsiveContainer></div>
        <div className="chart-foot"><span>Counts competitor mentions per date bucket; high risk means a score of 65 or higher.</span><Link className="text-button" to="/intelligence">View all mentions <ArrowRight size={13} /></Link></div>
      </div>
      <div className="panel distribution-panel"><PanelTitle title="Risk distribution" note="Across monitored accounts" action={<span className="chart-live-tag">LIVE</span>} />
        <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskData} dataKey="value" nameKey="name" innerRadius="56%" outerRadius="74%" paddingAngle={3} stroke="none">{riskData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><ChartTooltip contentStyle={CHART_TOOLTIP_CONTENT} labelStyle={CHART_TOOLTIP_LABEL} itemStyle={CHART_TOOLTIP_ITEM} /></PieChart></ResponsiveContainer>
          <div className="donut-center"><strong>{data.accounts.length}</strong><span>accounts</span></div></div>
        <div className="risk-legend">{riskData.map((item) => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{item.value}</strong></div>)}</div>
      </div>
    </section>
    <section className="chart-grid chart-grid-secondary">
      <div className="panel competitor-chart-panel"><PanelTitle title="Top competitors" note="Mention frequency in customer calls" action={<Link className="text-button" to="/competitors">View insights <ArrowRight size={13} /></Link>} />
        <div className="chart-box chart-bars"><ResponsiveContainer width="100%" height="100%"><BarChart data={competitorData} layout="vertical" margin={{ top: 4, right: 20, left: 6, bottom: 0 }}><CartesianGrid stroke="#dfe6ee" horizontal={false} /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#8997a8', fontSize: 12 }} /><YAxis type="category" dataKey="name" width={92} axisLine={false} tickLine={false} tick={{ fill: '#65778d', fontSize: 12 }} /><ChartTooltip cursor={{ fill: '#f4f7ff' }} contentStyle={CHART_TOOLTIP_CONTENT} labelStyle={CHART_TOOLTIP_LABEL} itemStyle={CHART_TOOLTIP_ITEM} /><Bar dataKey="mentions" name="Mentions" radius={[0, 6, 6, 0]} barSize={15}>{competitorData.map((item) => <Cell key={item.name} fill={item.fill} />)}</Bar></BarChart></ResponsiveContainer></div>
      </div>
      <div className="panel exposure-panel"><PanelTitle title="Revenue exposure" note="At-risk monthly revenue by competitor" />
        <div className="exposure-list">{competitorData.map((item) => <div className="exposure-row" key={item.name}><span className="exposure-dot" style={{ background: item.fill }} /><div className="exposure-copy"><span>{item.name}</span><div className="mini-bar"><i style={{ width: Math.max(6, (item.exposure / Math.max(...competitorData.map((row) => row.exposure), 1)) * 100) + '%', background: item.fill }} /></div></div><strong>{money(item.exposure, true)}</strong></div>)}</div>
        <div className="exposure-total"><span>Total active exposure</span><strong>{money(openExposure, true)}</strong></div>
      </div>
    </section>
    <section className="overview-bottom-grid">
      <div className="panel priority-panel"><PanelTitle title="Highest priority accounts" note="Accounts that need attention first" action={<Link className="text-button" to="/accounts">View all accounts <ArrowRight size={13} /></Link>} />
        <TableShell><thead><tr><th>Account</th><th>Competitor</th><th>Risk</th><th>Monthly revenue</th><th>Date detected</th><th>Assigned AM</th><th>Review</th><th></th></tr></thead><tbody>
          {topAccounts.map((account) => {
            const record = latestRecord(data.records, account.id)!
            const owner = data.managers.find((item) => item.id === account.ownerId)!
            const competitor = data.competitors.find((item) => item.id === record.competitorId)!
            return <tr key={account.id} className="clickable-row" onClick={() => openAccount(account.id)}><td><AccountCell account={account} /></td><td><span className="competitor-dot" style={{ background: competitor.accent }} />{competitor.name}</td><td><RiskBadge score={record.score} /></td><td className="tabular">{money(account.monthlyRevenue)}</td><td className="date-cell">{dateLabel(record.detectedAt)}</td><td><span className="table-owner"><Avatar name={owner.name} color="blue" />{owner.name}</span></td><td><ReviewBadge status={record.reviewStatus} /></td><td><button className="row-arrow" aria-label={'Open ' + account.name}><ArrowRight size={15} /></button></td></tr>
          })}
        </tbody></TableShell>
      </div>
      <div className="panel activity-panel"><PanelTitle title="Recent intelligence activity" note="Live updates from across your portfolio" action={<span className="live-label"><i />LIVE</span>} />
        <div className="activity-feed">{feed.map((item) => {
          const account = item.accountId ? data.accounts.find((entry) => entry.id === item.accountId) : undefined
          return <button className="feed-item" key={item.id} onClick={() => account && openAccount(account.id)}><span className={'feed-icon feed-' + item.kind}>{item.kind === 'detection' ? <Bot size={15} /> : item.kind === 'review' ? <Check size={15} /> : item.kind === 'risk' ? <ShieldAlert size={15} /> : item.kind === 'status' ? <Zap size={15} /> : <ActivityIcon size={15} />}</span><span className="feed-copy"><strong>{item.title}</strong><span>{account?.name || 'Portfolio'} · {item.detail}</span><small>{dateTime(item.date)}</small></span><ArrowRight size={14} className="feed-arrow" /></button>
        })}</div>
      </div>
    </section>
  </>
}
function MetricCard({ label, value, icon: Icon, subtext, trend, tone = '' }: { label: string; value: string; icon: React.ElementType; subtext: string; trend: string; tone?: string }) {
  return <div className={'metric-card ' + (tone ? 'metric-' + tone : '')}><div className="metric-card-top"><span>{titleCase(label)}</span><span className="metric-icon"><Icon size={16} /></span></div><strong className="metric-value">{value}</strong><div className="metric-bottom"><span>{subtext}</span><span className="metric-trend"><i />{trend}</span></div></div>
}
function AccountCell({ account }: { account: Account }) {
  return <span className="account-cell"><span className="account-cell-icon"><Building2 size={14} /></span><span><strong>{account.name}</strong><small>{account.industry}</small></span></span>
}

function IntelligencePage() {
  const { data } = useDemo()
  const { openAccount } = useUI()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [competitor, setCompetitor] = useState('All competitors')
  const [risk, setRisk] = useState('All risk levels')
  const [owner, setOwner] = useState('All account managers')
  const [status, setStatus] = useState('All review statuses')
  const [product, setProduct] = useState('All products')
  const [dateRange, setDateRange] = useState('All time')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortBy, setSortBy] = useState('detectedAt')
  const [sortDesc, setSortDesc] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 10
  useEffect(() => { setSearch(searchParams.get('q') || '') }, [searchParams])
  const records = data.records.filter((record) => record.reviewStatus !== 'Rejected')
  const filtered = records.filter((record) => {
    const account = data.accounts.find((item) => item.id === record.accountId)!
    const ownerEntry = data.managers.find((item) => item.id === account.ownerId)!
    const competitorEntry = data.competitors.find((item) => item.id === record.competitorId)!
    const term = search.trim().toLowerCase()
    const within = isWithinDateRange(record.detectedAt, dateRange, startDate, endDate)
    return within && (!term || [account.name, competitorEntry.name, record.context, ownerEntry.name].some((value) => value.toLowerCase().includes(term))) &&
      (competitor === 'All competitors' || competitorEntry.name === competitor) &&
      (risk === 'All risk levels' || scoreToRisk(record.score) === risk) &&
      (owner === 'All account managers' || ownerEntry.name === owner) &&
      (status === 'All review statuses' || record.reviewStatus === status) &&
      (product === 'All products' || record.product === product)
  })
  const sorted = [...filtered].sort((a, b) => {
    const accountA = data.accounts.find((item) => item.id === a.accountId)!
    const accountB = data.accounts.find((item) => item.id === b.accountId)!
    const competitorA = data.competitors.find((item) => item.id === a.competitorId)!
    const competitorB = data.competitors.find((item) => item.id === b.competitorId)!
    const ownerA = data.managers.find((item) => item.id === accountA.ownerId)!
    const ownerB = data.managers.find((item) => item.id === accountB.ownerId)!
    let av: string | number = a.detectedAt
    let bv: string | number = b.detectedAt
    if (sortBy === 'account') { av = accountA.name; bv = accountB.name }
    if (sortBy === 'competitor') { av = competitorA.name; bv = competitorB.name }
    if (sortBy === 'context') { av = a.context; bv = b.context }
    if (sortBy === 'risk') { av = a.score; bv = b.score }
    if (sortBy === 'revenue') { av = accountA.monthlyRevenue; bv = accountB.monthlyRevenue }
    if (sortBy === 'owner') { av = ownerA.name; bv = ownerB.name }
    if (sortBy === 'reviewStatus') { av = a.reviewStatus; bv = b.reviewStatus }
    if (typeof av === 'string' && typeof bv === 'string') return sortDesc ? bv.localeCompare(av) : av.localeCompare(bv)
    return sortDesc ? Number(bv) - Number(av) : Number(av) - Number(bv)
  })
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)
  const clear = () => { setSearch(''); setCompetitor('All competitors'); setRisk('All risk levels'); setOwner('All account managers'); setStatus('All review statuses'); setProduct('All products'); setDateRange('All time'); setStartDate(''); setEndDate(''); setPage(1); setSearchParams({}) }
  const activeFilterChips = [
    ...(competitor !== 'All competitors' ? [{ label: 'Competitor', value: competitor, clear: () => setCompetitor('All competitors') }] : []),
    ...(risk !== 'All risk levels' ? [{ label: 'Risk', value: risk, clear: () => setRisk('All risk levels') }] : []),
    ...(owner !== 'All account managers' ? [{ label: 'AM', value: owner, clear: () => setOwner('All account managers') }] : []),
    ...(status !== 'All review statuses' ? [{ label: 'Review', value: status, clear: () => setStatus('All review statuses') }] : []),
    ...(product !== 'All products' ? [{ label: 'Product', value: product, clear: () => setProduct('All products') }] : []),
    ...(dateRange !== 'All time' ? [{ label: 'Date', value: dateRange === 'Custom date range' ? `${startDate || 'Start'} – ${endDate || 'End'}` : dateRange, clear: () => { setDateRange('All time'); setStartDate(''); setEndDate('') } }] : []),
  ]
  const activeFilters = [competitor !== 'All competitors', risk !== 'All risk levels', owner !== 'All account managers', status !== 'All review statuses', product !== 'All products', dateRange !== 'All time'].filter(Boolean).length
  const filteredRisk = filtered.filter((record) => record.score >= 65).length
  const competitorChart = data.competitors.map((item) => ({ name: item.name.replace(' Digital', '').replace(' Media', ''), mentions: filtered.filter((record) => record.competitorId === item.id).length, color: item.accent }))
  const riskChart = (['Critical', 'High', 'Medium', 'Low'] as RiskLevel[]).map((level) => ({ name: level, value: filtered.filter((record) => scoreToRisk(record.score) === level).length, color: riskColors[level] }))
  return <>
    <SectionHeader title="Intelligence dashboard" description="A centralized view of competitor activity and customer churn mentions across your account portfolio." action={<button className="button button-secondary" onClick={() => clear()}><RefreshCw size={14} />Clear filters</button>} />
    <div className="dashboard-metrics">
      <MiniMetric label="Mentions in view" value={filtered.length} icon={MessageSquareText} />
      <MiniMetric label="High priority" value={filteredRisk} icon={ShieldAlert} />
      <MiniMetric label="AM verified insights" value={filtered.filter((record) => record.verified).length} icon={CheckCircle2} />
      <MiniMetric label="Revenue exposure in view" value={money([...new Set(filtered.map((record) => record.accountId))].reduce((sum, id) => sum + (data.accounts.find((item) => item.id === id)?.monthlyRevenue || 0), 0), true)} icon={Gauge} />
    </div>
    <div className="intel-chart-grid">
      <div className="panel intel-chart-panel"><PanelTitle title="Mentions by competitor" note="Updates with the current filters" />
        <div className="chart-box intel-bar-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={competitorChart} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}><CartesianGrid stroke="#dfe6ee" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8997a8', fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8997a8', fontSize: 10 }} /><ChartTooltip contentStyle={{ border: '1px solid #dfe6ee', borderRadius: 9, fontSize: 12 }} /><Bar dataKey="mentions" name="Mentions" radius={[5, 5, 0, 0]} barSize={24}>{competitorChart.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer></div>
      </div>
      <div className="panel intel-chart-panel"><PanelTitle title="Risk levels in view" note="Mention count by latest risk score" />
        <div className="intel-risk-chart"><div className="intel-risk-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskChart} dataKey="value" nameKey="name" innerRadius={39} outerRadius={54} paddingAngle={3} stroke="none">{riskChart.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><ChartTooltip /></PieChart></ResponsiveContainer><div><strong>{filtered.length}</strong><small>mentions</small></div></div><div className="intel-risk-legend">{riskChart.map((item) => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{item.value}</strong></div>)}</div></div>
      </div>
    </div>
    <div className="panel intelligence-panel">
      <div className="filter-toolbar">
        <div className="table-search"><Search size={15} /><input aria-label="Search intelligence" placeholder="Search accounts, competitors, or call context..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></div>
        <label className="filter-select"><CalendarDays size={14} /><select aria-label="Select intelligence date range" value={dateRange} onChange={(event) => { setDateRange(event.target.value); setPage(1) }}>{['All time', ...DATE_RANGE_OPTIONS.filter((option) => option !== 'All time')].map((option) => <option key={option}>{option}</option>)}</select></label>
        {dateRange === 'Custom date range' && <div className="custom-date-range filter-custom-date-range"><label><span>From</span><input type="date" aria-label="Intelligence start date" value={startDate} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setPage(1) }} /></label><label><span>To</span><input type="date" aria-label="Intelligence end date" value={endDate} min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setPage(1) }} /></label></div>}
        <label className="filter-select"><Filter size={14} /><select value={competitor} onChange={(event) => { setCompetitor(event.target.value); setPage(1) }}><option>All competitors</option>{data.competitors.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label className="filter-select"><select value={risk} aria-label="Filter risk level" onChange={(event) => { setRisk(event.target.value); setPage(1) }}><option>All risk levels</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label>
        <label className="filter-select"><select value={owner} aria-label="Filter account manager" onChange={(event) => { setOwner(event.target.value); setPage(1) }}><option>All account managers</option>{data.managers.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label className="filter-select"><select value={status} aria-label="Filter review status" onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option>All review statuses</option><option>Pending Review</option><option>Approved</option><option>Auto-Submitted</option><option>Rejected</option></select></label>
        <label className="filter-select"><select value={product} aria-label="Filter product category" onChange={(event) => { setProduct(event.target.value); setPage(1) }}><option>All products</option>{Array.from(new Set(data.records.map((item) => item.product))).map((item) => <option key={item}>{item}</option>)}</select></label>
        {(activeFilters > 0 || search) && <button className="text-button clear-filters" onClick={clear}>Clear all {activeFilters > 0 && <span>({activeFilters})</span>}<X size={13} /></button>}
      </div>
      {activeFilterChips.length > 0 && <div className="active-filter-chips" aria-label="Active filters">{activeFilterChips.map((chip) => <button className="filter-chip" key={chip.label} onClick={() => { chip.clear(); setPage(1) }} aria-label={'Remove ' + chip.label + ' filter'}><span>{chip.label}</span>{chip.value}<X size={12} /></button>)}</div>}
      <div className="table-heading"><div><h2>Account intelligence</h2><span>{filtered.length} records · Sorted by {sortBy === 'detectedAt' ? 'detection date' : sortBy}</span></div></div>
      <TableShell><thead><tr>
        {[['account', 'Account'], ['competitor', 'Competitor mentioned'], ['context', 'Client Context'], ['risk', 'Risk score'], ['revenue', 'Monthly revenue'], ['owner', 'Account manager'], ['detectedAt', 'Date detected'], ['reviewStatus', 'Review status']].map(([key, label]) => <th key={key}><button className="sort-button" onClick={() => { setSortDesc(sortBy === key ? !sortDesc : true); setSortBy(key); setPage(1) }}>{titleCase(label)}<ArrowUpDown size={12} /></button></th>)}<th aria-label="Open account"></th>
      </tr></thead><tbody>
        {rows.map((record) => {
          const account = data.accounts.find((item) => item.id === record.accountId)!
          const company = data.competitors.find((item) => item.id === record.competitorId)!
          const accountOwner = data.managers.find((item) => item.id === account.ownerId)!
          return <tr className="clickable-row" key={record.id} onClick={() => openAccount(account.id)}>
            <td><AccountCell account={account} /></td><td><span className="competitor-dot" style={{ background: company.accent }} />{company.name}</td>
            <td><span className="context-cell">{record.reason}<small>{record.context}</small></span></td><td><RiskBadge score={record.score} /></td><td className="tabular">{money(account.monthlyRevenue)}</td>
            <td><span className="table-owner"><Avatar name={accountOwner.name} color="blue" />{accountOwner.name}</span></td><td className="date-cell">{dateLabel(record.detectedAt)}</td><td><ReviewBadge status={record.reviewStatus} /></td>
            <td><button className="row-arrow" aria-label={'Open ' + account.name}><ArrowRight size={15} /></button></td>
          </tr>
        })}
        {rows.length === 0 && <tr><td colSpan={9}><EmptyState title="No matching mentions" text="Try adjusting or clearing your filters." /></td></tr>}
      </tbody></TableShell>
      <div className="table-pagination"><span>Showing <strong>{filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> records</span><div><button className="pagination-button" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><span className="page-count">Page {page} of {pageCount}</span><button className="pagination-button" disabled={page >= pageCount} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button></div></div>
    </div>
  </>
}
function MiniMetric({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return <div className="mini-metric"><span className="mini-metric-icon"><Icon size={16} /></span><div><small>{titleCase(label)}</small><strong>{value}</strong></div></div>
}

function AtRiskPage() {
  const { data, updateAccountStatus } = useDemo()
  const { openAccount } = useUI()
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState('All time')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [competitorFilter, setCompetitorFilter] = useState('All competitors')
  const [riskFilter, setRiskFilter] = useState('All risk levels')
  const [ownerFilter, setOwnerFilter] = useState('All account managers')
  const [reviewFilter, setReviewFilter] = useState('All review statuses')
  const [productFilter, setProductFilter] = useState('All products')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  function clearFilters() {
    setSearch('')
    setDateRange('All time')
    setStartDate('')
    setEndDate('')
    setCompetitorFilter('All competitors')
    setRiskFilter('All risk levels')
    setOwnerFilter('All account managers')
    setReviewFilter('All review statuses')
    setProductFilter('All products')
    setStatusFilter('All statuses')
  }
  const atRisk = activeRiskAccounts(data.accounts, data.records).filter((account) => {
    const record = latestRecord(data.records, account.id)
    if (!record) return false
    const competitor = data.competitors.find((item) => item.id === record.competitorId)!
    const manager = data.managers.find((item) => item.id === account.ownerId)!
    const term = search.trim().toLowerCase()
    return isWithinDateRange(record.detectedAt, dateRange, startDate, endDate) &&
      (!term || [account.name, competitor.name, record.context, manager.name, account.status].some((value) => value.toLowerCase().includes(term))) &&
      (competitorFilter === 'All competitors' || competitor.name === competitorFilter) &&
      (riskFilter === 'All risk levels' || scoreToRisk(record.score) === riskFilter) &&
      (ownerFilter === 'All account managers' || manager.name === ownerFilter) &&
      (reviewFilter === 'All review statuses' || record.reviewStatus === reviewFilter) &&
      (productFilter === 'All products' || record.product === productFilter) &&
      (statusFilter === 'All statuses' || account.status === statusFilter)
  }).sort((a, b) => currentRecordRisk(data, b) - currentRecordRisk(data, a))
  const riskExposure = atRisk.reduce((sum, account) => sum + account.monthlyRevenue, 0)
  const activeFilterChips = [
    ...(competitorFilter !== 'All competitors' ? [{ label: 'Competitor', value: competitorFilter, clear: () => setCompetitorFilter('All competitors') }] : []),
    ...(riskFilter !== 'All risk levels' ? [{ label: 'Risk', value: riskFilter, clear: () => setRiskFilter('All risk levels') }] : []),
    ...(ownerFilter !== 'All account managers' ? [{ label: 'AM', value: ownerFilter, clear: () => setOwnerFilter('All account managers') }] : []),
    ...(reviewFilter !== 'All review statuses' ? [{ label: 'Review', value: reviewFilter, clear: () => setReviewFilter('All review statuses') }] : []),
    ...(productFilter !== 'All products' ? [{ label: 'Product', value: productFilter, clear: () => setProductFilter('All products') }] : []),
    ...(statusFilter !== 'All statuses' ? [{ label: 'Account status', value: statusFilter, clear: () => setStatusFilter('All statuses') }] : []),
    ...(dateRange !== 'All time' ? [{ label: 'Date', value: dateRange === 'Custom date range' ? `${startDate || 'Start'} – ${endDate || 'End'}` : dateRange, clear: () => { setDateRange('All time'); setStartDate(''); setEndDate('') } }] : []),
  ]
  const activeFilters = [competitorFilter !== 'All competitors', riskFilter !== 'All risk levels', ownerFilter !== 'All account managers', reviewFilter !== 'All review statuses', productFilter !== 'All products', statusFilter !== 'All statuses', dateRange !== 'All time'].filter(Boolean).length
  return <>
    <SectionHeader title="At-risk accounts" description="Prioritize vulnerable accounts and coordinate the next retention action." action={<><button className="text-button" onClick={clearFilters}><RefreshCw size={14} />Clear filters</button><Link className="button button-primary" to="/reviews"><FileCheck2 size={15} />Open review queue</Link></>} />
    <div className="risk-summary-strip"><div><span className="summary-icon summary-red"><ShieldAlert size={17} /></span><div><small>Active at-risk accounts</small><strong>{atRisk.length}</strong></div></div><div><span className="summary-icon summary-orange"><ArrowDownRight size={17} /></span><div><small>Critical + high priority</small><strong>{atRisk.filter((account) => currentRecordRisk(data, account) >= 65).length}</strong></div></div><div><span className="summary-icon summary-pink"><Gauge size={17} /></span><div><small>Monthly revenue exposure</small><strong>{money(riskExposure, true)}</strong></div></div><div><span className="summary-icon summary-green"><CheckCircle2 size={17} /></span><div><small>Accounts resolved</small><strong>{data.accounts.filter((account) => account.status === 'Resolved').length}</strong></div></div></div>
    <div className="panel risk-table-panel">
      <div className="filter-toolbar risk-filter-toolbar">
        <div className="table-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search accounts, competitors, or call context..." aria-label="Search at-risk accounts" /></div>
        <label className="filter-select"><CalendarDays size={14} /><select aria-label="Select at-risk date range" value={dateRange} onChange={(event) => setDateRange(event.target.value)}>{['All time', ...DATE_RANGE_OPTIONS.filter((option) => option !== 'All time')].map((option) => <option key={option}>{option}</option>)}</select></label>
        {dateRange === 'Custom date range' && <div className="custom-date-range filter-custom-date-range"><label><span>From</span><input type="date" aria-label="At-risk start date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label><label><span>To</span><input type="date" aria-label="At-risk end date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label></div>}
        <label className="filter-select"><Filter size={14} /><select aria-label="Filter competitor" value={competitorFilter} onChange={(event) => setCompetitorFilter(event.target.value)}><option>All competitors</option>{data.competitors.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label className="filter-select"><select aria-label="Filter risk level" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}><option>All risk levels</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label>
        <label className="filter-select"><select aria-label="Filter account manager" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}><option>All account managers</option>{data.managers.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label className="filter-select"><select aria-label="Filter review status" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}><option>All review statuses</option><option>Pending Review</option><option>Approved</option><option>Auto-Submitted</option><option>Rejected</option></select></label>
        <label className="filter-select"><select aria-label="Filter product category" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option>All products</option>{Array.from(new Set(data.records.map((item) => item.product))).map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="filter-select"><select value={statusFilter} aria-label="Filter account status" onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{accountStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        {(activeFilters > 0 || search) && <button className="text-button clear-filters" onClick={clearFilters}>Clear all {activeFilters > 0 && <span>({activeFilters})</span>}<X size={13} /></button>}
      </div>
      {activeFilterChips.length > 0 && <div className="active-filter-chips" aria-label="Active filters">{activeFilterChips.map((chip) => <button className="filter-chip" key={chip.label} onClick={chip.clear} aria-label={'Remove ' + chip.label + ' filter'}><span>{chip.label}</span>{chip.value}<X size={12} /></button>)}</div>}
      <div className="table-heading risk-table-heading"><div><h2>Risk queue <span className="table-count">{atRisk.length}</span></h2><span>Sorted by score, highest risk first</span></div></div>
      <TableShell><thead><tr><th>Account</th><th>Risk score</th><th>Competitor</th><th>Reason for risk</th><th>Monthly revenue</th><th>Account manager</th><th>Date detected</th><th>Last action</th><th>Current status</th><th aria-label="Open account"></th></tr></thead><tbody>
        {atRisk.map((account) => {
          const record = latestRecord(data.records, account.id)!
          const competitor = data.competitors.find((item) => item.id === record.competitorId)!
          const manager = data.managers.find((item) => item.id === account.ownerId)!
          const lastAction = data.activities.filter((item) => item.accountId === account.id).sort((left, right) => right.date.localeCompare(left.date))[0]
          return <tr key={account.id} className="clickable-row" onClick={() => openAccount(account.id)}>
            <td><AccountCell account={account} /></td><td><RiskBadge score={record.score} /></td><td><span className="competitor-dot" style={{ background: competitor.accent }} />{competitor.name}</td><td>{record.reason}</td><td className="tabular">{money(account.monthlyRevenue)}</td><td><span className="table-owner"><Avatar name={manager.name} color="blue" />{manager.name}</span></td><td>{dayDistance(record.detectedAt)}d ago</td><td><span className="last-action-cell">{lastAction?.title || 'Mention detected'}<small>{lastAction ? dateLabel(lastAction.date) : 'No follow-up recorded'}</small></span></td>
            <td><div className="inline-status-wrap"><select aria-label={'Status for ' + account.name} className="inline-status" value={account.status} onClick={(event) => event.stopPropagation()} onChange={(event) => updateAccountStatus(account.id, event.target.value as AccountStatus)}>{accountStatuses.map((status) => <option key={status}>{status}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></div></td>
            <td><button className="row-arrow" aria-label={'Open ' + account.name} onClick={(event) => { event.stopPropagation(); openAccount(account.id) }}><ArrowRight size={15} /></button></td>
          </tr>
        })}
        {atRisk.length === 0 && <tr><td colSpan={10}><EmptyState title="No accounts match" text="Try a different search or clear your filters." /></td></tr>}
      </tbody></TableShell>
      <div className="risk-table-foot"><span>Risk levels are calculated from the latest detected mention.</span><span>Exposure: <strong>{money(riskExposure, true)}</strong> monthly</span></div>
    </div>
    <div className="risk-guidance"><div className="guidance-icon"><Sparkles size={17} /></div><div><strong>How risk is prioritized</strong><p>Critical (85–100), High (65–84), Medium (35–64), and Low (0–34). Accounts marked Resolved or Churned leave the active risk queue and update exposure across the workspace.</p></div></div>
  </>
}

function CompetitorsPage() {
  const { data } = useDemo()
  const { openAccount } = useUI()
  const [selected, setSelected] = useState<string | null>(null)
  const visibleRecords = data.records.filter((record) => record.reviewStatus !== 'Rejected')
  const insightRows = data.competitors.map((competitor) => {
    const records = visibleRecords.filter((record) => record.competitorId === competitor.id)
    const accounts = [...new Set(records.map((record) => record.accountId))]
    const atRisk = accounts.filter((id) => {
      const account = data.accounts.find((item) => item.id === id)!
      const latest = latestRecord(data.records, id)
      return latest && latest.score >= 35 && !['Resolved', 'Churned'].includes(account.status)
    })
    const exposure = atRisk.reduce((sum, id) => sum + (data.accounts.find((item) => item.id === id)?.monthlyRevenue || 0), 0)
    return { competitor, records, accounts, atRisk, exposure }
  })
  const selectedInsight = insightRows.find((item) => item.competitor.id === selected)
  const reasons = ['Lower pricing', 'Incentive offer', 'Perceived performance gap', 'Switching consideration'].map((reason) => ({ name: reason, count: visibleRecords.filter((record) => record.reason === reason).length }))
  const mentionChart = insightRows.map((item) => ({ name: item.competitor.name.replace(' Digital', '').replace(' Media', ''), mentions: item.records.length, color: item.competitor.accent }))
  const exposureChart = insightRows.map((item) => ({ name: item.competitor.name.replace(' Digital', '').replace(' Media', ''), exposure: item.exposure, color: item.competitor.accent }))
  const trend = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(Date.now() - (7 - index) * 7 * 86400000)
    const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
    const point: Record<string, string | number> = { week: label }
    data.competitors.forEach((competitor) => { point[competitor.name] = visibleRecords.filter((record) => record.competitorId === competitor.id && Math.abs(dayDistance(record.detectedAt) - (7 - index) * 7) <= 6).length })
    return point
  })
  return <>
    <SectionHeader title="Competitor insights" description="Understand who is entering customer conversations and what is making alternatives compelling." action={<span className="updated-label"><span className="live-dot" />{visibleRecords.length} tracked mentions</span>} />
    <div className="competitor-profile-grid">{insightRows.map(({ competitor, records, atRisk, exposure }) => <button key={competitor.id} className={'competitor-profile ' + (selected === competitor.id ? 'competitor-selected' : '')} onClick={() => setSelected(selected === competitor.id ? null : competitor.id)}>
      <div className="competitor-card-top"><span className="competitor-logo" style={{ color: competitor.accent, borderColor: competitor.accent + '35', background: competitor.accent + '0d' }}>{competitor.name.split(' ').map((part) => part[0]).join('')}</span><span className="card-menu"><MoreHorizontal size={18} /></span></div>
      <div className="competitor-name">{competitor.name}</div><p>{competitor.descriptor}</p>
      <div className="competitor-card-metrics"><div><strong>{records.length}</strong><small>Mentions</small></div><div><strong>{atRisk.length}</strong><small>At-risk accounts</small></div><div><strong>{money(exposure, true)}</strong><small>Revenue exposure</small></div></div>
      <div className="competitor-trend-mini"><span>Recent mentions</span><div>{Array.from({ length: 16 }, (_, index) => <i key={index} style={{ height: (7 + ((index * 13 + records.length * 2) % 17)) + 'px', background: competitor.accent + (index > 11 ? 'e6' : '55') }} />)}</div></div>
    </button>)}</div>
    <div className="chart-grid competitor-insight-charts">
      <div className="panel competitor-trend-panel"><PanelTitle title="Mention frequency" note="Competitor mentions across all customer calls" />
        <div className="chart-box chart-medium"><ResponsiveContainer width="100%" height="100%"><BarChart data={mentionChart} layout="vertical" margin={{ top: 7, right: 16, bottom: 0, left: 4 }}><CartesianGrid stroke="#dfe6ee" horizontal={false} /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#8997a8', fontSize: 11 }} /><YAxis type="category" dataKey="name" width={90} axisLine={false} tickLine={false} tick={{ fill: '#65778d', fontSize: 10 }} /><ChartTooltip contentStyle={{ border: '1px solid #dfe6ee', borderRadius: 10, fontSize: 13 }} /><Bar dataKey="mentions" name="Mentions" radius={[0, 5, 5, 0]} barSize={15}>{mentionChart.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer></div>
      </div>
      <div className="panel competitor-trend-panel"><PanelTitle title="Revenue exposure by competitor" note="Monthly revenue tied to active at-risk accounts" />
        <div className="chart-box chart-medium"><ResponsiveContainer width="100%" height="100%"><BarChart data={exposureChart} layout="vertical" margin={{ top: 7, right: 16, bottom: 0, left: 4 }}><CartesianGrid stroke="#dfe6ee" horizontal={false} /><XAxis type="number" tickFormatter={(value) => money(Number(value), true)} axisLine={false} tickLine={false} tick={{ fill: '#8997a8', fontSize: 10 }} /><YAxis type="category" dataKey="name" width={90} axisLine={false} tickLine={false} tick={{ fill: '#65778d', fontSize: 10 }} /><ChartTooltip formatter={(value) => money(Number(value))} contentStyle={{ border: '1px solid #dfe6ee', borderRadius: 10, fontSize: 13 }} /><Bar dataKey="exposure" name="Monthly exposure" radius={[0, 5, 5, 0]} barSize={15}>{exposureChart.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer></div>
      </div>
      <div className="panel competitor-trend-panel"><PanelTitle title="Competitor activity over time" note="Mention trend across the last eight weeks" />
        <div className="chart-box chart-medium"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}><CartesianGrid stroke="#dfe6ee" vertical={false} /><XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#8997a8', fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8997a8', fontSize: 11 }} /><ChartTooltip contentStyle={{ border: '1px solid #dfe6ee', borderRadius: 10, fontSize: 13 }} /><Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />{data.competitors.map((competitor) => <Line key={competitor.id} type="monotone" dataKey={competitor.name} stroke={competitor.accent} strokeWidth={2} dot={false} />)}</LineChart></ResponsiveContainer></div>
      </div>
      <div className="panel reasons-panel"><PanelTitle title="Why customers consider alternatives" note="Common themes across detected calls" />
        <div className="reason-bars">{reasons.map((item, index) => <div key={item.name} className="reason-row"><div><span>{item.name}</span><strong>{item.count}</strong></div><div className="reason-track"><i style={{ width: Math.max(5, item.count / Math.max(...reasons.map((reason) => reason.count), 1) * 100) + '%', background: ['#2b5dc8', '#397d98', '#ae7725', '#65778d'][index] }} /></div></div>)}</div>
      </div>
    </div>
    {selectedInsight && <div className="panel competitor-detail-panel">
      <div className="competitor-detail-header"><div><div className="eyebrow">COMPETITOR PROFILE</div><h2><span className="competitor-dot" style={{ background: selectedInsight.competitor.accent }} />{selectedInsight.competitor.name}</h2><p>{selectedInsight.competitor.descriptor} · {selectedInsight.records.length} visible mentions</p></div><button className="icon-button" aria-label="Close competitor profile" onClick={() => setSelected(null)}><X size={17} /></button></div>
      <div className="pattern-pills">{selectedInsight.competitor.incentives.map((item) => <span key={item}><Sparkles size={12} />{item}</span>)}</div>
      <PanelTitle title="Recent mentions" note="Select an account to inspect the full conversation details." />
      <TableShell><thead><tr><th>Account</th><th>Call context</th><th>Risk</th><th>Date detected</th><th>Review</th><th></th></tr></thead><tbody>
        {selectedInsight.records.slice(0, 8).map((record) => {
          const account = data.accounts.find((item) => item.id === record.accountId)!
          return <tr className="clickable-row" key={record.id} onClick={() => openAccount(account.id)}><td><AccountCell account={account} /></td><td className="context-cell">{record.reason}<small>{record.context}</small></td><td><RiskBadge score={record.score} /></td><td>{dateLabel(record.detectedAt)}</td><td><ReviewBadge status={record.reviewStatus} /></td><td><ArrowRight size={14} /></td></tr>
        })}
      </tbody></TableShell>
    </div>}
    <div className="panel competitor-records-panel"><PanelTitle title="Account-level mentions" note="Latest customer conversations containing a competitor mention" action={<Link className="text-button" to="/intelligence">Open full dashboard <ArrowRight size={13} /></Link>} />
      <TableShell><thead><tr><th>Account</th><th>Competitor</th><th>Reason</th><th>Monthly exposure</th><th>Risk</th><th>Date detected</th><th>Review status</th></tr></thead><tbody>
        {[...visibleRecords].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)).slice(0, 8).map((record) => {
          const account = data.accounts.find((item) => item.id === record.accountId)!
          const competitor = data.competitors.find((item) => item.id === record.competitorId)!
          return <tr className="clickable-row" key={record.id} onClick={() => openAccount(account.id)}><td><AccountCell account={account} /></td><td><span className="competitor-dot" style={{ background: competitor.accent }} />{competitor.name}</td><td>{record.reason}</td><td>{money(account.monthlyRevenue)}</td><td><RiskBadge score={record.score} /></td><td>{dateLabel(record.detectedAt)}</td><td><ReviewBadge status={record.reviewStatus} /></td></tr>
        })}
      </tbody></TableShell>
    </div>
  </>
}

function ReviewsPage() {
  const { data } = useDemo()
  const { openReview, openAccount } = useUI()
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState('All time')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [competitorFilter, setCompetitorFilter] = useState('All competitors')
  const [riskFilter, setRiskFilter] = useState('All risk levels')
  const [ownerFilter, setOwnerFilter] = useState('All account managers')
  const [reviewFilter, setReviewFilter] = useState('All review statuses')
  const [productFilter, setProductFilter] = useState('All products')
  function clearFilters() {
    setSearch('')
    setDateRange('All time')
    setStartDate('')
    setEndDate('')
    setCompetitorFilter('All competitors')
    setRiskFilter('All risk levels')
    setOwnerFilter('All account managers')
    setReviewFilter('All review statuses')
    setProductFilter('All products')
  }
  const forms = [...data.questionnaires].filter((form) => {
    const record = data.records.find((item) => item.id === form.recordId)
    const account = data.accounts.find((item) => item.id === form.accountId)
    const owner = data.managers.find((item) => item.id === form.ownerId)
    if (!record || !account || !owner) return false
    const competitor = data.competitors.find((item) => item.id === record.competitorId)
    if (!competitor) return false
    const term = search.trim().toLowerCase()
    return isWithinDateRange(form.detectedAt, dateRange, startDate, endDate) &&
      (!term || [account.name, competitor.name, record.context, owner.name].some((value) => value.toLowerCase().includes(term))) &&
      (competitorFilter === 'All competitors' || competitor.name === competitorFilter) &&
      (riskFilter === 'All risk levels' || scoreToRisk(record.score) === riskFilter) &&
      (ownerFilter === 'All account managers' || owner.name === ownerFilter) &&
      (reviewFilter === 'All review statuses' || form.status === reviewFilter) &&
      (productFilter === 'All products' || record.product === productFilter)
  }).sort((a, b) => {
    const statusOrder: Record<string, number> = { 'Pending Review': 0, 'Auto-Submitted': 1, Approved: 2, Rejected: 3 }
    if (a.status !== b.status) return (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4)
    if (a.status === 'Pending Review' && b.status === 'Pending Review') return new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime()
    return b.detectedAt.localeCompare(a.detectedAt)
  })
  const pending = forms.filter((form) => form.status === 'Pending Review')
  const approved = forms.filter((form) => form.status === 'Approved')
  const auto = forms.filter((form) => form.status === 'Auto-Submitted')
  const overdue = pending.filter((form) => new Date(form.deadlineAt).getTime() < Date.now())
  const activeFilterChips = [
    ...(competitorFilter !== 'All competitors' ? [{ label: 'Competitor', value: competitorFilter, clear: () => setCompetitorFilter('All competitors') }] : []),
    ...(riskFilter !== 'All risk levels' ? [{ label: 'Risk', value: riskFilter, clear: () => setRiskFilter('All risk levels') }] : []),
    ...(ownerFilter !== 'All account managers' ? [{ label: 'AM', value: ownerFilter, clear: () => setOwnerFilter('All account managers') }] : []),
    ...(reviewFilter !== 'All review statuses' ? [{ label: 'Review', value: reviewFilter, clear: () => setReviewFilter('All review statuses') }] : []),
    ...(productFilter !== 'All products' ? [{ label: 'Product', value: productFilter, clear: () => setProductFilter('All products') }] : []),
    ...(dateRange !== 'All time' ? [{ label: 'Date', value: dateRange === 'Custom date range' ? `${startDate || 'Start'} – ${endDate || 'End'}` : dateRange, clear: () => { setDateRange('All time'); setStartDate(''); setEndDate('') } }] : []),
  ]
  const activeFilters = [competitorFilter !== 'All competitors', riskFilter !== 'All risk levels', ownerFilter !== 'All account managers', reviewFilter !== 'All review statuses', productFilter !== 'All products', dateRange !== 'All time'].filter(Boolean).length
  return <>
    <SectionHeader title="AM review queue" description="Review and validate AI-detected competitive intelligence before it enters centralized reporting." action={<button className="button button-secondary" onClick={clearFilters}><RefreshCw size={14} />Clear filters</button>} />
    <div className="review-summary-grid"><ReviewSummary label="Awaiting review" value={pending.length} note="Needs an account manager" icon={Clock3} tone="amber" /><ReviewSummary label="Approved" value={approved.length} note="Verified and synchronized" icon={CheckCircle2} tone="green" /><ReviewSummary label="Auto-submitted" value={auto.length} note="Submitted after 3 days" icon={Zap} tone="pink" /><ReviewSummary label="Overdue" value={overdue.length} note="Deadline has passed" icon={ShieldAlert} tone="red" /></div>
    <div className="review-process-banner"><span className="process-icon"><Clock3 size={16} /></span><div><strong>Each form has a 3-day review window.</strong><p>If an AM doesn’t respond, original AI-detected details are automatically submitted and synced to the shared dashboard.</p></div><span className="process-deadline">AUTO-SUBMIT ENABLED</span></div>
    <div className="panel review-queue-panel">
      <div className="filter-toolbar">
        <div className="table-search"><Search size={15} /><input aria-label="Search AM review queue" placeholder="Search accounts, competitors, or call context..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <label className="filter-select"><CalendarDays size={14} /><select aria-label="Select review date range" value={dateRange} onChange={(event) => setDateRange(event.target.value)}>{['All time', ...DATE_RANGE_OPTIONS.filter((option) => option !== 'All time')].map((option) => <option key={option}>{option}</option>)}</select></label>
        {dateRange === 'Custom date range' && <div className="custom-date-range filter-custom-date-range"><label><span>From</span><input type="date" aria-label="Review queue start date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label><label><span>To</span><input type="date" aria-label="Review queue end date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label></div>}
        <label className="filter-select"><Filter size={14} /><select aria-label="Filter competitor" value={competitorFilter} onChange={(event) => setCompetitorFilter(event.target.value)}><option>All competitors</option>{data.competitors.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label className="filter-select"><select aria-label="Filter risk level" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}><option>All risk levels</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label>
        <label className="filter-select"><select aria-label="Filter account manager" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}><option>All account managers</option>{data.managers.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label className="filter-select"><select aria-label="Filter review status" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}><option>All review statuses</option><option>Pending Review</option><option>Approved</option><option>Auto-Submitted</option><option>Rejected</option></select></label>
        <label className="filter-select"><select aria-label="Filter product category" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option>All products</option>{Array.from(new Set(data.records.map((item) => item.product))).map((item) => <option key={item}>{item}</option>)}</select></label>
        {(activeFilters > 0 || search) && <button className="text-button clear-filters" onClick={clearFilters}>Clear all {activeFilters > 0 && <span>({activeFilters})</span>}<X size={13} /></button>}
      </div>
      {activeFilterChips.length > 0 && <div className="active-filter-chips" aria-label="Active filters">{activeFilterChips.map((chip) => <button className="filter-chip" key={chip.label} onClick={chip.clear} aria-label={'Remove ' + chip.label + ' filter'}><span>{chip.label}</span>{chip.value}<X size={12} /></button>)}</div>}
      <div className="table-heading"><div><h2>Forms <span className="table-count">{forms.length}</span></h2><span>Prefilled from a recorded customer conversation</span></div></div>
      <TableShell><thead><tr><th>Account</th><th>Account manager</th><th>Competitor</th><th>Date detected</th><th>Deadline</th><th>Time remaining</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {forms.map((form) => {
          const account = data.accounts.find((item) => item.id === form.accountId)!
          const record = data.records.find((item) => item.id === form.recordId)!
          const owner = data.managers.find((item) => item.id === form.ownerId)!
          const competitor = data.competitors.find((item) => item.id === record.competitorId)!
          const remaining = Math.max(0, new Date(form.deadlineAt).getTime() - Date.now())
          const days = Math.floor(remaining / 86400000)
          const hours = Math.floor(remaining % 86400000 / 3600000)
          return <tr key={form.id} className="clickable-row" onClick={() => openAccount(account.id)}>
            <td><AccountCell account={account} /></td><td><span className="table-owner"><Avatar name={owner.name} color="blue" />{owner.name}</span></td><td><span className="competitor-dot" style={{ background: competitor.accent }} />{competitor.name}</td>
            <td>{dateLabel(form.detectedAt)}</td><td>{dateLabel(form.deadlineAt, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td>{form.status === 'Pending Review' ? <span className={days === 0 ? 'time-left urgent' : 'time-left'}><Clock3 size={13} />{days}d {hours}h</span> : '—'}</td><td><ReviewBadge status={form.status} /></td>
            <td><button className={'button button-small ' + (form.status === 'Pending Review' || form.status === 'Auto-Submitted' ? 'button-primary' : 'button-secondary')} onClick={(event) => { event.stopPropagation(); openReview(form.id) }}>{form.status === 'Pending Review' || form.status === 'Auto-Submitted' ? 'Review' : 'View'}</button></td>
          </tr>
        })}
        {!forms.length && <tr><td colSpan={8}><EmptyState title="No forms here" text="New AI detections will appear in this queue." /></td></tr>}
      </tbody></TableShell>
      <div className="table-pagination"><span>Forms auto-submit if the three-day review window passes without an AM response.</span><span className="auto-submit-link"><Zap size={13} />Automatic sync enabled</span></div>
    </div>
  </>
}
function ReviewSummary({ label, value, note, icon: Icon, tone }: { label: string; value: number; note: string; icon: React.ElementType; tone: string }) {
  return <div className={'review-summary-card review-summary-' + tone}><div><span>{titleCase(label)}</span><span className="review-summary-icon"><Icon size={16} /></span></div><strong>{value}</strong><small>{note}</small></div>
}

function App() {
  return <Routes><Route element={<Shell />}>
    <Route path="/" element={<OverviewPage />} />
    <Route path="/intelligence" element={<IntelligencePage />} />
    <Route path="/accounts" element={<AtRiskPage />} />
    <Route path="/competitors" element={<CompetitorsPage />} />
    <Route path="/reviews" element={<ReviewsPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Route></Routes>
}
function NotFoundPage() {
  return <div className="not-found"><div className="empty-icon"><Search /></div><h1>Page not found</h1><p>This workspace route isn’t available.</p><Link className="button button-primary" to="/">Return to overview</Link></div>
}
export default App
