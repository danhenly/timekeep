import { createHash } from 'node:crypto'
import { Fragment } from 'react'
import {
    getAllLeavesRows,
    getEmpOldIdParamValues,
    getRowsForEmpOldId,
} from '@/lib/mssql-view'
import BirthdateAccessGate from './birthdate-access-gate'
import DownloadIdQrButton from './download-id-qr-button'

type Row = Record<string, unknown>
type PunchPair = {
    key: string
    clockIn: Date | null
    clockOut: Date | null
}

type ConsolidatedRow = {
    date: Date
    pairs: PunchPair[]
    hasManual: boolean
    hasLeaveFiled: boolean
}

type DisplayRow =
    | {
        kind: 'log'
        value: ConsolidatedRow
    }
    | {
        kind: 'gap'
        date: Date
        label: 'NO LOG' | 'SATURDAY' | 'SUNDAY' | 'LEAVE FILED'
    }

function getValueCaseInsensitive(row: Row, key: string): unknown {
    const matchedKey = Object.keys(row).find(
        (candidate) => candidate.toLowerCase() === key.toLowerCase()
    )

    return matchedKey ? row[matchedKey] : undefined
}

function formatTime(value: unknown): string {
    if (value === null || value === undefined || value === '') {
        return ''
    }

    const date = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(date.getTime())) {
        return String(value)
    }

    return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

function parseDate(value: unknown): Date | null {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? null : date
}

function toDateKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function formatShortDate(value: Date): string {
    return new Intl.DateTimeFormat('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit',
    }).format(value)
}

function formatWeekday(value: Date): string {
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
    }).format(value)
}

function getUtcPlus8TodayStart(): Date {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date())

    const year = Number(parts.find((part) => part.type === 'year')?.value)
    const month = Number(parts.find((part) => part.type === 'month')?.value)
    const day = Number(parts.find((part) => part.type === 'day')?.value)

    return new Date(year, month - 1, day)
}

function getUtcPlus8YesterdayStart(): Date {
    return addDays(getUtcPlus8TodayStart(), -1)
}

function getGapLabel(date: Date): 'NO LOG' | 'SATURDAY' | 'SUNDAY' {
    const day = date.getDay()

    if (day === 6) {
        return 'SATURDAY'
    }

    if (day === 0) {
        return 'SUNDAY'
    }

    return 'NO LOG'
}

function getLeaveSourceDate(row: Row): Date | null {
    const candidates = [
        getValueCaseInsensitive(row, 'clockIn'),
        getValueCaseInsensitive(row, 'clockOut'),
        getValueCaseInsensitive(row, 'leaveDate'),
        getValueCaseInsensitive(row, 'date'),
        getValueCaseInsensitive(row, 'dateFrom'),
        getValueCaseInsensitive(row, 'fromDate'),
        getValueCaseInsensitive(row, 'dateTo'),
        getValueCaseInsensitive(row, 'toDate'),
    ]

    for (const candidate of candidates) {
        const parsed = parseDate(candidate)
        if (parsed) {
            return parsed
        }
    }

    return null
}

function getRowDateFromRange(row: Row): Date | null {
    const candidates = [
        getValueCaseInsensitive(row, 'dateFrom'),
        getValueCaseInsensitive(row, 'fromDate'),
        getValueCaseInsensitive(row, 'leaveDateFrom'),
        getValueCaseInsensitive(row, 'startDate'),
    ]

    for (const candidate of candidates) {
        const parsed = parseDate(candidate)
        if (parsed) {
            return parsed
        }
    }

    return null
}

function getRowDateToRange(row: Row): Date | null {
    const candidates = [
        getValueCaseInsensitive(row, 'dateTo'),
        getValueCaseInsensitive(row, 'toDate'),
        getValueCaseInsensitive(row, 'leaveDateTo'),
        getValueCaseInsensitive(row, 'endDate'),
    ]

    for (const candidate of candidates) {
        const parsed = parseDate(candidate)
        if (parsed) {
            return parsed
        }
    }

    return null
}

