import type { Account, AccountManager, AppData, Competitor, IntelligenceRecord, Questionnaire } from './types'

export const managers: AccountManager[] = [
  { id: 'am-1', name: 'Alex Morgan', initials: 'AM', role: 'Senior account manager' },
  { id: 'am-2', name: 'Jordan Lee', initials: 'JL', role: 'Account manager' },
  { id: 'am-3', name: 'Taylor Brooks', initials: 'TB', role: 'Strategic account manager' },
  { id: 'am-4', name: 'Casey Rivera', initials: 'CR', role: 'Account manager' },
  { id: 'am-5', name: 'Morgan Ellis', initials: 'ME', role: 'Strategic account manager' },
  { id: 'am-6', name: 'Jamie Chen', initials: 'JC', role: 'Account manager' },
  { id: 'am-7', name: 'Riley Parker', initials: 'RP', role: 'Account manager' },
  { id: 'am-8', name: 'Sam Bennett', initials: 'SB', role: 'Senior account manager' },
]

export const competitors: Competitor[] = [
  { id: 'apex', name: 'Apex Digital', accent: '#2b5dc8', descriptor: 'Performance media network', incentives: ['Lower platform pricing', 'Waived setup fee', 'Flexible contract terms'] },
  { id: 'northstar', name: 'Northstar Media', accent: '#397d98', descriptor: 'Commerce media platform', incentives: ['Performance bonus', 'Quarterly media credit', 'Volume-based incentive'] },
  { id: 'velocity', name: 'Velocity Ads', accent: '#ae7725', descriptor: 'Performance advertising platform', incentives: ['Incrementality guarantee', 'Priority optimization', 'No minimum spend'] },
  { id: 'brightreach', name: 'BrightReach', accent: '#65778d', descriptor: 'Retail media network', incentives: ['Audience extension', 'Dedicated strategy support', 'Pilot credit'] },
]

const names = [
  'Meridian Commerce', 'BluePeak Retail', 'Everwell Brands', 'NovaMarket', 'Summit Digital', 'Atlas Living', 'Harbor & Co.', 'Vertex Retail', 'Bloom Collective', 'Cedarstone Group', 'Juniper House', 'Northline Market', 'Fieldstone Outfitters', 'Luma Goods', 'Westbay Supply', 'Hearth & Harbor', 'Solstice Commerce', 'Orchard & Oak', 'Pine & Parcel', 'Daybreak Home', 'Kindred Supply', 'Morrow Market', 'Copperline Goods', 'Willow & Wild', 'Maple Street Co.'
]
const industries = ['Home & lifestyle', 'Apparel', 'Health & wellness', 'Specialty retail', 'Consumer goods']
const products = ['Performance Media', 'Commerce Media', 'Audience Insights', 'Post-purchase Growth']
const revenues = [125000, 108000, 96000, 92000, 88000, 84000, 80000, 76000, 74000, 72000, 68000, 66000, 64000, 62000, 60000, 58000, 56000, 91000]
const riskScores = [96, 92, 89, 86, 83, 80, 77, 74, 72, 70, 67, 63, 58, 55, 51, 48, 42, 36]
const statusByRisk = ['New Risk', 'Under Review', 'Action in Progress', 'Monitoring'] as const

const transcriptByCompetitor: Record<string, string[]> = {
  apex: [
    'We have had a conversation with Apex Digital. They came in about 18% below our current rate and offered to cover the migration work. We are not committed to a change, but the price is difficult to ignore.',
    'Apex Digital reached out last week with a lower platform fee. Before we renew, we need to understand what we would gain by staying with the current approach.',
    'The offer from Apex included a reduced rate for the first two quarters. Performance is still our main concern, but the commercial difference is meaningful.',
  ],
  northstar: [
    'Northstar Media is offering a quarterly performance bonus if we hit the new volume threshold. It is a thoughtful proposal, and our finance team wants to compare the full-year economics.',
    'They mentioned an incentive tied to incremental conversions. We would like to see how that compares with our current results before making any decisions.',
    'Northstar has offered a media credit for the next quarter. The team is interested, though we have not discussed a transition plan.',
  ],
  velocity: [
    'Velocity Ads says they can improve return on spend with a different optimization model. We are not sure yet, but we would like to see a side-by-side performance review.',
    'Our team has been approached by Velocity Ads. The pitch was mostly about faster learning and better conversion performance, rather than price.',
    'We have seen a case study from Velocity and are evaluating whether their approach could improve our results next quarter.',
  ],
  brightreach: [
    'BrightReach proposed an audience extension pilot with dedicated strategy support. It could help us reach a new segment, but we want to understand the overlap with our current program.',
    'They offered a pilot credit and an expanded audience package. We have not decided to switch; we are gathering options for our next planning cycle.',
    'BrightReach is positioning its strategy support as a differentiator. We want to know whether similar support can be added to our current plan.',
  ],
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString()
}

function riskLevel(score: number): string {
  return score >= 85 ? 'Critical' : score >= 65 ? 'High' : score >= 35 ? 'Medium' : 'Low'
}

