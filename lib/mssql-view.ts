import sql from 'mssql'

export type ViewRow = Record<string, unknown>

const poolCache = globalThis as typeof globalThis & {
    mssqlPoolPromise?: Promise<sql.ConnectionPool>
    allViewRowsPromise?: Promise<ViewRow[]>
}

function parseServerValue(raw: string): { host: string; instanceName?: string } {
    const normalized = raw.replace('/', '\\')
    const [host, instanceName] = normalized.split('\\')

    if (!host) {
        throw new Error('MSSQL_SERVER must include a valid host name')
    }

    if (instanceName) {
        return { host, instanceName }
    }

    return { host }
}

function requireEnv(name: string): string {
    const value = process.env[name]

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`)
    }

    return value
}

function getSafeObjectName(name: string, envName: string): string {
    const isSafe = /^[A-Za-z0-9_.\[\]]+$/.test(name)

    if (!isSafe) {
        throw new Error(`${envName} contains invalid characters`)
    }

    return name
}

export function getViewName(): string {
    return getSafeObjectName(requireEnv('MSSQL_VIEW_NAME'), 'MSSQL_VIEW_NAME')
}

export function getEmpRecColumnName(): string {
    const raw = process.env.MSSQL_EMP_REC_COLUMN ?? 'empRec'
    return getSafeObjectName(raw, 'MSSQL_EMP_REC_COLUMN')
}

export function getEmpOldIdColumnName(): string {
    const raw = process.env.MSSQL_EMP_OLD_ID_COLUMN ?? 'empOldID'
    return getSafeObjectName(raw, 'MSSQL_EMP_OLD_ID_COLUMN')
}

function getRowValueByColumnName(row: ViewRow, columnName: string): unknown {
    const exact = row[columnName]
    if (exact !== undefined) {
        return exact
    }

    const matchedKey = Object.keys(row).find(
        (key) => key.toLowerCase() === columnName.toLowerCase()
    )

    return matchedKey ? row[matchedKey] : undefined
}

async function getPool(): Promise<sql.ConnectionPool> {
    if (!poolCache.mssqlPoolPromise) {
        const parsedServer = parseServerValue(requireEnv('MSSQL_SERVER'))
        const configuredPort = process.env.MSSQL_PORT
            ? Number(process.env.MSSQL_PORT)
            : undefined

        const config: sql.config = {
            server: parsedServer.host,
            // With a named instance, SQL Server Browser resolves the actual port.
            port: parsedServer.instanceName ? undefined : (configuredPort ?? 1433),
            user: requireEnv('MSSQL_USER'),
            password: requireEnv('MSSQL_PASSWORD'),
            database: requireEnv('MSSQL_DATABASE'),
            options: {
                instanceName: parsedServer.instanceName,
                useUTC: false,
                encrypt: process.env.MSSQL_ENCRYPT === 'true',
                trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== 'false',
            },
            pool: {
                max: 10,
                min: 0,
                idleTimeoutMillis: 30000,
            },
        }

        poolCache.mssqlPoolPromise = sql.connect(config).catch((error: unknown) => {
            poolCache.mssqlPoolPromise = undefined
            throw error
        })
    }

    const cachedPoolPromise = poolCache.mssqlPoolPromise
    if (!cachedPoolPromise) {
        throw new Error('Failed to initialize MSSQL connection pool')
    }

    return cachedPoolPromise
}

async function queryAllViewRows(): Promise<ViewRow[]> {
    const viewName = getViewName()
    const pool = await getPool()
    const result = await pool.request().query(`SELECT * FROM ${viewName}`)
    return result.recordset as ViewRow[]
}

export function getAllViewRows(): Promise<ViewRow[]> {
    if (!poolCache.allViewRowsPromise) {
        // Reuse one DB read for static params generation and page rendering.
        poolCache.allViewRowsPromise = queryAllViewRows().catch((error: unknown) => {
            poolCache.allViewRowsPromise = undefined
            throw error
        })
    }

    return poolCache.allViewRowsPromise
}

export async function getRowsForEmpRec(empRec: string): Promise<ViewRow[]> {
    const column = getEmpRecColumnName()
    const rows = await getAllViewRows()
    return rows.filter((row) => String(getRowValueByColumnName(row, column) ?? '') === empRec)
}

export async function getEmpRecParamValues(): Promise<string[]> {
    const column = getEmpRecColumnName()
    const rows = await getAllViewRows()
    const uniqueValues = new Set<string>()

    for (const row of rows) {
        const value = getRowValueByColumnName(row, column)
        if (value === null || value === undefined) {
            continue
        }

        const text = String(value).trim()
        if (text.length > 0) {
            uniqueValues.add(text)
        }
    }

    return [...uniqueValues]
}

export async function getRowsForEmpOldId(empOldID: string): Promise<ViewRow[]> {
    const column = getEmpOldIdColumnName()
    const rows = await getAllViewRows()
    return rows.filter((row) => String(getRowValueByColumnName(row, column) ?? '') === empOldID)
}

export async function getEmpOldIdParamValues(): Promise<string[]> {
    const column = getEmpOldIdColumnName()
    const rows = await getAllViewRows()
    const uniqueValues = new Set<string>()

    for (const row of rows) {
        const value = getRowValueByColumnName(row, column)
        if (value === null || value === undefined) {
            continue
        }

        const text = String(value).trim()
        if (text.length > 0) {
            uniqueValues.add(text)
        }
    }

    return [...uniqueValues]
}