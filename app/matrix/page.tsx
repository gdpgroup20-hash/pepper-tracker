'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import PasswordGate, { checkAuth } from '../../components/PasswordGate'

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTH_COLS = [
  { label: "Sep", year: 2025, month: 9 },
  { label: "Oct", year: 2025, month: 10 },
  { label: "Nov", year: 2025, month: 11 },
  { label: "Dec", year: 2025, month: 12 },
  { label: "Jan", year: 2026, month: 1 },
  { label: "Feb", year: 2026, month: 2 },
  { label: "Mar", year: 2026, month: 3 },
  { label: "Apr", year: 2026, month: 4 },
  { label: "May", year: 2026, month: 5 },
  { label: "Jun", year: 2026, month: 6 },
  { label: "Jul", year: 2026, month: 7 },
  { label: "Aug", year: 2026, month: 8 },
  { label: "Sep", year: 2026, month: 9 },
  { label: "Oct", year: 2026, month: 10 },
  { label: "Nov", year: 2026, month: 11 },
  { label: "Dec", year: 2026, month: 12 },
]

const STATUSES = ["Not contacted", "Contacted - pending decision", "Verbal yes", "Signed"]

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
  launch_month: string // "YYYY-MM-DD" (full date, stored in launch_month column)
  status: string
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
  padding: 24, minWidth: 380, maxWidth: 500, width: '100%',
  maxHeight: '90vh', overflowY: 'auto',
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#27272a', border: '1px solid #3f3f46',
  borderRadius: 6, color: '#fafafa', padding: '8px 10px', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#a1a1aa', marginBottom: 4, display: 'block' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthValue(col: { year: number; month: number }): string {
  return `${col.year}-${String(col.month).padStart(2, '0')}-01`
}

function colKey(col: { year: number; month: number }): string {
  return `${col.year}-${col.month}`
}

function launchDateToColKey(launchDate: string): string {
  // handles both "YYYY-MM-01" and "YYYY-MM-DD"
  const d = new Date(launchDate + 'T00:00:00')
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

function isPast(launchDate: string): boolean {
  const d = new Date(launchDate + 'T00:00:00')
  const now = new Date()
  const firstOfCurrent = new Date(now.getFullYear(), now.getMonth(), 1)
  return d < firstOfCurrent
}

function tileLabel(campaign: Campaign): string {
  const d = new Date(campaign.launch_month + 'T00:00:00')
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]
  const day = d.getDate()
  return `${campaign.supplier} · ${mon} ${day}`
}