function getLeaveDateKeysForRow(row: Row): string[] {
    const rangeStart = getRowDateFromRange(row)
    const rangeEnd = getRowDateToRange(row)

    if (rangeStart && rangeEnd) {
        const startOfRange = startOfDay(rangeStart)
        const endOfRange = startOfDay(rangeEnd)
        const start = startOfRange <= endOfRange ? startOfRange : endOfRange
        const end = startOfRange <= endOfRange ? endOfRange : startOfRange

        const keys: string[] = []
        let cursor = start

        while (cursor <= end) {
            keys.push(toDateKey(cursor))
            cursor = addDays(cursor, 1)
        }

        return keys
    }

    const singleDate = getLeaveSourceDate(row)
    if (!singleDate) {
        return []
    }

    return [toDateKey(startOfDay(singleDate))]
}

function getBirthDate(row: Row): Date | null {
    const empBday = getValueCaseInsensitive(row, 'empBday')
    return parseDate(empBday)
}

function formatBirthdatePassword(date: Date): string {
    const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date)
    const day = String(date.getDate()).padStart(2, '0')
    const year = String(date.getFullYear())

    return `${month}${day}${year}`
}

function normalizeBirthdatePassword(value: string): string {
    return value.replace(/\s+/g, '').toLowerCase()
}

function sha256Hex(value: string): string {
    return createHash('sha256').update(value).digest('hex')
}

function getPairSortTime(pair: PunchPair): number {
    const source = pair.clockIn ?? pair.clockOut
    return source ? source.getTime() : Number.POSITIVE_INFINITY
}

function getRowStableKey(row: Row, fallback: string): string {
    const dtrdid = String(getValueCaseInsensitive(row, 'dtrdid') ?? '').trim()
    if (dtrdid) {
        return dtrdid
    }

    const leaveId = String(getValueCaseInsensitive(row, 'leaveid') ?? '').trim()
    if (leaveId) {
        return leaveId
    }

    const genericId = String(getValueCaseInsensitive(row, 'id') ?? '').trim()
    if (genericId) {
        return genericId
    }

    return fallback
}

