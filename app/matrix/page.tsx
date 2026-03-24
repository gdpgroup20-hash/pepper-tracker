'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import PasswordGate, { checkAuth } from '../../components/PasswordGate'

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const CURRENT_YEAR = 2026
const CURRENT_MONTH = new Date().getMonth() // 0-indexed

const SUPPLIERS = ["Pilgrim's", "Essity", "Aspire Bakeries", "Kettle Cuisine", "Kerry", "Branding Iron", "J.M. Smucker"]

const SUPPLIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "Pilgrim's":       { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  'Essity':          { bg: '#134e4a', border: '#14b8a6', text: '#99f6e4' },
  'Aspire Bakeries': { bg: '#431407', border: '#f97316', text: '#fdba74' },
  'Kettle Cuisine':  { bg: '#450a0a', border: '#ef4444', text: '#fca5a5' },
  'Kerry':           { bg: '#2e1065', border: '#a855f7', text: '#d8b4fe' },
  'Branding Iron':   { bg: '#451a03', border: '#f59e0b', text: '#fde68a' },
  'J.M. Smucker':    { bg: '#052e16', border: '#22c55e', text: '#86efac' },
}

const DISTRIBUTORS = [
  'A.F. Wendling', "Aldo's Foodservice", 'Atlantic Distributors Inc', 'Atlantic Food Distributors',
  'Badger Foodservice', 'Bermuda General Agency', 'Brown Foodservice', 'Cable Meats',
  'Carolina Food Service', 'Cash-Wa', 'Colony Foods', 'Cotati Foodservice', 'Custom Food Service',
  'Flanagan Foodservice - Division 1', 'Flanagan Foodservice - Division 3', 'Flanagan Foodservice - Division 4',
  'Food Supply Inc', "Ginsberg's Foods", 'Graves Foods', 'Halsey', 'Henrys Foods - Alexandria',
  "Jordano's Foodservice", 'Kaleel Brothers', 'Kast Distributors', 'Kohl Wholesale',
  'Kuna Foodservice - Dupo', 'Latina Boulevard Foods', 'Layman Distributing', 'Marathon Foodservice',
  'Maximum Quality Foods - Division 1', 'McDonald Wholesale', 'Merchants Grocery', 'Merit Foods',
  'Merrill', 'MJ Kellner', 'Palmer Food Services', 'Perrone & Sons', 'RDP Foodservice',
  'RightWay Food Service', 'S&W Wholesale', 'Schenck Foods Co', "Schiff's Food Service",
  'Seashore Food Distributors', 'Sofo Foods Department 1 - Ohio', 'Sofo Foods Department 7 - Georgia',
  'Tankersley Foodservice', 'Tapia Brothers - Fresno', 'Tapia Brothers - Las Vegas',
  'Tapia Brothers - Maywood', 'Tapia Brothers - Phoenix', 'Thomsen Foodservice',
  'TPC Food Service', 'Victory Foodservice', 'Wilkens Foodservice', 'Wood Fruitticher',
]

// ─── Types ───────────────────────────────────────────────────────────────────

interface Campaign {
  id: string
  distributor: string
  supplier: string
  skus: string[]
  launch_month: string // "2026-MM-01"
  locked: boolean
  created_at?: string
  updated_at?: string
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
}
const modalBox: React.CSSProperties = {
  background: '#18181b', border: '1px solid #27272a', borderRadius: 12,
  padding: 24, minWidth: 360, maxWidth: 480, width: '100%',
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#27272a', border: '1px solid #3f3f46',
  borderRadius: 6, color: '#fafafa', padding: '8px 10px', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#a1a1aa', marginBottom: 4, display: 'block' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthIndex(launchMonth: string): number {
  return new Date(launchMonth + 'T00:00:00').getMonth()
}

function isPast(launchMonth: string): boolean {
  const d = new Date(launchMonth + 'T00:00:00')
  const firstOfCurrent = new Date(CURRENT_YEAR, CURRENT_MONTH, 1)
  return d < firstOfCurrent
}

