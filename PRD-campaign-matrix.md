# PRD: Distributor Campaign Matrix

**Product:** Pepper Tracker — new page/route  
**Status:** Draft  
**Author:** AvB / Hank  
**Last updated:** March 2026  

---

## Overview

A matrix view showing campaigns across distributors (rows) and months (columns). The goal is maximum visibility into what campaigns are planned, locked, and live across the full distributor network in a single view.

---

## User Problem

The team needs a way to see, at a glance, which distributors have campaigns running each month, which suppliers are involved, what's locked in vs. prospective, and what's already happened — without digging through spreadsheets.

---

## Goals

- See all distributor campaigns across the current calendar year in one view
- Create and manage campaign tiles with key metadata
- Quickly distinguish: supplier, lock status, and recency
- Prevent editing of past campaigns (data integrity)

---

## Non-Goals

- Multi-distributor campaigns (1 campaign = 1 distributor)
- Multi-month campaigns (tiles are always 1 month wide)
- Snowflake direct integration (v1 uses Supabase-synced SKU list)

---

## Page Layout

**Route:** `/matrix`

**Structure:**
- Fixed left column: distributor names (sorted alphabetically, deduplicated)
- Fixed header row: month columns (Jan–Dec, current year)
- Scrollable grid body: campaign tiles
- Top-right: **+ Add Campaign** button

**Month columns:** January through December, current year only. Current month visually highlighted.

---

## Distributor List

(Deduplicated, alphabetically sorted)

A.F. Wendling, Aldo's Foodservice, Atlantic Distributors Inc, Atlantic Food Distributors, Badger Foodservice, Bermuda General Agency, Brown Foodservice, Cable Meats, Carolina Food Service, Cash-Wa, Colony Foods, Cotati Foodservice, Custom Food Service, Flanagan Foodservice - Division 1, Flanagan Foodservice - Division 3, Flanagan Foodservice - Division 4, Food Supply Inc, Ginsberg's Foods, Graves Foods, Halsey, Henrys Foods - Alexandria, Jordano's Foodservice, Kaleel Brothers, Kast Distributors, Kohl Wholesale, Kuna Foodservice - Dupo, Latina Boulevard Foods, Layman Distributing, Marathon Foodservice, Maximum Quality Foods - Division 1, McDonald Wholesale, Merchants Grocery, Merit Foods, Merrill, MJ Kellner, Palmer Food Services, Perrone & Sons, RDP Foodservice, RightWay Food Service, S&W Wholesale, Schenck Foods Co, Schiff's Food Service, Seashore Food Distributors, Sofo Foods Department 1 - Ohio, Sofo Foods Department 7 - Georgia, Tankersley Foodservice, Tapia Brothers - Fresno, Tapia Brothers - Las Vegas, Tapia Brothers - Maywood, Tapia Brothers - Phoenix, Thomsen Foodservice, TPC Food Service, Victory Foodservice, Wilkens Foodservice, Wood Fruitticher

---

## Campaign Tile

**Size:** Small — fit multiple per cell. Only supplier name visible on face.

**Visual states:**

| State | Style |
|---|---|
| Locked in | Thick colored border (3px solid) |
| Prospective | No border |
| Past (launch date passed) | Dimmed opacity (~40%), no interaction |

**Supplier Colors:**

| Supplier | Color |
|---|---|
| Pilgrim's | Blue |
| Essity | Teal |
| Aspire Bakeries | Orange |
| Kettle Cuisine | Red |
| Kerry | Purple |
| Branding Iron | Amber |
| J.M. Smucker | Green |

---

## Create Campaign Modal

Triggered by **+ Add Campaign** or clicking an empty cell.

**Fields:**
- **Distributor** — dropdown (full list, deduplicated + sorted)
- **Supplier** — dropdown (7 options)
- **SKUs** — multi-select from Supabase-synced list
- **Launch Month** — month picker (current year only)
- **Locked In** — toggle (default: off/prospective)

**Validation:**
- All fields required except SKUs (warn but allow)
- Cannot create a campaign in a past month

---

## View Campaign Modal

Clicking a tile opens a detail view:

- Supplier
- Distributor
- Launch month
- SKUs selected
- Lock status (editable if not past)
- Delete button (only if not past)

---

## Drag & Drop

- Tiles can be dragged to a different month or distributor cell
- Tiles in past months **cannot be moved**
- Dragging a tile updates its distributor + month

---

## Data Model (Supabase)

**Table: `campaigns`**

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| distributor | text | |
| supplier | text | |
| skus | text[] | Array of SKU ids |
| launch_month | date | First day of the month |
| locked | boolean | default false |
| created_at | timestamp | |
| updated_at | timestamp | |

**Table: `skus`** *(synced from Snowflake)*

| Column | Type |
|---|---|
| id | uuid or text |
| name | text |
| code | text |

---

## Open Questions

| # | Question | Owner |
|---|---|---|
| 1 | SKU sync: export from Snowflake → Supabase manually or via script? | AvB |
| 2 | What does a SKU entry look like (name, code, both)? | AvB |
| 3 | Should the matrix be read-only on mobile or fully interactive? | AvB |
| 4 | Any sorting/filtering controls needed (e.g., filter by supplier)? | AvB |

---

## Out of Scope (v1)

- Mobile-optimized layout
- Notifications or alerts
- Export to CSV/PDF
- User-level permissions
