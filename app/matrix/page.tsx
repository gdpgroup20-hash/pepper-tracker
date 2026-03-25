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

const STATUSES = ["Not contacted", "Contacted - pending decision", "Verbal yes", "Signed", "Rejected"]

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

interface Supplier {
  id: string
  name: string
  color_bg: string
  color_border: string
  color_text: string
  skus: string[]
}

interface Campaign {
  id: string
  distributor: string
  supplier: string
  skus: string[]
  launch_month: string // "YYYY-MM-DD" or "queue"
  status: string
  notes?: string
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
  if (launchDate === 'queue') return 'queue'
  // handles both "YYYY-MM-01" and "YYYY-MM-DD"
  const d = new Date(launchDate + 'T00:00:00')
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

function isPast(launchDate: string): boolean {
  if (launchDate === 'queue') return false
  const d = new Date(launchDate + 'T00:00:00')
  const now = new Date()
  const firstOfCurrent = new Date(now.getFullYear(), now.getMonth(), 1)
  return d < firstOfCurrent
}

function tileLabel(campaign: Campaign): string {
  if (campaign.launch_month === 'queue') return `${campaign.supplier} · Queue`
  const d = new Date(campaign.launch_month + 'T00:00:00')
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]
  const day = d.getDate()
  return `${campaign.supplier} · ${mon} ${day}`
}

function launchDateLabel(launchDate: string): string {
  if (launchDate === 'queue') return 'Queue'
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

function getSupplierColors(suppliers: Supplier[], name: string) {
  const s = suppliers.find(s => s.name === name)
  return s ? { bg: s.color_bg, border: s.color_border, text: s.color_text } : { bg: '#27272a', border: '#52525b', text: '#a1a1aa' }
}

// ─── Color Presets ────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd', label: 'Blue' },
  { bg: '#134e4a', border: '#14b8a6', text: '#99f6e4', label: 'Teal' },
  { bg: '#431407', border: '#f97316', text: '#fdba74', label: 'Orange' },
  { bg: '#450a0a', border: '#ef4444', text: '#fca5a5', label: 'Red' },
  { bg: '#2e1065', border: '#a855f7', text: '#d8b4fe', label: 'Purple' },
  { bg: '#451a03', border: '#f59e0b', text: '#fde68a', label: 'Amber' },
  { bg: '#052e16', border: '#22c55e', text: '#86efac', label: 'Green' },
  { bg: '#1a1a2e', border: '#6366f1', text: '#a5b4fc', label: 'Indigo' },
  { bg: '#2d1b4e', border: '#ec4899', text: '#f9a8d4', label: 'Pink' },
  { bg: '#1c1917', border: '#a8a29e', text: '#d6d3d1', label: 'Stone' },
]

// ─── SupplierModal Component ──────────────────────────────────────────────────