function monthValue(mi: number): string {
  return `${CURRENT_YEAR}-${String(mi + 1).padStart(2, '0')}-01`
}

// ─── Matrix Component ────────────────────────────────────────────────────────

function Matrix() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  // ─── Supabase CRUD ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!supabase) return
    supabase.from('campaigns').select('*').then(({ data }) => {
      if (data) setCampaigns(data)
    })

    const channel = supabase.channel('campaigns-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaigns' }, (payload) => {
        setCampaigns(prev => {
          if (prev.some(c => c.id === (payload.new as Campaign).id)) return prev
          return [...prev, payload.new as Campaign]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns' }, (payload) => {
        setCampaigns(prev => prev.map(c => c.id === (payload.new as Campaign).id ? payload.new as Campaign : c))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'campaigns' }, (payload) => {
        setCampaigns(prev => prev.filter(c => c.id !== (payload.old as { id: string }).id))
      })
      .subscribe()

    return () => { supabase!.removeChannel(channel) }
  }, [])

  const createCampaign = useCallback(async (c: Omit<Campaign, 'id'>) => {
    if (!supabase) return
    const { data } = await supabase.from('campaigns').insert(c).select().single()
    if (data) setCampaigns(prev => [...prev, data])
  }, [])

  const updateCampaign = useCallback(async (id: string, patch: Partial<Campaign>) => {
    if (!supabase) return
    await supabase.from('campaigns').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }, [])

  const deleteCampaign = useCallback(async (id: string) => {
    if (!supabase) return
    await supabase.from('campaigns').delete().eq('id', id)
    setCampaigns(prev => prev.filter(c => c.id !== id))
  }, [])

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, campaign: Campaign) {
    e.dataTransfer.setData('campaignId', campaign.id)
    setDragId(campaign.id)
  }

  function handleDrop(e: React.DragEvent, distributor: string, mi: number) {
    e.preventDefault()
    const campaignId = e.dataTransfer.getData('campaignId')
    if (!campaignId) return
    if (isPast(monthValue(mi))) return
    updateCampaign(campaignId, { distributor, launch_month: monthValue(mi) })
    setDragId(null)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function handleDragEnd() {
    setDragId(null)
  }

  // ─── Build campaign lookup ─────────────────────────────────────────────────

  const campaignMap = new Map<string, Campaign[]>()
  for (const c of campaigns) {
    const mi = monthIndex(c.launch_month)
    const key = `${c.distributor}::${mi}`
    const arr = campaignMap.get(key) || []
    arr.push(c)
    campaignMap.set(key, arr)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f10', color: '#fafafa' }}>

      {/* Top bar */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid #27272a', background: '#18181b',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Campaign Matrix</h2>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', background: '#7c3aed', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 2v12M2 8h12" />
          </svg>
          Add Campaign
        </button>
      </div>

      {/* Supplier legend */}
      <div style={{ padding: '8px 24px', borderBottom: '1px solid #27272a', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {SUPPLIERS.map(s => {
          const c = SUPPLIER_COLORS[s]
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c.border }} />
              <span style={{ color: '#a1a1aa' }}>{s}</span>
            </div>
          )
        })}
      </div>

      {/* Scrollable matrix */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
            <tr>
              <th style={{
                position: 'sticky', left: 0, zIndex: 30, width: 200, minWidth: 200,
                background: '#18181b', borderBottom: '1px solid #27272a', borderRight: '1px solid #27272a',
                padding: '8px 12px', fontSize: 12, fontWeight: 600, textAlign: 'left', color: '#a1a1aa',
              }}>
                Distributor
              </th>
              {MONTHS.map((m, i) => (
                <th key={m} style={{
                  width: 120, minWidth: 120, padding: 8, textAlign: 'center',
                  fontSize: 12, fontWeight: 600,
                  background: i === CURRENT_MONTH ? '#1e1e22' : '#18181b',
                  color: i === CURRENT_MONTH ? '#a78bfa' : '#a1a1aa',
                  borderBottom: '1px solid #27272a', borderRight: '1px solid #1a1a1c',
                }}>
                  {m} {CURRENT_YEAR}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DISTRIBUTORS.map((dist, ri) => (
              <tr key={dist}>
                <td style={{
                  position: 'sticky', left: 0, zIndex: 10, width: 200,
                  background: '#18181b', borderRight: '1px solid #27272a',
                  padding: '8px 12px', fontSize: 12, color: '#a1a1aa',
                  borderBottom: '1px solid #1a1a1c',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {dist}
                </td>
                {MONTHS.map((_, mi) => {
                  const cellCampaigns = campaignMap.get(`${dist}::${mi}`) || []
                  const isCurrentMonth = mi === CURRENT_MONTH
                  const cellPast = isPast(monthValue(mi))
                  return (
                    <td
                      key={mi}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, dist, mi)}
                      style={{
                        verticalAlign: 'top', padding: 4,
                        borderBottom: '1px solid #1a1a1c', borderRight: '1px solid #1a1a1c',
                        minHeight: 40, width: 120,
                        background: isCurrentMonth ? '#0d0d12' : (ri % 2 === 0 ? '#0f0f10' : '#111113'),
                      }}
                    >
                      {cellCampaigns.map(camp => {
                        const colors = SUPPLIER_COLORS[camp.supplier] || { bg: '#27272a', border: '#52525b', text: '#a1a1aa' }
                        const past = isPast(camp.launch_month)
                        return (
                          <div
                            key={camp.id}
                            style={{
                              background: colors.bg,
                              border: camp.locked ? `2px solid ${colors.border}` : 'none',
                              borderRadius: 4, padding: '3px 6px', marginBottom: 2,
                              fontSize: 11, color: colors.text,
                              cursor: past ? 'default' : 'pointer',
                              opacity: past ? 0.4 : 1,
                              userSelect: 'none',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}
                            onClick={() => !past && setDetailCampaign(camp)}
                            draggable={!past}
                            onDragStart={(e) => handleDragStart(e, camp)}
                            onDragEnd={handleDragEnd}
                          >
                            {camp.supplier}
                          </div>
                        )
                      })}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreate && <CreateModal onCreate={createCampaign} onClose={() => setShowCreate(false)} />}

      {/* Detail Modal */}
      {detailCampaign && (
        <DetailModal
          campaign={detailCampaign}
          onUpdate={updateCampaign}
          onDelete={deleteCampaign}
          onClose={() => setDetailCampaign(null)}
        />
      )}
    </div>
  )
}

// ─── Create Modal ────────────────────────────────────────────────────────────

function CreateModal({ onCreate, onClose }: {
  onCreate: (c: Omit<Campaign, 'id'>) => Promise<void>
  onClose: () => void
}) {
  const [distributor, setDistributor] = useState(DISTRIBUTORS[0])
  const [supplier, setSupplier] = useState(SUPPLIERS[0])
  const [skusInput, setSkusInput] = useState('')
  const [launchMonth, setLaunchMonth] = useState(() => monthValue(CURRENT_MONTH))
  const [locked, setLocked] = useState(false)
  const [saving, setSaving] = useState(false)

  const futureMonths = MONTHS.map((m, i) => ({ label: `${MONTH_LABELS[i]} ${CURRENT_YEAR}`, value: monthValue(i), past: isPast(monthValue(i)) }))
    .filter(m => !m.past)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const skus = skusInput.split(',').map(s => s.trim()).filter(Boolean)
    await onCreate({ distributor, supplier, skus, launch_month: launchMonth, locked })
    setSaving(false)
    onClose()
  }

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>New Campaign</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Distributor</label>
            <select style={inputStyle} value={distributor} onChange={e => setDistributor(e.target.value)}>
              {DISTRIBUTORS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Supplier</label>
            <select style={inputStyle} value={supplier} onChange={e => setSupplier(e.target.value)}>
              {SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>SKUs (comma-separated)</label>
            <input style={inputStyle} value={skusInput} onChange={e => setSkusInput(e.target.value)} placeholder="e.g. SKU-001, SKU-002" />
          </div>
          <div>
            <label style={labelStyle}>Launch Month</label>
            <select style={inputStyle} value={launchMonth} onChange={e => setLaunchMonth(e.target.value)}>
              {futureMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={locked} onChange={e => setLocked(e.target.checked)} id="locked-check" />
            <label htmlFor="locked-check" style={{ fontSize: 13, color: '#a1a1aa', cursor: 'pointer' }}>Locked</label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" disabled={saving} style={{
              flex: 1, padding: '8px 14px', background: '#7c3aed', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
            }}>
              {saving ? 'Saving...' : 'Create Campaign'}
            </button>
            <button type="button" onClick={onClose} style={{
              padding: '8px 14px', background: '#27272a', color: '#a1a1aa',
              border: '1px solid #3f3f46', borderRadius: 6, fontSize: 13, cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Detail / Edit Modal ─────────────────────────────────────────────────────

function DetailModal({ campaign, onUpdate, onDelete, onClose }: {
  campaign: Campaign
  onUpdate: (id: string, patch: Partial<Campaign>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const past = isPast(campaign.launch_month)
  const colors = SUPPLIER_COLORS[campaign.supplier] || { bg: '#27272a', border: '#52525b', text: '#a1a1aa' }
  const mi = monthIndex(campaign.launch_month)

  async function handleToggleLock() {
    await onUpdate(campaign.id, { locked: !campaign.locked })
    onClose()
  }

  async function handleDelete() {
    await onDelete(campaign.id)
    onClose()
  }

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Campaign Details</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#71717a', fontSize: 18, cursor: 'pointer',
          }}>
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={labelStyle}>Supplier</div>
            <div style={{
              display: 'inline-block', background: colors.bg, border: `1px solid ${colors.border}`,
              borderRadius: 4, padding: '4px 10px', fontSize: 13, color: colors.text,
            }}>
              {campaign.supplier}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Distributor</div>
            <div style={{ fontSize: 14, color: '#fafafa' }}>{campaign.distributor}</div>
          </div>
          <div>
            <div style={labelStyle}>Launch Month</div>
            <div style={{ fontSize: 14, color: '#fafafa' }}>{MONTH_LABELS[mi]} {CURRENT_YEAR}</div>
          </div>
          <div>
            <div style={labelStyle}>SKUs</div>
            <div style={{ fontSize: 14, color: '#fafafa' }}>
              {campaign.skus && campaign.skus.length > 0 ? campaign.skus.join(', ') : '—'}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Status</div>
            <div style={{ fontSize: 14, color: '#fafafa' }}>
              {campaign.locked ? 'Locked' : 'Unlocked'}{past ? ' (Past)' : ''}
            </div>
          </div>
        </div>

        {!past && (
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={handleToggleLock} style={{
              flex: 1, padding: '8px 14px',
              background: campaign.locked ? '#27272a' : '#7c3aed',
              color: campaign.locked ? '#a1a1aa' : '#fff',
              border: campaign.locked ? '1px solid #3f3f46' : 'none',
              borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              {campaign.locked ? 'Unlock' : 'Lock'}
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} style={{
                padding: '8px 14px', background: '#450a0a', color: '#fca5a5',
                border: '1px solid #ef4444', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              }}>
                Delete
              </button>
            ) : (
              <button onClick={handleDelete} style={{
                padding: '8px 14px', background: '#ef4444', color: '#fff',
                border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Confirm Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function MatrixPage() {
  const [unlocked, setUnlocked] = useState(() => checkAuth())

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />

  return <Matrix />
}
