import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { staffClockService } from '../../src/services/staffClockService'
import { supabase } from '../../src/supabase'
import { STAFF_CLOCK_TABLE, STAFF_CLOCK_BUCKET } from '../../src/models/StaffClock'
import type { StaffClockShift } from '../../src/models/StaffClock'

vi.mock('../../src/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn()
    }
  }
}))

vi.mock('../../src/modules/staffClock/compressSelfie', () => ({
  compressSelfie: vi.fn(async (blob: Blob) => blob)
}))

const openShai: StaffClockShift = {
  id: 's1',
  staff_name: 'Shai',
  clock_in_at: '2026-11-04T06:00:00.000Z',
  clock_out_at: null,
  clock_in_photo_path: 'Shai/s1-in.jpg',
  clock_out_photo_path: null,
  clock_in_status: 'pending',
  clock_out_status: null,
  clock_in_override: false,
  clock_out_override: false,
  ot_requested: false,
  ot_status: null,
  ot_requested_at: null,
  created_by: 'staff',
  updated_by: null,
  created_at: '2026-11-04T06:00:00.000Z',
  updated_at: '2026-11-04T06:00:00.000Z'
}

function mockList(data: StaffClockShift[]) {
  const mockOrder2 = vi.fn().mockResolvedValue({ data, error: null })
  const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 })
  const mockSelect = vi.fn().mockReturnValue({ order: mockOrder1 })
  vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)
}

function mockStorage() {
  const upload = vi.fn().mockResolvedValue({ error: null })
  const remove = vi.fn().mockResolvedValue({ error: null })
  const getPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: 'https://cdn.example/photo.jpg' }
  })
  vi.mocked(supabase.storage.from).mockReturnValue({
    upload,
    remove,
    getPublicUrl
  } as any)
  return { upload, remove, getPublicUrl }
}

describe('staffClockService independence', () => {
  it('source file does not mention other business tables', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/services/staffClockService.ts'), 'utf8')
    expect(src).not.toMatch(/orders|expenses|store_sessions|sales_summary|ledger_entries/)
  })
})

describe('staffClockService.list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('selects only staff_clock_shifts', async () => {
    mockList([openShai])
    const rows = await staffClockService.list()
    expect(rows).toEqual([openShai])
    expect(supabase.from).toHaveBeenCalledWith(STAFF_CLOCK_TABLE)
    expect(supabase.from).not.toHaveBeenCalledWith('orders')
    expect(supabase.from).not.toHaveBeenCalledWith('store_sessions')
  })
})

describe('staffClockService.clockIn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploads a selfie and inserts a pending in punch', async () => {
    const { upload } = mockStorage()
    const inserted = { ...openShai, id: 'new-1' }
    const mockSelect = vi.fn().mockResolvedValue({ data: [inserted], error: null })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

    const photo = new Blob(['jpeg'], { type: 'image/jpeg' })
    const result = await staffClockService.clockIn('Shai', photo, [], 'staff')
    expect(result.staff_name).toBe('Shai')
    expect(result.clock_in_status).toBe('pending')
    expect(supabase.storage.from).toHaveBeenCalledWith(STAFF_CLOCK_BUCKET)
    expect(upload).toHaveBeenCalled()
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        staff_name: 'Shai',
        clock_in_status: 'pending',
        clock_in_override: false,
        created_by: 'staff'
      })
    )
  })

  it('rejects a second open shift for the same person', async () => {
    await expect(
      staffClockService.clockIn('Shai', new Blob(['x']), [openShai], 'staff')
    ).rejects.toThrow(/already clocked in/i)
  })
})