function launchDateLabel(launchDate: string): string {
  const d = new Date(launchDate + 'T00:00:00')
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

// Given a "YYYY-MM-DD" string, returns { monthStr: "YYYY-MM-01", day: 15 }
function parseLaunchDate(v: string): { monthStr: string; day: number } {
  const parts = v.split('-')
  const year = parseInt(parts[0])
  const month = parseInt(parts[1])
  const day = parseInt(parts[2])
  return {
    monthStr: `${year}-${String(month).padStart(2, '0')}-01`,
    day: isNaN(day) ? 1 : day,
  }
}

function buildLaunchDate(monthStr: string, day: number): string {
  const parts = monthStr.split('-')
  const year = parseInt(parts[0])
  const month = parseInt(parts[1])
  // clamp day to valid range
  const maxDay = new Date(year, month, 0).getDate()
  const clamped = Math.max(1, Math.min(day, maxDay))
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`
}

// ─── DatePicker Component ──────────────────────────────────────────────────

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { monthStr, day } = parseLaunchDate(value)

  function handleMonthChange(newMonthStr: string) {
    onChange(buildLaunchDate(newMonthStr, day))
  }

  function handleDayChange(e: React.ChangeEvent<HTMLInputElement>) {
    const d = parseInt(e.target.value)
    if (!isNaN(d)) onChange(buildLaunchDate(monthStr, d))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Month grid */}
      <div style={{ border: '1px solid #3f3f46', borderRadius: 8, padding: 12, background: '#1c1c1f' }}>
        <div style={{ fontSize: 10, color: '#71717a', marginBottom: 4 }}>2025</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {MONTH_COLS.filter(c => c.year === 2025).map(col => {
            const v = monthValue(col)
            const selected = monthStr === v
            return (
              <button key={v} type="button" onClick={() => handleMonthChange(v)} style={{
                padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                background: selected ? '#7c3aed' : '#27272a',
                color: selected ? '#fff' : '#a1a1aa',
                fontWeight: selected ? 600 : 400,
              }}>{col.label}</button>
            )
          })}
        </div>
        <div style={{ fontSize: 10, color: '#71717a', marginBottom: 4 }}>2026</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {MONTH_COLS.filter(c => c.year === 2026).map(col => {
            const v = monthValue(col)
            const selected = monthStr === v
            return (
              <button key={v} type="button" onClick={() => handleMonthChange(v)} style={{
                padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                background: selected ? '#7c3aed' : '#27272a',
                color: selected ? '#fff' : '#a1a1aa',
                fontWeight: selected ? 600 : 400,
              }}>{col.label}</button>
            )
          })}
        </div>
      </div>
      {/* Day selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ ...labelStyle, margin: 0, whiteSpace: 'nowrap' }}>Launch day</label>
        <input
          type="number"
          min={1}
          max={31}
          value={day}
          onChange={handleDayChange}
          style={{ ...inputStyle, width: 80 }}
        />
        <span style={{ fontSize: 12, color: '#71717a' }}>of the month</span>
      </div>
    </div>
  )
}

// ─── Matrix Component ────────────────────────────────────────────────────────

function Matrix() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  const now = new Date()
  const currentColKey = `${now.getFullYear()}-${now.getMonth() + 1}`

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
    // Preserve the day when dragging to a new month
    const { day } = parseLaunchDate(campaign.launch_month)
    e.dataTransfer.setData('campaignId', campaign.id)
    e.dataTransfer.setData('campaignDay', String(day))
    setDragId(campaign.id)
  }

  function handleDrop(e: React.DragEvent, distributor: string, col: { year: number; month: number }) {
    e.preventDefault()
    const campaignId = e.dataTransfer.getData('campaignId')
    const dayStr = e.dataTransfer.getData('campaignDay')
    if (!campaignId) return
    const day = parseInt(dayStr) || 1
    const newDate = buildLaunchDate(monthValue(col), day)
    updateCampaign(campaignId, { distributor, launch_month: newDate })
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
    const ck = launchDateToColKey(c.launch_month)
    const key = `${c.distributor}::${ck}`
    const arr = campaignMap.get(key) || []
    arr.push(c)
    campaignMap.set(key, arr)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', background: '#0f0f10', color: '#fafafa' }}>

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
              {MONTH_COLS.map(col => {
                const ck = colKey(col)
                const isCurrent = ck === currentColKey
                return (
                  <th key={ck} style={{
                    width: 120, minWidth: 120, padding: 8, textAlign: 'center',
                    fontSize: 12, fontWeight: 600,
                    background: isCurrent ? '#1e1e22' : '#18181b',
                    color: isCurrent ? '#a78bfa' : '#a1a1aa',
                    borderBottom: '1px solid #27272a', borderRight: '1px solid #1a1a1c',
                  }}>
                    {col.label} {col.year}
                  </th>
                )
              })}
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
                {MONTH_COLS.map(col => {
                  const ck = colKey(col)
                  const cellCampaigns = campaignMap.get(`${dist}::${ck}`) || []
                  const isCurrent = ck === currentColKey
                  return (
                    <td
                      key={ck}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, dist, col)}
                      style={{
                        verticalAlign: 'top', padding: 4,
                        borderBottom: '1px solid #1a1a1c', borderRight: '1px solid #1a1a1c',
                        minHeight: 40, width: 120,
                        background: isCurrent ? '#0d0d12' : (ri % 2 === 0 ? '#0f0f10' : '#111113'),
                      }}
                    >
                      {cellCampaigns.map(camp => {
                        const colors = SUPPLIER_COLORS[camp.supplier] || { bg: '#27272a', border: '#52525b', text: '#a1a1aa' }
                        const past = isPast(camp.launch_month)
                        let tileBorder = `1px solid ${colors.border}33`
                        if (camp.status === 'Signed') tileBorder = `2px solid ${colors.border}`
                        else if (camp.status === 'Verbal yes') tileBorder = `1px solid ${colors.border}`
                        return (
                          <div
                            key={camp.id}
                            style={{
                              background: colors.bg,
                              border: tileBorder,
                              borderRadius: 4, padding: '3px 6px', marginBottom: 2,
                              fontSize: 11, color: colors.text,
                              cursor: 'pointer',
                              opacity: past ? 0.5 : 1,
                              userSelect: 'none',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}
                            onClick={() => setDetailCampaign(camp)}
                            draggable
                            onDragStart={(e) => handleDragStart(e, camp)}
                            onDragEnd={handleDragEnd}
                          >
                            {tileLabel(camp)}
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
          onUpdate={async (id, patch) => {
            await updateCampaign(id, patch)
            setDetailCampaign(prev => prev ? { ...prev, ...patch } : null)
          }}
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
  const [launchDate, setLaunchDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [status, setStatus] = useState('Not contacted')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const skus = skusInput.split(',').map(s => s.trim()).filter(Boolean)
    await onCreate({ distributor, supplier, skus, launch_month: launchDate, status })
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
            <label style={labelStyle}>Launch Date</label>
            <DatePicker value={launchDate} onChange={setLaunchDate} />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
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
  const [status, setStatus] = useState(campaign.status)
  const [launchDate, setLaunchDate] = useState(campaign.launch_month)
  const [skusInput, setSkusInput] = useState((campaign.skus || []).join(', '))
  const [saving, setSaving] = useState(false)
  const colors = SUPPLIER_COLORS[campaign.supplier] || { bg: '#27272a', border: '#52525b', text: '#a1a1aa' }

  async function handleSave() {
    setSaving(true)
    const skus = skusInput.split(',').map(s => s.trim()).filter(Boolean)
    await onUpdate(campaign.id, { status, launch_month: launchDate, skus })
    setSaving(false)
  }

  async function handleDelete() {
    await onDelete(campaign.id)
    onClose()
  }

  const hasChanges =
    status !== campaign.status ||
    launchDate !== campaign.launch_month ||
    skusInput !== (campaign.skus || []).join(', ')

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Campaign</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#71717a', fontSize: 18, cursor: 'pointer',
          }}>
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Supplier badge (read-only) */}
          <div>
            <div style={labelStyle}>Supplier</div>
            <div style={{
              display: 'inline-block', background: colors.bg, border: `1px solid ${colors.border}`,
              borderRadius: 4, padding: '4px 10px', fontSize: 13, color: colors.text,
            }}>
              {campaign.supplier}
            </div>
          </div>

          {/* Distributor (read-only) */}
          <div>
            <div style={labelStyle}>Distributor</div>
            <div style={{ fontSize: 14, color: '#fafafa' }}>{campaign.distributor}</div>
          </div>

          {/* Launch Date — editable */}
          <div>
            <label style={labelStyle}>Launch Date</label>
            <DatePicker value={launchDate} onChange={setLaunchDate} />
          </div>

          {/* SKUs — editable */}
          <div>
            <label style={labelStyle}>SKUs (comma-separated)</label>
            <input
              style={inputStyle}
              value={skusInput}
              onChange={e => setSkusInput(e.target.value)}
              placeholder="e.g. SKU-001, SKU-002"
            />
          </div>

          {/* Status — editable */}
          <div>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            style={{
              flex: 1, padding: '8px 14px',
              background: hasChanges ? '#7c3aed' : '#27272a',
              color: hasChanges ? '#fff' : '#71717a',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: hasChanges ? 'pointer' : 'default',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
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
