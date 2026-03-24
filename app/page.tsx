'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import PasswordGate, { checkAuth } from '../components/PasswordGate'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const CATEGORIES = ['GTM', 'Ops', 'Product', 'Engineering', 'Other']

const STATUSES = ['Not Started', 'In Progress', 'Overdue', 'Done']

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Not Started': { bg: '#27272a', text: '#a1a1aa', border: '#52525b' },
  'In Progress': { bg: '#1e293b', text: '#7dd3fc', border: '#0ea5e9' },
  'Overdue': { bg: '#3b1515', text: '#fca5a5', border: '#ef4444' },
  'Done': { bg: '#1e3a2f', text: '#6ee7b7', border: '#10b981' },
}

const OWNERS = ['AvB', 'JM', 'EG', 'MK', 'RK', 'KR', 'SW', 'LH']

const TEAMS = ['Growth Agent', 'Ads & Product']

const TEAM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Growth Agent': { bg: '#1e293b', text: '#7dd3fc', border: '#0ea5e9' },
  'Ads & Product': { bg: '#3b2014', text: '#fdba74', border: '#f97316' },
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GTM: { bg: '#2d1f5e', text: '#a78bfa', border: '#7c3aed' },
  Ops: { bg: '#1e3a2f', text: '#6ee7b7', border: '#10b981' },
  Product: { bg: '#3b2014', text: '#fdba74', border: '#f97316' },
  Engineering: { bg: '#1e293b', text: '#7dd3fc', border: '#0ea5e9' },
  Other: { bg: '#2a2a2a', text: '#a1a1aa', border: '#71717a' },
}

const STORAGE_KEY = 'pepper-tracker-projects'
const CUTLINE_STORAGE_KEY = 'pepper-tracker-cutline'
const CUTLINE_ID = '__cutline__'
const DONE_CUTLINE_ID = '__done_cutline__'

interface Project {
  id: string
  title: string
  owner: string
  team: string
  description: string
  dueDate: string
  category: string
  status: string
  prd: string
  completedAt: number | null
}

function loadProjects(): Project[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    const projects = JSON.parse(data)
    let migrated = false
    const result = projects.map((p: any) => {
      let updated = p
      if (p.owner === 'RZ') {
        migrated = true
        updated = { ...updated, owner: 'RK' }
      }
      if (!updated.team) updated = { ...updated, team: '' }
      if (!updated.completedAt) updated = { ...updated, completedAt: null }
      return updated
    })
    if (migrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
    return result
  } catch {
    return []
  }
}

function saveProjects(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  if (supabase) {
    const rows = projects.map((p) => ({
      id: p.id,
      data: p,
      updated_at: new Date().toISOString(),
    }))
    supabase
      .from('projects')
      .upsert(rows, { onConflict: 'id' })
      .then(({ error }) => {
        if (error) console.warn('Supabase upsert failed:', error.message)
      })
  }
}

function loadCutLineIndex() {
  try {
    const data = localStorage.getItem(CUTLINE_STORAGE_KEY)
    return data !== null ? JSON.parse(data) : null
  } catch {
    return null
  }
}

function saveCutLineIndex(index: number) {
  localStorage.setItem(CUTLINE_STORAGE_KEY, JSON.stringify(index))
}

function createProject(): Project {
  return {
    id: crypto.randomUUID(),
    title: '',
    owner: '',
    team: '',
    description: '',
    dueDate: '',
    category: 'GTM',
    status: 'Not Started',
    prd: '',
    completedAt: null,
  }
}

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDaysOverdue(dueDate: string) {
  if (!dueDate) return 0
  const due = new Date(dueDate + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

function EditableCell({ value, onChange, type = 'text', placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (type === 'text') inputRef.current.select()
    }
  }, [editing, type])

  const commit = () => {
    setEditing(false)
    if (draft !== value) onChange(draft)
  }

  if (!editing) {
    return (
      <div
        className="editable-cell"
        onClick={() => setEditing(true)}
        title="Click to edit"
      >
        {value || <span className="placeholder">{placeholder}</span>}
      </div>
    )
  }

  return (
    <input
      ref={inputRef}
      type={type}
      className="editable-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') {
          setDraft(value)
          setEditing(false)
        }
      }}
    />
  )
}

