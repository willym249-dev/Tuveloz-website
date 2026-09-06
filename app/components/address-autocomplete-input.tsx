"use client";

import { InterfaceCopy } from "./interface-copy";
import { useEffect, useId, useRef, useState } from "react";

type AddressAutocompleteInputProps = {
  defaultValue?: string;
  maxLength?: number;
  name: string;
  placeholder?: string;
  required?: boolean;
};

export function AddressAutocompleteInput({
  defaultValue = "",
  maxLength,
  name,
  placeholder,
  required,
}: AddressAutocompleteInputProps) {
  const datalistId = useId();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  function handleChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    requestRef.current?.abort();
    requestRef.current = null;
    setSuggestions([]);
    if (value.trim().length < 3) {
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    debounceRef.current = setTimeout(async () => {
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(value)}`, { signal: controller.signal });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (controller.signal.aborted) return;
        const values = data && typeof data === "object" && "suggestions" in data && Array.isArray(data.suggestions)
          ? data.suggestions.filter((item): item is string => typeof item === "string" && !!item.trim()).map(item => item.trim())
          : [];
        setSuggestions([...new Set(values)].slice(0, 5));
      } catch {
        // Suggestions are a UX convenience; a failed lookup leaves free typing available.
      } finally {
        clearTimeout(timer);
        if (requestRef.current === controller) requestRef.current = null;
      }
    }, 300);
  }

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    requestRef.current?.abort();
  }, []);

  return (
    <InterfaceCopy><>
      <input
        defaultValue={defaultValue}
        list={datalistId}
        maxLength={maxLength}
        name={name}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        required={required}
      />
      <datalist id={datalistId}>
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
    </></InterfaceCopy>
  );
}