function makeAccounts(): Account[] {
  return Array.from({ length: 248 }, (_, index) => {
    const atRisk = index < 18
    const manager = managers[index % managers.length]
    const score = atRisk ? riskScores[index] : 12 + ((index * 17) % 22)
    return {
      id: 'acct-' + String(index + 1).padStart(3, '0'),
      name: names[index] || ['Alder & Ash', 'Bluebird Market', 'Mason Row', 'Rosewood Supply', 'Tandem Goods'][index % 5] + ' ' + (index > 24 ? String(index - 19) : ''),
      industry: industries[index % industries.length],
      ownerId: manager.id,
      monthlyRevenue: atRisk ? revenues[index] : 8000 + ((index * 7919) % 34000),
      health: atRisk ? 100 - score : 72 + ((index * 11) % 27),
      status: atRisk ? statusByRisk[index % statusByRisk.length] : 'Healthy',
      product: products[index % products.length],
      usage: atRisk ? (68 + (index * 3) % 29) + '% of contracted volume' : (78 + (index * 7) % 22) + '% of contracted volume',
      region: ['North America', 'EMEA', 'APAC'][index % 3],
    }
  })
}

function makeRecords(accounts: Account[]): IntelligenceRecord[] {
  const competitorCycle = [
    ...Array.from({ length: 21 }, () => 'apex'),
    ...Array.from({ length: 18 }, () => 'northstar'),
    ...Array.from({ length: 14 }, () => 'velocity'),
    ...Array.from({ length: 11 }, () => 'brightreach'),
  ]
  return competitorCycle.map((competitorId, index) => {
    const accountIndex = index % 18
    const account = accounts[accountIndex]
    const occurrence = Math.floor(index / 18)
    const excerpt = transcriptByCompetitor[competitorId][(accountIndex + occurrence) % 3]
    const isPending = index < 7
    const detected = isPending ? daysAgo(index < 3 ? 2 : index % 2) : daysAgo((index * 3 + 2) % 87)
    const score = riskScores[accountIndex]
    const status = index < 7 ? 'Pending Review' : index < 12 ? 'Approved' : 'Auto-Submitted'
    return {
      id: 'intel-' + String(index + 1).padStart(3, '0'),
      accountId: account.id,
      competitorId,
      context: excerpt,
      score,
      detectedAt: detected,
      callDate: detected,
      reason: ['Lower pricing', 'Incentive offer', 'Perceived performance gap', 'Switching consideration'][index % 4],
      offer: competitors.find((item) => item.id === competitorId)!.incentives[(index + accountIndex) % 3],
      sentiment: ['Concerned', 'Interested', 'Evaluating', 'Neutral'][index % 4],
      churnLikelihood: Math.min(95, score - 4 + (index % 3)),
      summary: 'The client is evaluating a competitor option and requested a clearer comparison of commercial value and expected outcomes.',
      transcript: excerpt,
      confidence: 86 + ((index * 7) % 13),
      product: account.product,
      reviewStatus: status,
      verified: status === 'Approved',
    }
  })
}

export function makeQuestionnaires(records: IntelligenceRecord[], accounts: Account[]): Questionnaire[] {
  return records.map((record, index) => {
    const account = accounts.find((item) => item.id === record.accountId)!
    const status = record.reviewStatus
    const detectedAt = record.detectedAt
    return {
      id: 'form-' + String(index + 1).padStart(3, '0'),
      recordId: record.id,
      accountId: record.accountId,
      ownerId: account.ownerId,
      detectedAt,
      deadlineAt: new Date(new Date(detectedAt).getTime() + 3 * 86400000).toISOString(),
      status,
      accurate: status === 'Approved' ? 'Yes' : '',
      switching: status === 'Approved' ? 'Unsure' : '',
      offer: record.offer,
      context: status === 'Approved' ? 'Discussed during renewal planning; validate economics with the customer.' : '',
      nextAction: status === 'Approved' ? 'Schedule a competitive value review' : '',
      priority: record.score >= 85 ? 'Critical' : record.score >= 65 ? 'High' : 'Medium',
    }
  })
}

export function createSeedData(): AppData {
  const accounts = makeAccounts()
  const records = makeRecords(accounts)
  const questionnaires = makeQuestionnaires(records, accounts)
  const activities = Array.from({ length: 36 }, (_, index) => {
    const record = records[index % records.length]
    const account = accounts.find((item) => item.id === record.accountId)!
    const actions = [
      ['AI detected a competitor mention', 'A transcript mention was flagged for AM review.', 'detection'],
      ['Form approved', 'Competitive details were verified and synced.', 'review'],
      ['Account moved to high risk', 'A new offer changed the account risk assessment.', 'risk'],
      ['Form automatically submitted', 'The three-day review window expired.', 'status'],
      ['Account status updated', 'A retention action was recorded.', 'status'],
    ] as const
    const [title, detail, kind] = actions[index % actions.length]
    return { id: 'activity-' + index, title, detail, kind, date: daysAgo(index * 4 / 24), accountId: account.id, recordId: record.id }
  })
  return {
    accounts,
    managers,
    competitors,
    records,
    questionnaires,
    activities,
    notices: [
      { id: 'notice-1', text: '7 forms are waiting for AM review.', date: daysAgo(0), read: false },
      { id: 'notice-2', text: 'Meridian Commerce is now classified as critical risk.', date: daysAgo(1), read: false },
      { id: 'notice-3', text: 'A new competitor pattern was added to the dashboard.', date: daysAgo(2), read: true },
    ],
  }
}

export function scoreToRisk(score: number): 'Critical' | 'High' | 'Medium' | 'Low' {
  return riskLevel(score) as 'Critical' | 'High' | 'Medium' | 'Low'
}
