'use client'

import { useEffect, useRef, useState } from 'react'

type HolidayBadgeProps = {
    details?: string | null
}

export default function HolidayBadge({ details }: HolidayBadgeProps) {
    const [isOpen, setIsOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!isOpen) {
            return
        }

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target
            if (!(target instanceof Node)) {
                return
            }

            if (!rootRef.current?.contains(target)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    const hasDetails = Boolean(details && details.trim())

    if (!hasDetails) {
        return (
            <span className="inline-flex w-fit rounded-full border border-fuchsia-300 bg-fuchsia-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-fuchsia-900">
                HOLIDAY
            </span>
        )
    }

    return (
        <div ref={rootRef} className="relative inline-block">
            <button
                type="button"
                onClick={() => setIsOpen((value) => !value)}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        setIsOpen(false)
                    }
                }}
                aria-expanded={isOpen}
                aria-label="Show holiday details"
                className="inline-flex w-fit rounded-full border border-fuchsia-300 bg-fuchsia-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-fuchsia-900"
            >
                HOLIDAY
            </button>
            {isOpen ? (
                <div
                    role="tooltip"
                    className="absolute left-0 top-full z-20 mt-1 w-max max-w-[20rem] rounded-md border border-fuchsia-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 shadow-lg"
                >
                    {details}
                </div>
            ) : null}
        </div>
    )
}