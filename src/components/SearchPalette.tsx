import { CornerDownLeft, LoaderCircle, Search, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchema } from '../context/SchemaContext';
import { fuzzySearch } from '../lib/fuzzySearch';
import { buildSearchIndex, type SearchItem } from '../lib/schema';
import { TypeBadge } from './TypeBadge';

interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchPalette({ isOpen, onClose }: SearchPaletteProps) {
  const { schema } = useSchema();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [items, setItems] = useState<SearchItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (!isOpen) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      setTimeout(() => {
        if (!cancelled) setItems(buildSearchIndex(schema));
      }, 0);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [schema, isOpen]);
  const results = useMemo<SearchItem[]>(() => {
    if (!deferredQuery.trim()) {
      return items.filter((item) => ['query', 'mutation', 'subscription'].includes(item.kind)).slice(0, 12);
    }
    return fuzzySearch(items, deferredQuery, 24);
  }, [deferredQuery, items]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  useEffect(() => setActiveIndex(0), [deferredQuery]);

  if (!isOpen) return null;

  const select = (item?: SearchItem) => {
    if (!item) return;
    navigate(item.path);
    onClose();
  };

  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search schema"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="palette__input-wrap">
          <Search size={19} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, results.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                select(results[activeIndex]);
              } else if (event.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Search queries, mutations, types, fields…"
            aria-label="Search queries, mutations, types, and fields"
            aria-controls="schema-search-results"
          />
          <button className="icon-button" onClick={onClose} aria-label="Close search">
            <X size={17} />
          </button>
        </div>

        <div className="palette__results" id="schema-search-results" role="listbox">
          {results.map((item, index) => (
            <button
              className={`palette__result ${index === activeIndex ? 'is-active' : ''}`}
              key={item.id}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(item)}
              role="option"
              aria-selected={index === activeIndex}
            >
              <TypeBadge kind={item.kind} />
              <span className="palette__result-copy">
                <span className="palette__result-title">
                  {item.context && <span>{item.context}.</span>}
                  {item.title}
                </span>
                <code>{item.signature}</code>
              </span>
              {index === activeIndex && <CornerDownLeft size={15} aria-hidden="true" />}
            </button>
          ))}
          {!items.length && (
            <div className="palette__empty palette__indexing">
              <LoaderCircle className="spin" size={20} />
              Indexing this schema…
            </div>
          )}
          {!!items.length && !results.length && (
            <div className="palette__empty">
              No schema matches for <strong>“{deferredQuery}”</strong>
            </div>
          )}
        </div>

        <div className="palette__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
          <span className="palette__indexed">{items.length.toLocaleString()} entries indexed</span>
        </div>
      </div>
    </div>
  );
}
