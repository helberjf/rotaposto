'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { CornerDownLeft, MapPin } from 'lucide-react'

export interface LocationSuggestion {
  label: string
  lat: number
  lng: number
  primaryText: string
  secondaryText: string
}

export default function LocationAutocompleteInput({
  id,
  name,
  value,
  placeholder,
  disabled,
  className,
  inputClassName,
  minLength = 3,
  suggestionsOverride,
  onValueChange,
  onLocationSelect,
}: {
  id?: string
  name?: string
  value: string
  placeholder?: string
  disabled?: boolean
  className?: string
  inputClassName?: string
  minLength?: number
  suggestionsOverride?: LocationSuggestion[]
  onValueChange: (value: string) => void
  onLocationSelect: (suggestion: LocationSuggestion) => void
}) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const requestCounter = useRef(0)

  const shouldQuery = useMemo(
    () => value.trim().length >= minLength,
    [minLength, value]
  )

  useEffect(() => {
    if (!suggestionsOverride) {
      return
    }

    setSuggestions(suggestionsOverride)
    setHighlightedIndex(suggestionsOverride.length > 0 ? 0 : -1)
    setIsOpen(suggestionsOverride.length > 0)
  }, [suggestionsOverride])

  useEffect(() => {
    if (suggestionsOverride?.length) {
      setIsLoading(false)
      return
    }

    if (!shouldQuery || disabled) {
      setSuggestions([])
      setIsLoading(false)
      setHighlightedIndex(-1)
      return
    }

    const currentRequest = ++requestCounter.current
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsLoading(true)

      try {
        const response = await fetch(
          `/api/geocode/suggest?q=${encodeURIComponent(value.trim())}`,
          {
            signal: controller.signal,
          }
        )

        if (!response.ok) {
          throw new Error('Falha ao buscar sugestões.')
        }

        const payload = (await response.json()) as LocationSuggestion[]
        if (requestCounter.current !== currentRequest) {
          return
        }

        setSuggestions(payload)
        setHighlightedIndex(payload.length > 0 ? 0 : -1)
        setIsOpen(true)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        console.error('[location-autocomplete] Error:', error)
        setSuggestions([])
        setHighlightedIndex(-1)
      } finally {
        if (requestCounter.current === currentRequest) {
          setIsLoading(false)
        }
      }
    }, 220)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [disabled, shouldQuery, suggestionsOverride, value])

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  function handleSelect(suggestion: LocationSuggestion) {
    onValueChange(suggestion.label)
    onLocationSelect(suggestion)
    setSuggestions([])
    setHighlightedIndex(-1)
    setIsOpen(false)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((current) =>
        current >= suggestions.length - 1 ? 0 : current + 1
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1
      )
      return
    }

    if (event.key === 'Enter' && highlightedIndex >= 0) {
      event.preventDefault()
      handleSelect(suggestions[highlightedIndex])
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <Input
        id={id}
        name={name}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onFocus={() => {
          if (suggestions.length > 0) {
            setIsOpen(true)
          }
        }}
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          onValueChange(event.target.value)
          setIsOpen(true)
        }}
        className={cn(
          isLoading ? 'pr-10' : undefined,
          inputClassName
        )}
      />

      {isLoading ? (
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#78716c]">
          <Spinner className="size-4" />
        </div>
      ) : null}

      {isOpen && (shouldQuery || suggestions.length > 0) ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[700] overflow-hidden rounded-2xl border border-[#eaded3] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
          {suggestions.length > 0 ? (
            <div className="max-h-80 overflow-y-auto py-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    handleSelect(suggestion)
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                    index === highlightedIndex
                      ? 'bg-[#fff4eb]'
                      : 'hover:bg-[#fcfbf8]'
                  )}
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#fff4eb] text-[#f97316]">
                    <MapPin className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[#18181b]">
                      {suggestion.primaryText}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#78716c]">
                      {suggestion.secondaryText || suggestion.label}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-4 text-sm text-[#78716c]">
              Nenhum endereço encontrado. Tente ser mais específico.
            </div>
          )}

          <div className="border-t border-[#f1ede8] px-4 py-2 text-[11px] text-[#a8a29e]">
            <span className="inline-flex items-center gap-1">
              <CornerDownLeft className="size-3" />
              Enter para selecionar
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
