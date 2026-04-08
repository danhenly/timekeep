import { getAllHolidaysRows } from '@/lib/mssql-view'

export const runtime = 'nodejs'
export const dynamic = 'force-static'

function isLocalhostRequest(request: Request): boolean {
    const localhostNames = new Set(['localhost', '127.0.0.1', '::1'])
    const urlHost = new URL(request.url).hostname.toLowerCase()
    const forwardedHostRaw = request.headers.get('x-forwarded-host')
    const hostRaw = request.headers.get('host')

    const forwardedHost = forwardedHostRaw
        ? forwardedHostRaw.split(',')[0]?.trim().split(':')[0]?.toLowerCase()
        : ''
    const host = hostRaw ? hostRaw.split(',')[0]?.trim().split(':')[0]?.toLowerCase() : ''

    return [urlHost, forwardedHost, host].some((value) => Boolean(value) && localhostNames.has(value))
}

export async function GET(request: Request) {
    try {
        if (process.env.NODE_ENV !== 'development' || !isLocalhostRequest(request)) {
            return Response.json({
                rows: [],
                rowCount: 0,
            })
        }

        const rows = await getAllHolidaysRows()

        return Response.json({
            rows,
            rowCount: rows.length,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'

        return Response.json(
            { error: 'Failed to query MSSQL holidays view', message },
            { status: 500 }
        )
    }
}
