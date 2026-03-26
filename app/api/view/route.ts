import { getAllViewRows } from '@/lib/mssql-view'

export const runtime = 'nodejs'
export const dynamic = 'force-static'

export async function GET() {
    try {
        const rows = await getAllViewRows()

        return Response.json({
            rows,
            rowCount: rows.length,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'

        return Response.json(
            { error: 'Failed to query MSSQL view', message },
            { status: 500 }
        )
    }
}
