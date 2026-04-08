'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'

type BirthdateAccessGateProps = {
    enabled: boolean
    expectedPasswordHash: string | null
    children: React.ReactNode
}

type AccessState = 'pending' | 'granted' | 'denied'

function normalizeInput(value: string): string {
    return value.replace(/\s+/g, '').toLowerCase()
}

async function sha256Hex(value: string): Promise<string> {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(value)
    const digest = await crypto.subtle.digest('SHA-256', bytes)

    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
}

export default function BirthdateAccessGate({
    enabled,
    expectedPasswordHash,
    children,
}: BirthdateAccessGateProps) {
    const router = useRouter()
    const [accessState, setAccessState] = useState<AccessState>('pending')
    const [passwordInput, setPasswordInput] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (!enabled) {
            return
        }

        if (!expectedPasswordHash) {
            alert('Unable to verify birthdate password. Please double check and try again.')
            setAccessState('denied')
            router.replace('/')
        }
    }, [enabled, expectedPasswordHash, router])

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (isSubmitting || !enabled || !expectedPasswordHash) {
            return
        }

        const trimmedAnswer = passwordInput.trim()
        const validFormat = /^[A-Za-z]{3}\d{2}\d{4}$/.test(trimmedAnswer)

        if (!validFormat) {
            alert('Incorrect birthdate password format. Please double check and use MmmDDYYYY.')
            setAccessState('denied')
            router.replace('/')
            return
        }

        setIsSubmitting(true)

        try {
            const answerHash = await sha256Hex(normalizeInput(trimmedAnswer))
            if (answerHash === expectedPasswordHash) {
                setAccessState('granted')
                return
            }

            alert('Incorrect birthdate password. Please double check.')
            setAccessState('denied')
            router.replace('/')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!enabled) {
        return <>{children}</>
    }

    if (accessState === 'granted') {
        return <>{children}</>
    }

    if (accessState === 'pending') {
        return (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <p className="text-lg font-semibold text-slate-800">🔐 Birthdate Verification</p>
                <p className="mt-1 text-lg font-semibold text-slate-600">
                    Enter your birthdate in MmmDDYYYY format (example: Jan012000).
                </p>
                <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={passwordInput}
                        onChange={(event) => setPasswordInput(event.target.value)}
                        placeholder="MmmDDYYYY"
                        className="h-14 w-full rounded-lg border border-slate-300 px-4 text-lg outline-none placeholder:text-slate-400 focus:border-slate-500"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="h-14 rounded-lg bg-slate-900 px-4 text-lg font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSubmitting ? 'Verifying...' : 'Unlock Records'}
                    </button>
                </form>
            </div>
        )
    }

    return null
}