describe('staffClockService.clockOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploads an out selfie and closes the open shift', async () => {
    mockStorage()
    const closed = {
      ...openShai,
      clock_out_at: '2026-11-04T14:00:00.000Z',
      clock_out_status: 'pending',
      clock_out_photo_path: 'Shai/s1-out.jpg'
    }
    const mockSelect = vi.fn().mockResolvedValue({ data: [closed], error: null })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    const result = await staffClockService.clockOut(
      'Shai',
      new Blob(['jpeg'], { type: 'image/jpeg' }),
      [openShai],
      'staff'
    )
    expect(result.clock_out_status).toBe('pending')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        clock_out_status: 'pending',
        clock_out_override: false
      })
    )
  })
})

describe('staffClockService approvals and overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets in or out status without changing punch times', async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ ...openShai, clock_in_status: 'approved' }],
      error: null
    })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    await staffClockService.setPunchStatus(openShai.id, 'in', 'approved', 'ana')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        clock_in_status: 'approved',
        updated_by: 'ana'
      })
    )
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ clock_in_at: expect.anything() })
    )
  })

  it('typed times are overrides marked approved', async () => {
    const mockSelect = vi.fn().mockResolvedValue({ data: [openShai], error: null })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    await staffClockService.updateTimes(
      openShai.id,
      {
        clock_in_at: '2026-11-04T06:05:00.000Z',
        clock_out_at: '2026-11-04T14:10:00.000Z'
      },
      'ana'
    )
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        clock_in_at: '2026-11-04T06:05:00.000Z',
        clock_out_at: '2026-11-04T14:10:00.000Z',
        clock_in_override: true,
        clock_out_override: true,
        clock_in_status: 'approved',
        clock_out_status: 'approved'
      })
    )
  })

  it('missed punch inserts an approved override with no photos', async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ ...openShai, clock_in_override: true, clock_in_status: 'approved' }],
      error: null
    })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

    await staffClockService.createMissedPunch(
      {
        staff_name: 'Den',
        clock_in_at: '2026-11-04T06:00:00.000Z',
        clock_out_at: '2026-11-04T14:00:00.000Z'
      },
      [],
      'ana'
    )
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        staff_name: 'Den',
        clock_in_status: 'approved',
        clock_out_status: 'approved',
        clock_in_override: true,
        clock_out_override: true,
        clock_in_photo_path: null,
        clock_out_photo_path: null
      })
    )
  })

  it('staff OT request is pending and does not clock them out', async () => {
    const tenHourOpen = {
      ...openShai,
      clock_in_at: '2026-11-04T06:00:00.000Z'
    }
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ ...tenHourOpen, ot_requested: true, ot_status: 'pending' }],
      error: null
    })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    await staffClockService.requestOt('Shai', [tenHourOpen], 'staff', new Date('2026-11-04T16:00:00.000Z'))
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        ot_requested: true,
        ot_status: 'pending'
      })
    )
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ clock_out_at: expect.anything() })
    )
  })

  it('sets OT status without changing punch times', async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ ...openShai, ot_status: 'approved' }],
      error: null
    })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    await staffClockService.setOtStatus(openShai.id, 'approved', 'ana')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        ot_status: 'approved',
        updated_by: 'ana'
      })
    )
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ clock_in_at: expect.anything() })
    )
  })

  it('records OT as approved when admin or auditor marks it for staff', async () => {
    const forgot = {
      ...openShai,
      clock_in_at: '2026-11-04T04:00:00.000Z',
      clock_out_at: '2026-11-04T14:00:00.000Z',
      clock_out_status: 'approved' as const
    }
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ ...forgot, ot_requested: true, ot_status: 'approved' }],
      error: null
    })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    await staffClockService.recordOt(forgot, 'ana')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        ot_requested: true,
        ot_status: 'approved',
        updated_by: 'ana'
      })
    )
  })
})

describe('staffClockService.remove', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes the row and its photos', async () => {
    const { remove } = mockStorage()
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ delete: mockDelete } as any)

    await staffClockService.remove(openShai)
    expect(remove).toHaveBeenCalledWith(['Shai/s1-in.jpg'])
    expect(mockEq).toHaveBeenCalledWith('id', 's1')
  })
})
