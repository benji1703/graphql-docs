import { describe, expect, it } from 'vitest';
import { fuzzySearch } from './fuzzySearch';
import type { SearchItem } from './schema';

const item = (title: string, context: string, kind: SearchItem['kind'] = 'field'): SearchItem => ({
  id: `${context}.${title}`,
  title,
  context,
  kind,
  description: '',
  signature: title,
  path: `/docs/${context}/${title}`,
  keywords: `${context}.${title} ${context} ${title}`.toLowerCase(),
});

describe('fuzzySearch', () => {
  const items = [
    item('userProfile', 'Query', 'query'),
    item('profiles', 'User'),
    item('preferredName', 'User'),
    item('profilePhoto', 'Account'),
  ];

  it('prioritizes exact names and prefixes', () => {
    expect(fuzzySearch(items, 'profiles').map((result) => result.title)).toEqual(['profiles']);
    expect(fuzzySearch(items, 'profile')[0].title).toBe('profiles');
  });

  it('matches qualified names and incomplete spellings', () => {
    expect(fuzzySearch(items, 'query.user')[0].title).toBe('userProfile');
    expect(fuzzySearch(items, 'usrprfle')[0].title).toBe('userProfile');
  });

  it('requires at least two characters and respects limits', () => {
    expect(fuzzySearch(items, 'u')).toEqual([]);
    expect(fuzzySearch(items, 'profile', 2)).toHaveLength(2);
  });
});