function CategoryBadge({ category, onChange }: { category: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.Other

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="category-wrapper" ref={ref}>
      <span
        className="category-badge"
        style={{
          background: colors.bg,
          color: colors.text,
          borderColor: colors.border,
        }}
        onClick={() => setOpen(!open)}
      >
        {category}
      </span>
      {open && (
        <div className="category-dropdown">
          {CATEGORIES.map((cat) => {
            const c = CATEGORY_COLORS[cat]
            return (
              <div
                key={cat}
                className="category-option"
                style={{ color: c.text }}
                onClick={() => {
                  onChange(cat)
                  setOpen(false)
                }}
              >
                <span
                  className="category-dot"
                  style={{ background: c.border }}
                />
                {cat}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TeamDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const colors = value ? TEAM_COLORS[value] : null

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="category-wrapper" ref={ref}>
      {value && colors ? (
        <span
          className="category-badge"
          style={{
            background: colors.bg,
            color: colors.text,
            borderColor: colors.border,
          }}
          onClick={() => setOpen(!open)}
        >
          {value}
        </span>
      ) : (
        <div className="editable-cell" onClick={() => setOpen(!open)} title="Click to select team">
          <span className="placeholder">Team</span>
        </div>
      )}
      {open && (
        <div className="category-dropdown">
          {TEAMS.map((t) => {
            const c = TEAM_COLORS[t]
            return (
              <div
                key={t}
                className={`category-option${t === value ? ' owner-selected' : ''}`}
                style={{ color: c.text }}
                onClick={() => { onChange(t); setOpen(false) }}
              >
                <span className="category-dot" style={{ background: c.border }} />
                {t}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DatePicker({ value, onChange, locked }: { value: string; onChange: (v: string) => void; locked?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const today = new Date()
  const parsed = value ? new Date(value + 'T00:00:00') : null
  const [viewYear, setViewYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth() : today.getMonth())

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open && parsed) {
      setViewYear(parsed.getFullYear())
      setViewMonth(parsed.getMonth())
    } else if (open) {
      setViewYear(today.getFullYear())
      setViewMonth(today.getMonth())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startDay = new Date(viewYear, viewMonth, 1).getDay()
  const monthName = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long' })

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }
  function selectDay(day: number) {
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onChange(`${viewYear}-${m}-${d}`)
    setOpen(false)
  }

  const formatDisplay = (val: string) => {
    if (!val) return null
    const d = new Date(val + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (locked) {
    return (
      <div className="datepicker-wrapper">
        <div className="locked-date" title="Date locked - project is overdue">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="lock-icon">
            <path d="M12 7V5a4 4 0 10-8 0v2a2 2 0 00-2 2v5a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2zm-5-2a3 3 0 116 0v2H7V5z" />
          </svg>
          <span>{formatDisplay(value) || 'No date'}</span>
        </div>
      </div>
    )
  }

  const cells = []
  for (let i = 0; i < startDay; i++) cells.push(<div key={`e${i}`} className="cal-cell empty" />)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const isSelected = value === dateStr
    const isToday = d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
    cells.push(
      <div
        key={d}
        className={`cal-cell day${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
        onClick={() => selectDay(d)}
      >
        {d}
      </div>
    )
  }

  return (
    <div className="datepicker-wrapper" ref={ref}>
      <div className="editable-cell" onClick={() => setOpen(!open)} title="Click to pick date">
        {formatDisplay(value) || <span className="placeholder">Set date</span>}
      </div>
      {open && (
        <div className="cal-dropdown">
          <div className="cal-header">
            <button className="cal-nav" onClick={prevMonth}>&lsaquo;</button>
            <span className="cal-title">{monthName} {viewYear}</span>
            <button className="cal-nav" onClick={nextMonth}>&rsaquo;</button>
          </div>
          <div className="cal-weekdays">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="cal-weekday">{d}</div>)}
          </div>
          <div className="cal-grid">{cells}</div>
          {value && (
            <button className="cal-clear" onClick={() => { onChange(''); setOpen(false) }}>Clear</button>
          )}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status, onChange, prd, isOverdue }: { status: string; onChange: (v: string) => void; prd: string; isOverdue: boolean }) {
  const [open, setOpen] = useState(false)
  const [warning, setWarning] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const colors = STATUS_COLORS[status] || STATUS_COLORS['Not Started']

  const allowedStatuses = isOverdue ? ['Done'] : STATUSES

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setWarning('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(s: string) {
    if ((s === 'In Progress' || s === 'Done') && !prd) {
      setWarning('PRD required to mark In Progress or Done')
      return
    }
    setWarning('')
    onChange(s)
    setOpen(false)
  }

  return (
    <div className="category-wrapper" ref={ref}>
      <span
        className="category-badge"
        style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
        onClick={() => { setOpen(!open); setWarning('') }}
      >
        {status}
      </span>
      {open && (
        <div className="category-dropdown">
          {warning && <div className="prd-warning">{warning}</div>}
          {isOverdue && <div className="prd-warning" style={{ color: '#fdba74', background: '#3b2014' }}>Overdue: can only move to Done</div>}
          {allowedStatuses.map((s) => {
            const c = STATUS_COLORS[s]
            return (
              <div
                key={s}
                className="category-option"
                style={{ color: c.text }}
                onClick={() => handleSelect(s)}
              >
                <span className="category-dot" style={{ background: c.border }} />
                {s}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OwnerDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="category-wrapper" ref={ref}>
      <div className="editable-cell" onClick={() => setOpen(!open)} title="Click to select owner">
        {value || <span className="placeholder">Owner</span>}
      </div>
      {open && (
        <div className="category-dropdown">
          {OWNERS.map((o) => (
            <div
              key={o}
              className={`category-option${o === value ? ' owner-selected' : ''}`}
              onClick={() => { onChange(o); setOpen(false) }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PrdCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== value) onChange(draft)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="editable-input"
        value={draft}
        placeholder="Paste PRD URL"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
      />
    )
  }

  if (value) {
    return (
      <div className="prd-cell">
        <a href={value} target="_blank" rel="noopener noreferrer" className="prd-link" title={value}>
          🔗
        </a>
        <span className="prd-edit" onClick={() => setEditing(true)} title="Edit URL">✎</span>
      </div>
    )
  }

  return (
    <div className="editable-cell prd-empty" onClick={() => setEditing(true)} title="Click to add PRD URL">
      <span className="placeholder">—</span>
    </div>
  )
}

function OverdueBadge({ dueDate }: { dueDate: string }) {
  const days = getDaysOverdue(dueDate)
  if (days <= 0) return null
  return <span className="overdue-badge">{days}d overdue</span>
}

function SortableRow({ project, onUpdate, onDelete, belowCut }: { project: Project; onUpdate: (id: string, field: string, value: any) => void; onDelete: (id: string) => void; belowCut: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : ('auto' as const),
  }

  const update = (field: string) => (val: any) => onUpdate(project.id, field, val)
  const isOverdue = project.status === 'Overdue'

  return (
    <tr ref={setNodeRef} style={style} className={`project-row${belowCut ? ' below-cut' : ''}`}>
      <td className="drag-handle" {...attributes} {...listeners}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </td>
      <td>
        <EditableCell
          value={project.title}
          onChange={update('title')}
          placeholder="Project title"
        />
      </td>
      <td>
        <OwnerDropdown
          value={project.owner}
          onChange={update('owner')}
        />
      </td>
      <td>
        <TeamDropdown
          value={project.team || ''}
          onChange={update('team')}
        />
      </td>
      <td>
        <EditableCell
          value={project.description}
          onChange={update('description')}
          placeholder="Description"
        />
      </td>
      <td>
        <div className="due-date-cell">
          <DatePicker
            value={project.dueDate}
            onChange={update('dueDate')}
            locked={isOverdue}
          />
          {isOverdue && <OverdueBadge dueDate={project.dueDate} />}
        </div>
      </td>
      <td>
        <PrdCell value={project.prd || ''} onChange={update('prd')} />
      </td>
      <td>
        <StatusBadge
          status={project.status || 'Not Started'}
          onChange={update('status')}
          prd={project.prd}
          isOverdue={isOverdue}
        />
      </td>
      <td>
        <CategoryBadge
          category={project.category}
          onChange={update('category')}
        />
      </td>
      <td>
        <button className="delete-btn" onClick={() => onDelete(project.id)} title="Delete project">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

function DoneRow({ project, onUpdate, onDelete }: { project: Project; onUpdate: (id: string, field: string, value: any) => void; onDelete: (id: string) => void }) {
  const update = (field: string) => (val: any) => onUpdate(project.id, field, val)
  const isOverdue = project.status === 'Overdue'

  return (
    <tr className="project-row done-row">
      <td className="drag-handle drag-disabled">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" opacity="0.15">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </td>
      <td>
        <EditableCell
          value={project.title}
          onChange={update('title')}
          placeholder="Project title"
        />
      </td>
      <td>
        <OwnerDropdown
          value={project.owner}
          onChange={update('owner')}
        />
      </td>
      <td>
        <TeamDropdown
          value={project.team || ''}
          onChange={update('team')}
        />
      </td>
      <td>
        <EditableCell
          value={project.description}
          onChange={update('description')}
          placeholder="Description"
        />
      </td>
      <td>
        <DatePicker
          value={project.dueDate}
          onChange={update('dueDate')}
          locked={isOverdue}
        />
      </td>
      <td>
        <PrdCell value={project.prd || ''} onChange={update('prd')} />
      </td>
      <td>
        <StatusBadge
          status={project.status || 'Done'}
          onChange={update('status')}
          prd={project.prd}
          isOverdue={false}
        />
      </td>
      <td>
        <CategoryBadge
          category={project.category}
          onChange={update('category')}
        />
      </td>
      <td>
        <button className="delete-btn" onClick={() => onDelete(project.id)} title="Delete project">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

function SortableCutLine() {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: CUTLINE_ID })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : ('auto' as const),
  }

  return (
    <tr ref={setNodeRef} style={style} className="cutline-row" {...attributes} {...listeners}>
      <td colSpan={10}>
        <div className="cutline-content">
          <div className="cutline-line" />
          <span className="cutline-label">cut line</span>
          <div className="cutline-line" />
        </div>
      </td>
    </tr>
  )
}

function DoneCutLine() {
  return (
    <tr className="cutline-row done-cutline-row">
      <td colSpan={10}>
        <div className="cutline-content done-cutline-content">
          <div className="cutline-line done-cutline-line" />
          <span className="cutline-label done-cutline-label">DONE</span>
          <div className="cutline-line done-cutline-line" />
        </div>
      </td>
    </tr>
  )
}

function Tracker() {
  const [projects, setProjects] = useState(loadProjects)
  const [cutLineIndex, setCutLineIndex] = useState(() => {
    const saved = loadCutLineIndex()
    const active = loadProjects().filter((p) => p.status !== 'Done')
    return saved !== null ? saved : active.length
  })

  // Supabase: load initial data and subscribe to real-time changes
  useEffect(() => {
    if (!supabase) return

    let channel: any

    async function loadFromSupabase() {
      try {
        const { data, error } = await supabase!
          .from('projects')
          .select('*')
        if (error) {
          console.warn('Supabase load failed:', error.message)
          return
        }
        if (data && data.length > 0) {
          const loaded = data.map((row: any) => row.data)
          setProjects(loaded)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded))
        }
      } catch {
        // Supabase unreachable — keep localStorage data
      }
    }

    loadFromSupabase()

    channel = supabase
      .channel('projects-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload: any) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const incoming = payload.new.data
            setProjects((prev) => {
              const idx = prev.findIndex((p) => p.id === incoming.id)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = incoming
                return next
              }
              return [...prev, incoming]
            })
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id
            setProjects((prev) => prev.filter((p) => p.id !== deletedId))
          }
        }
      )
      .subscribe()

    return () => {
      if (channel) supabase!.removeChannel(channel)
    }
  }, [])

  // Auto-overdue: on load and every 60s
  useEffect(() => {
    function markOverdue() {
      const todayStr = getTodayStr()
      setProjects((prev) => {
        let changed = false
        const next = prev.map((p) => {
          if (p.status !== 'Done' && p.status !== 'Overdue' && p.dueDate && p.dueDate < todayStr) {
            changed = true
            return { ...p, status: 'Overdue' }
          }
          return p
        })
        return changed ? next : prev
      })
    }
    markOverdue()
    const interval = setInterval(markOverdue, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    saveProjects(projects)
  }, [projects])

  useEffect(() => {
    saveCutLineIndex(cutLineIndex)
  }, [cutLineIndex])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Separate active (non-Done) and done projects, preserving order
  const activeProjects = projects.filter((p) => p.status !== 'Done')
  const doneProjects = projects
    .filter((p) => p.status === 'Done')
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))

  // Clamp cutLineIndex to active projects range
  const clampedCutIndex = Math.max(0, Math.min(cutLineIndex, activeProjects.length))

  // Build sortable list with cutline (only active projects)
  const sortableIds = [
    ...activeProjects.slice(0, clampedCutIndex).map((p) => p.id),
    CUTLINE_ID,
    ...activeProjects.slice(clampedCutIndex).map((p) => p.id),
  ]

  function handleDragEnd(event: any) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // Prevent dragging done cutline or done projects
    if (active.id === DONE_CUTLINE_ID) return

    const oldIdx = sortableIds.indexOf(active.id)
    const newIdx = sortableIds.indexOf(over.id)
    if (oldIdx === -1 || newIdx === -1) return

    const reordered = arrayMove(sortableIds, oldIdx, newIdx)

    const newCutIdx = reordered.indexOf(CUTLINE_ID)
    const newProjectIds = reordered.filter((id) => id !== CUTLINE_ID)
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]))
    const reorderedActive = newProjectIds.map((id) => projectMap[id])

    // Rebuild full project list: reordered active + done
    setProjects([...reorderedActive, ...doneProjects])
    setCutLineIndex(newCutIdx)
  }

  function addProject() {
    const np = createProject()
    // Insert into active projects (before done), above cut line
    setProjects((prev) => {
      const active = prev.filter((p) => p.status !== 'Done')
      const done = prev.filter((p) => p.status === 'Done')
      return [...active, np, ...done]
    })
    setCutLineIndex((prev) => prev + 1)
  }

  function updateProject(id: string, field: string, value: any) {
    setProjects((prev) => {
      return prev.map((p) => {
        if (p.id !== id) return p
        const updated = { ...p, [field]: value }
        // Handle status change to Done: set completedAt
        if (field === 'status' && value === 'Done') {
          updated.completedAt = Date.now()
        }
        // Handle status change from Done: clear completedAt
        if (field === 'status' && value !== 'Done' && p.status === 'Done') {
          updated.completedAt = null
        }
        return updated
      })
    })

    // If marking as Done, adjust cut line index if project was above cut
    if (field === 'status' && value === 'Done') {
      const activeIdx = activeProjects.findIndex((p) => p.id === id)
      if (activeIdx !== -1 && activeIdx < clampedCutIndex) {
        setCutLineIndex((prev) => Math.max(0, prev - 1))
      }
    }
  }

  function deleteProject(id: string) {
    const activeIdx = activeProjects.findIndex((p) => p.id === id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
    if (activeIdx !== -1 && activeIdx < clampedCutIndex) {
      setCutLineIndex((prev) => Math.max(0, prev - 1))
    }
    if (supabase) {
      supabase.from('projects').delete().eq('id', id).then(({ error }) => {
        if (error) console.warn('Supabase delete failed:', error.message)
      })
    }
  }

  // Column resize logic
  const INITIAL_WIDTHS = [32, 240, 52, 90, 340, 110, 40, 90, 68, 36]
  const colWidths = useRef(INITIAL_WIDTHS.slice())
  const [, setResizeTick] = useState(0)

  const onResizeMouseDown = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = colWidths.current[colIndex]

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientX - startX
      colWidths.current[colIndex] = Math.max(30, startWidth + delta)
      setResizeTick((t) => t + 1)
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const totalProjects = projects.length
  const hasAnyProjects = totalProjects > 0

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="#7c3aed" />
              <path d="M7 8h10M7 12h7M7 16h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <h1>Pepper</h1>
          </div>
          <span className="subtitle">Project Tracker</span>
        </div>
        <button className="add-btn" onClick={addProject}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 2v12M2 8h12" />
          </svg>
          Add Project
        </button>
      </header>

      <div className="table-container">
        {!hasAnyProjects ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="6" y="10" width="36" height="28" rx="4" />
                <path d="M6 18h36M18 18v20" />
              </svg>
            </div>
            <p className="empty-title">No projects yet</p>
            <p className="empty-sub">Click &quot;Add Project&quot; to get started</p>
          </div>
        ) : (
          <table className="project-table">
            <thead>
              <tr>
                <th className="th-drag" style={{ width: colWidths.current[0] }}></th>
                {['Title', 'Owner', 'Team', 'Description', 'Due', 'PRD', 'Status', 'Cat'].map((label, i) => {
                  const colIdx = i + 1
                  return (
                    <th key={label} style={{ width: colWidths.current[colIdx] }}>
                      {label}
                      <div
                        className="resize-handle"
                        onMouseDown={(e) => onResizeMouseDown(colIdx, e)}
                      />
                    </th>
                  )
                })}
                <th className="th-actions" style={{ width: colWidths.current[9] }}></th>
              </tr>
            </thead>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortableIds}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {sortableIds.map((id, i) => {
                    if (id === CUTLINE_ID) return <SortableCutLine key={CUTLINE_ID} />
                    const cutPos = sortableIds.indexOf(CUTLINE_ID)
                    return (
                      <SortableRow
                        key={id}
                        project={activeProjects.find((p) => p.id === id)!}
                        onUpdate={updateProject}
                        onDelete={deleteProject}
                        belowCut={i > cutPos}
                      />
                    )
                  })}
                  <DoneCutLine key={DONE_CUTLINE_ID} />
                  {doneProjects.map((p) => (
                    <DoneRow
                      key={p.id}
                      project={p}
                      onUpdate={updateProject}
                      onDelete={deleteProject}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </DndContext>
          </table>
        )}
      </div>

      <footer className="footer">
        <span>{totalProjects} project{totalProjects !== 1 ? 's' : ''}{hasAnyProjects ? ` · ${clampedCutIndex} above cut · ${doneProjects.length} done` : ''}</span>
        <span className="footer-dot">·</span>
        <span>{supabase ? 'Synced with Supabase' : 'Data saved locally'}</span>
      </footer>
    </div>
  )
}

export default function Page() {
  const [unlocked, setUnlocked] = useState(() => checkAuth())

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />

  return <Tracker />
}