function consolidateByDate(rows: Row[], leavesRows: Row[]): ConsolidatedRow[] {
    const bucket = new Map<string, ConsolidatedRow>()

    for (const row of rows) {
        const clockInDate = parseDate(getValueCaseInsensitive(row, 'clockIn'))
        const clockOutDate = parseDate(getValueCaseInsensitive(row, 'clockOut'))
        const sourceDate = clockInDate ?? clockOutDate

        if (!sourceDate) {
            continue
        }

        const dateOnly = startOfDay(sourceDate)
        const key = toDateKey(dateOnly)
        const existing = bucket.get(key)

        if (!existing) {
            bucket.set(key, {
                date: dateOnly,
                pairs: [
                    {
                        key: getRowStableKey(row, `${key}-0`),
                        clockIn: clockInDate,
                        clockOut: clockOutDate,
                    },
                ],
                hasManual:
                    String(getValueCaseInsensitive(row, 'entryType') ?? '').toLowerCase() ===
                    'manual',
                hasLeaveFiled: false,
            })
            continue
        }

        existing.pairs.push({
            key: getRowStableKey(row, `${key}-${existing.pairs.length}`),
            clockIn: clockInDate,
            clockOut: clockOutDate,
        })

        if (
            String(getValueCaseInsensitive(row, 'entryType') ?? '').toLowerCase() === 'manual'
        ) {
            existing.hasManual = true
        }
    }

    for (const leaveRow of leavesRows) {
        const clockInDate = parseDate(getValueCaseInsensitive(leaveRow, 'clockIn'))
        const clockOutDate = parseDate(getValueCaseInsensitive(leaveRow, 'clockOut'))
        const sourceDate = clockInDate ?? clockOutDate

        if (!sourceDate) {
            continue
        }

        const dateOnly = startOfDay(sourceDate)
        const key = toDateKey(dateOnly)
        const existing = bucket.get(key)

        if (!existing) {
            bucket.set(key, {
                date: dateOnly,
                pairs: [
                    {
                        key: `leave-${getRowStableKey(leaveRow, `${key}-0`)}`,
                        clockIn: clockInDate,
                        clockOut: clockOutDate,
                    },
                ],
                hasManual: false,
                hasLeaveFiled: true,
            })
            continue
        }

        existing.pairs.push({
            key: `leave-${getRowStableKey(leaveRow, `${key}-${existing.pairs.length}`)}`,
            clockIn: clockInDate,
            clockOut: clockOutDate,
        })
        existing.hasLeaveFiled = true
    }

    for (const row of bucket.values()) {
        row.pairs = row.pairs.sort((a, b) => getPairSortTime(a) - getPairSortTime(b)).slice(0, 2)
    }

    return [...bucket.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
}

function buildDisplayRows(
    rows: ConsolidatedRow[],
    leaveDateKeys: Set<string>,
    earliestDate: Date,
    latestDate: Date
): DisplayRow[] {
    const start = startOfDay(earliestDate)
    const end = startOfDay(latestDate)

    if (start > end) {
        return []
    }

    const rowsByDateKey = new Map(rows.map((row) => [toDateKey(row.date), row]))
    const displayRows: DisplayRow[] = []
    let cursor = start

    while (cursor <= end) {
        const key = toDateKey(cursor)
        const existing = rowsByDateKey.get(key)

        if (existing) {
            displayRows.push({ kind: 'log', value: existing })
        } else {
            displayRows.push({
                kind: 'gap',
                date: cursor,
                label: leaveDateKeys.has(key) ? 'LEAVE FILED' : getGapLabel(cursor),
            })
        }

        cursor = addDays(cursor, 1)
    }

    return displayRows
}

export const dynamicParams = false

export async function generateStaticParams() {
    const values = await getEmpOldIdParamValues()
    return values.map((empOldID) => ({ empOldID }))
}

export default async function EmployeeViewPage({
    params,
}: {
    params: Promise<{ empOldID: string }>
}) {
    const { empOldID } = await params
    const rows = await getRowsForEmpOldId(empOldID)
    const empRec = rows.length > 0 ? String(getValueCaseInsensitive(rows[0], 'empRec') ?? '').trim() : ''
    const allLeavesRows = empRec ? await getAllLeavesRows() : []
    const leavesRows = allLeavesRows.filter(
        (row) => String(getValueCaseInsensitive(row, 'empRec') ?? '').trim() === empRec
    )
    const consolidatedRows = consolidateByDate(rows, leavesRows)
    const leaveDateKeys = new Set<string>()
    for (const leaveRow of leavesRows) {
        const keys = getLeaveDateKeysForRow(leaveRow)
        for (const key of keys) {
            leaveDateKeys.add(key)
        }
    }
    const earliestDate = consolidatedRows[0]?.date
    const utcPlus8Yesterday = getUtcPlus8YesterdayStart()
    const displayRows = earliestDate
        ? buildDisplayRows(consolidatedRows, leaveDateKeys, earliestDate, utcPlus8Yesterday)
        : []
    const birthDate = rows.length > 0 ? getBirthDate(rows[0]) : null
    const expectedBirthdatePasswordHash = birthDate
        ? sha256Hex(normalizeBirthdatePassword(formatBirthdatePassword(birthDate)))
        : null
    const empOldId =
        rows.length > 0
            ? String(getValueCaseInsensitive(rows[0], 'empOldID') ?? '')
            : ''

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
            <div className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                <h1 className="text-2xl font-semibold tracking-tight">Employee DTR</h1>
                <p className="mt-2 text-base text-slate-600 sm:text-sm">
                    Employee ID: <span className="font-medium text-slate-900">{empOldId}</span>
                </p>

                {displayRows.length === 0 ? (
                    <p className="mt-6 text-sm text-slate-600">No rows found for this empOldID.</p>
                ) : (
                    <BirthdateAccessGate enabled={displayRows.length > 0} expectedPasswordHash={expectedBirthdatePasswordHash}>
                        <DownloadIdQrButton employeeId={empOldId} />
                        <div className="mt-4 w-full overflow-x-auto rounded-xl border border-slate-200">
                            <table className="mx-auto w-full min-w-max table-auto divide-y divide-slate-200 text-left text-sm sm:text-sm lg:w-full lg:min-w-[52rem] lg:table-fixed">
                                <thead className="bg-slate-100 uppercase tracking-wide text-slate-700">
                                    <tr>
                                        <th className="px-2 py-2 font-semibold sm:px-3 lg:w-[40%]">date</th>
                                        <th className="px-2 py-2 font-semibold sm:px-3 lg:w-[30%]">clockIn</th>
                                        <th className="px-2 py-2 font-semibold sm:px-3 lg:w-[30%]">clockOut</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {displayRows.map((row, index) => {
                                        if (row.kind === 'gap') {
                                            const badgeClass =
                                                row.label === 'LEAVE FILED'
                                                    ? 'border-emerald-300 bg-emerald-100 text-emerald-900'
                                                    : row.label === 'NO LOG'
                                                    ? 'border-rose-300 bg-rose-100 text-rose-800'
                                                    : 'border-sky-300 bg-sky-100 text-sky-800'

                                            return (
                                                <tr key={`gap-${index}-${toDateKey(row.date)}`} className="bg-slate-50">
                                                    <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-700 sm:px-3">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span>{formatShortDate(row.date)}</span>
                                                            <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${badgeClass}`}>
                                                                {row.label}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-2 py-2 text-slate-500 sm:px-3">-</td>
                                                    <td className="whitespace-nowrap px-2 py-2 text-slate-500 sm:px-3">-</td>
                                                </tr>
                                            )
                                        }

                                        const firstPair = row.value.pairs[0]
                                        const secondPair = row.value.pairs[1]
                                        const hasSecondPair = Boolean(secondPair)
                                        const rowSpan = hasSecondPair ? 2 : 1
                                        const hasNoStatusBadge =
                                            !row.value.hasLeaveFiled && !row.value.hasManual

                                        return (
                                            <Fragment key={`log-group-${firstPair?.key ?? `log-${index}-${toDateKey(row.value.date)}`}`}>
                                                <tr key={`${firstPair?.key ?? `log-${index}-${toDateKey(row.value.date)}-1`}-1`} className="hover:bg-slate-50">
                                                    <td
                                                        rowSpan={rowSpan}
                                                        className="whitespace-nowrap px-2 py-2 align-top text-slate-800 sm:px-3"
                                                    >
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span>{formatShortDate(row.value.date)}</span>
                                                            {row.value.hasLeaveFiled ? (
                                                                <span className="inline-flex w-fit rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-emerald-900">
                                                                    LEAVE FILED
                                                                </span>
                                                            ) : null}
                                                            {row.value.hasManual ? (
                                                                <span className="inline-flex w-fit rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
                                                                    manual
                                                                </span>
                                                            ) : null}
                                                            {hasNoStatusBadge ? (
                                                                <span className="inline-flex w-fit rounded-full border border-slate-300 bg-transparent px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-700">
                                                                    {formatWeekday(row.value.date)}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-2 py-2 text-slate-800 sm:px-3">
                                                        {firstPair?.clockIn ? formatTime(firstPair.clockIn) : ''}
                                                    </td>
                                                    <td className="whitespace-nowrap px-2 py-2 text-slate-800 sm:px-3">
                                                        {firstPair?.clockOut ? formatTime(firstPair.clockOut) : ''}
                                                    </td>
                                                </tr>
                                                {hasSecondPair ? (
                                                    <tr key={`${secondPair?.key ?? `log-${index}-${toDateKey(row.value.date)}-2`}-2`} className="hover:bg-slate-50">
                                                        <td className="whitespace-nowrap px-2 py-2 text-slate-800 sm:px-3">
                                                            {secondPair?.clockIn ? formatTime(secondPair.clockIn) : ''}
                                                        </td>
                                                        <td className="whitespace-nowrap px-2 py-2 text-slate-800 sm:px-3">
                                                            {secondPair?.clockOut ? formatTime(secondPair.clockOut) : ''}
                                                        </td>
                                                    </tr>
                                                ) : null}
                                            </Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </BirthdateAccessGate>
                )}
            </div>
        </div>
    )
}