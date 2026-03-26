import { Fragment } from 'react'
import { getEmpOldIdParamValues, getRowsForEmpOldId } from '@/lib/mssql-view'

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
}

type DisplayRow =
    | {
        kind: 'log'
        value: ConsolidatedRow
    }
    | {
        kind: 'gap'
        date: Date
        label: 'NO LOG' | 'SATURDAY' | 'SUNDAY'
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

function getPairSortTime(pair: PunchPair): number {
    const source = pair.clockIn ?? pair.clockOut
    return source ? source.getTime() : Number.POSITIVE_INFINITY
}

function consolidateByDate(rows: Row[]): ConsolidatedRow[] {
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
            const dtrdid = String(getValueCaseInsensitive(row, 'dtrdid') ?? '').trim()
            bucket.set(key, {
                date: dateOnly,
                pairs: [
                    {
                        key: dtrdid || `${key}-0`,
                        clockIn: clockInDate,
                        clockOut: clockOutDate,
                    },
                ],
                hasManual:
                    String(getValueCaseInsensitive(row, 'entryType') ?? '').toLowerCase() ===
                    'manual',
            })
            continue
        }

        const dtrdid = String(getValueCaseInsensitive(row, 'dtrdid') ?? '').trim()
        existing.pairs.push({
            key: dtrdid || `${key}-${existing.pairs.length}`,
            clockIn: clockInDate,
            clockOut: clockOutDate,
        })

        if (
            String(getValueCaseInsensitive(row, 'entryType') ?? '').toLowerCase() === 'manual'
        ) {
            existing.hasManual = true
        }
    }

    for (const row of bucket.values()) {
        row.pairs = row.pairs.sort((a, b) => getPairSortTime(a) - getPairSortTime(b)).slice(0, 2)
    }

    return [...bucket.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
}

function buildDisplayRows(rows: ConsolidatedRow[]): DisplayRow[] {
    const displayRows: DisplayRow[] = []

    for (let i = 0; i < rows.length; i += 1) {
        const current = rows[i]
        const previous = rows[i - 1]

        if (previous) {
            let gapDate = addDays(previous.date, 1)
            while (gapDate < current.date) {
                displayRows.push({
                    kind: 'gap',
                    date: gapDate,
                    label: getGapLabel(gapDate),
                })
                gapDate = addDays(gapDate, 1)
            }
        }

        displayRows.push({ kind: 'log', value: current })
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
    const consolidatedRows = consolidateByDate(rows)
    const displayRows = buildDisplayRows(consolidatedRows)
    const empOldId =
        rows.length > 0
            ? String(getValueCaseInsensitive(rows[0], 'empOldID') ?? '')
            : ''

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
            <div className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                <h1 className="text-2xl font-semibold tracking-tight">Employee DTR</h1>
                <p className="mt-2 text-sm text-slate-600">
                    Employee ID: <span className="font-medium text-slate-900">{empOldId}</span>
                </p>

                {displayRows.length === 0 ? (
                    <p className="mt-6 text-sm text-slate-600">No rows found for this empOldID.</p>
                ) : (
                    <div className="mt-6 w-full overflow-x-auto rounded-xl border border-slate-200">
                        <table className="mx-auto w-full min-w-max table-auto divide-y divide-slate-200 text-left text-xs sm:text-sm lg:w-full lg:min-w-[52rem] lg:table-fixed">
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
                                            row.label === 'NO LOG'
                                                ? 'border-rose-300 bg-rose-100 text-rose-800'
                                                : 'border-sky-300 bg-sky-100 text-sky-800'

                                        return (
                                            <tr key={`gap-${index}-${toDateKey(row.date)}`} className="bg-slate-50">
                                                <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-700 sm:px-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span>{formatShortDate(row.date)}</span>
                                                        <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:text-xs ${badgeClass}`}>
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

                                    return (
                                        <Fragment key={`log-group-${firstPair?.key ?? `log-${index}-${toDateKey(row.value.date)}`}`}>
                                            <tr key={`${firstPair?.key ?? `log-${index}-${toDateKey(row.value.date)}-1`}-1`} className="hover:bg-slate-50">
                                                <td
                                                    rowSpan={rowSpan}
                                                    className="whitespace-nowrap px-2 py-2 align-top text-slate-800 sm:px-3"
                                                >
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span>{formatShortDate(row.value.date)}</span>
                                                        {row.value.hasManual ? (
                                                            <span className="inline-flex w-fit rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900 sm:text-xs">
                                                                manual
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
                )}
            </div>
        </div>
    )
}