function SupplierModal({
  supplier,
  onSave,
  onDelete,
  onClose,
}: {
  supplier: Supplier | null
  onSave: (data: Omit<Supplier, 'id'>) => void
  onDelete?: (id: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(supplier?.name ?? '')
  const [selectedColor, setSelectedColor] = useState(
    supplier ? COLOR_PRESETS.find(c => c.border === supplier.color_border) ?? COLOR_PRESETS[0] : COLOR_PRESETS[0]
  )
  const [skus, setSkus] = useState<string[]>(supplier?.skus ?? [])
  const [skuInput, setSkuInput] = useState('')
  const [fileName, setFileName] = useState('')

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = text.split(/\r?\n/).filter(Boolean)
      const parsed = rows.flatMap(row => {
        const cols = row.split(/[,\t]/)
        return cols[0].trim()
      }).filter(s => s.length > 0 && s !== 'SKU' && s !== 'sku')
      setSkus(prev => [...new Set([...prev, ...parsed])])
    }
    reader.readAsText(file)
  }

  function handleSubmit() {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      color_bg: selectedColor.bg,
      color_border: selectedColor.border,
      color_text: selectedColor.text,
      skus,
    })
  }

  const isEdit = !!supplier

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...modalBox, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{isEdit ? 'Edit Supplier' : 'New Supplier'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 18 }}>&times;</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Supplier Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Acme Foods"
            style={inputStyle}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Color</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLOR_PRESETS.map(c => (
              <button
                key={c.label}
                onClick={() => setSelectedColor(c)}
                title={c.label}
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: c.bg,
                  border: selectedColor.border === c.border ? `2px solid ${c.border}` : '2px solid transparent',
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: selectedColor.border === c.border ? `0 0 0 1px ${c.border}` : 'none',
                }}
              >
                <div style={{ position: 'absolute', inset: 3, borderRadius: 3, background: c.border, opacity: 0.7 }} />
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 12, background: selectedColor.bg, border: `1px solid ${selectedColor.border}`, fontSize: 12, color: selectedColor.text }}>
            {name || 'Preview'}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>SKUs</label>
          {skus.length > 0 && (
            <div style={{ marginBottom: 8, fontSize: 11, color: '#71717a' }}>
              {skus.length} SKU{skus.length !== 1 ? 's' : ''} loaded
              {skus.slice(0, 3).map(s => (
                <span key={s} style={{ marginLeft: 4, padding: '1px 6px', background: '#27272a', borderRadius: 4, color: '#a1a1aa' }}>{s}</span>
              ))}
              {skus.length > 3 && <span style={{ marginLeft: 4, color: '#52525b' }}>+{skus.length - 3} more</span>}
            </div>
          )}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            background: '#27272a', border: '1px dashed #3f3f46', borderRadius: 6,
            cursor: 'pointer', fontSize: 13, color: '#a1a1aa',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2v8M5 5l3-3 3 3M2 11v1a2 2 0 002 2h8a2 2 0 002-2v-1" />
            </svg>
            {fileName || 'Upload CSV or Excel'}
            <input type="file" accept=".csv,.xlsx,.xls,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            <input
              value={skuInput}
              onChange={e => setSkuInput(e.target.value)}
              placeholder="Or type SKU and press Enter"
              style={{ ...inputStyle, flex: 1 }}
              onKeyDown={e => {
                if (e.key === 'Enter' && skuInput.trim()) {
                  setSkus(prev => [...new Set([...prev, skuInput.trim()])])
                  setSkuInput('')
                }
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 20 }}>
          {isEdit && onDelete && (
            <button
              onClick={() => { if (confirm('Delete this supplier?')) onDelete(supplier!.id) }}
              style={{ padding: '8px 14px', background: '#3b0a0a', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
            >Delete</button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button onClick={onClose} style={{ padding: '8px 14px', background: '#27272a', border: '1px solid #3f3f46', color: '#a1a1aa', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSubmit} style={{ padding: '8px 14px', background: '#7c3aed', border: 'none', color: '#fff', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
              {isEdit ? 'Save Changes' : 'Create Supplier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── DatePicker Component ──────────────────────────────────────────────────

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isQueue = value === 'queue'
  const { monthStr, day } = isQueue ? { monthStr: '', day: 1 } : parseLaunchDate(value)

  function handleMonthChange(newMonthStr: string) {
    onChange(buildLaunchDate(newMonthStr, day))
  }

  function handleDayChange(e: React.ChangeEvent<HTMLInputElement>) {
    const d = parseInt(e.target.value)
    if (!isNaN(d) && monthStr) onChange(buildLaunchDate(monthStr, d))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Month grid */}
      <div style={{ border: '1px solid #3f3f46', borderRadius: 8, padding: 12, background: '#1c1c1f' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#71717a', marginBottom: 4 }}>STAGING</div>
          <button
            type="button"
            onClick={() => onChange('queue')}
            style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
              background: isQueue ? '#7c3aed' : '#27272a',
              color: isQueue ? '#fff' : '#a1a1aa',
              fontWeight: isQueue ? 600 : 400,
            }}
          >Queue</button>
        </div>
        <div style={{ fontSize: 10, color: '#71717a', marginBottom: 4 }}>2025</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {MONTH_COLS.filter(c => c.year === 2025).map(col => {
            const v = monthValue(col)
            const selected = !isQueue && monthStr === v
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
            const selected = !isQueue && monthStr === v
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
      {!isQueue && (
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
      )}
    </div>
  )
}

// ─── Matrix Component ────────────────────────────────────────────────────────

function Matrix() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showCreateSupplier, setShowCreateSupplier] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
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
    supabase.from('suppliers').select('*').order('name').then(({ data }) => {
      if (data) setSuppliers(data)
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

  // ─── Supplier CRUD ─────────────────────────────────────────────────────────

  const createSupplier = useCallback(async (data: Omit<Supplier, 'id'>) => {
    const localRow: Supplier = { ...data, id: crypto.randomUUID() }
    if (!supabase) {
      setSuppliers(prev => [...prev, localRow])
      return
    }
    const { data: row, error } = await supabase.from('suppliers').insert(data).select().single()
    if (error) {
      console.warn('Supabase supplier insert failed:', error.message)
      setSuppliers(prev => [...prev, localRow])
    } else if (row) {
      setSuppliers(prev => [...prev, row])
    }
  }, [])

  const updateSupplier = useCallback(async (id: string, data: Partial<Supplier>) => {
    if (!supabase) return
    await supabase.from('suppliers').update(data).eq('id', id)
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s))
  }, [])

  const deleteSupplier = useCallback(async (id: string) => {
    if (!supabase) return
    await supabase.from('suppliers').delete().eq('id', id)
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }, [])

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, campaign: Campaign) {
    // Preserve the day when dragging to a new month
    const day = campaign.launch_month === 'queue' ? 1 : parseLaunchDate(campaign.launch_month).day
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
      <div style={{ padding: '8px 24px', borderBottom: '1px solid #27272a', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setShowCreateSupplier(true)}
          title="Add supplier"
          style={{ width: 26, height: 26, borderRadius: '50%', background: '#27272a', border: '1px solid #3f3f46', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1, flexShrink: 0 }}
        >+</button>
        {[...suppliers].sort((a, b) => a.name.localeCompare(b.name)).map(s => (
          <div
            key={s.id}
            onClick={() => setEditSupplier(s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer',
              padding: '4px 10px', borderRadius: 20,
              background: s.color_bg,
              border: `1px solid ${s.color_border}`,
              color: s.color_text,
              fontWeight: 500,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {s.name}
          </div>
        ))}
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
              <th style={{
                position: 'sticky', left: 200, zIndex: 30,
                width: 140, minWidth: 140,
                background: '#1a1025', color: '#c4b5fd',
                borderBottom: '1px solid #27272a',
                borderRight: '1px solid #3b2d6e',
                padding: '8px 10px', fontSize: 12, fontWeight: 600,
                textAlign: 'center',
              }}>Jenna&apos;s Queue</th>
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
                <td
                  style={{
                    position: 'sticky', left: 200, zIndex: 9,
                    width: 140, minWidth: 140,
                    verticalAlign: 'top', padding: 4,
                    background: ri % 2 === 0 ? '#0e0a1a' : '#100c1e',
                    borderBottom: '1px solid #1a1a1c',
                    borderRight: '1px solid #2d2250',
                  }}
                  onDragOver={handleDragOver}
                  onDrop={e => {
                    const id = e.dataTransfer.getData('campaignId')
                    if (id) {
                      updateCampaign(id, { distributor: dist, launch_month: 'queue' })
                      setDragId(null)
                    }
                  }}
                >
                  {campaigns
                    .filter(c => c.distributor === dist && c.launch_month === 'queue')
                    .map(camp => {
                      const colors = getSupplierColors(suppliers, camp.supplier)
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
                        const colors = getSupplierColors(suppliers, camp.supplier)
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
      {showCreate && <CreateModal onCreate={createCampaign} suppliers={suppliers} onClose={() => setShowCreate(false)} />}

      {/* Supplier Modals */}
      {showCreateSupplier && (
        <SupplierModal
          supplier={null}
          onSave={async (data) => { await createSupplier(data); setShowCreateSupplier(false) }}
          onClose={() => setShowCreateSupplier(false)}
        />
      )}
      {editSupplier && (
        <SupplierModal
          supplier={editSupplier}
          onSave={async (data) => { await updateSupplier(editSupplier.id, data); setEditSupplier(null) }}
          onDelete={async (id) => { await deleteSupplier(id); setEditSupplier(null) }}
          onClose={() => setEditSupplier(null)}
        />
      )}

      {/* Detail Modal */}
      {detailCampaign && (
        <DetailModal
          campaign={detailCampaign}
          suppliers={suppliers}
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

function CreateModal({ onCreate, suppliers, onClose }: {
  onCreate: (c: Omit<Campaign, 'id'>) => Promise<void>
  suppliers: Supplier[]
  onClose: () => void
}) {
  const [distributor, setDistributor] = useState(DISTRIBUTORS[0])
  const [supplier, setSupplier] = useState('')
  const [skusInput, setSkusInput] = useState('')
  const [launchDate, setLaunchDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [status, setStatus] = useState('Not contacted')
  const [formNotes, setFormNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplier) { alert('Please select a supplier'); return }
    if (!distributor) { alert('Please select a distributor'); return }
    setSaving(true)
    try {
      const skus = skusInput.split(',').map(s => s.trim()).filter(Boolean)
      await onCreate({ distributor, supplier, skus, launch_month: launchDate, status, notes: formNotes || undefined })
      onClose()
    } catch (err) {
      console.error('Create campaign failed:', err)
      alert('Failed to save campaign. Check console for details.')
    } finally {
      setSaving(false)
    }
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
              <option value="">Select supplier...</option>
              {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
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
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              placeholder="Any additional context..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
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

function DetailModal({ campaign, suppliers, onUpdate, onDelete, onClose }: {
  campaign: Campaign
  suppliers: Supplier[]
  onUpdate: (id: string, patch: Partial<Campaign>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [status, setStatus] = useState(campaign.status)
  const [launchDate, setLaunchDate] = useState(campaign.launch_month)
  const [skusInput, setSkusInput] = useState((campaign.skus || []).join(', '))
  const [notesInput, setNotesInput] = useState(campaign.notes ?? '')
  const [saving, setSaving] = useState(false)
  const colors = getSupplierColors(suppliers, campaign.supplier)

  async function handleSave() {
    setSaving(true)
    const skus = skusInput.split(',').map(s => s.trim()).filter(Boolean)
    await onUpdate(campaign.id, { status, launch_month: launchDate, skus, notes: notesInput || undefined })
    setSaving(false)
  }

  async function handleDelete() {
    await onDelete(campaign.id)
    onClose()
  }

  const hasChanges =
    status !== campaign.status ||
    launchDate !== campaign.launch_month ||
    skusInput !== (campaign.skus || []).join(', ') ||
    notesInput !== (campaign.notes ?? '')

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

          {/* Notes — editable */}
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={notesInput}
              onChange={e => setNotesInput(e.target.value)}
              placeholder="Any additional context..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
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
