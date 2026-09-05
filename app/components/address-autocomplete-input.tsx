"use client";

import { InterfaceCopy } from "./interface-copy";
import { useEffect, useRef, useState } from "react";

let nextDatalistId = 0;

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
  const [datalistId] = useState(() => `tuveloz-address-suggestions-${nextDatalistId++}`);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(value)}`);
        if (!response.ok) return;
        const data = (await response.json()) as { suggestions?: string[] };
        setSuggestions(data.suggestions ?? []);
      } catch {
        // Suggestions are a UX convenience; a failed lookup leaves free typing available.
      }
    }, 300);
  }

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
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
