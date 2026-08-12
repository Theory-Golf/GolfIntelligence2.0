// US state / territory lookup used to interpret "City, ST" location input and
// to normalise whatever a geocoder hands back into a two-letter abbreviation.

export const US_STATES: ReadonlyArray<{ abbr: string; name: string }> = [
  { abbr: 'AL', name: 'Alabama' },
  { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' },
  { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' },
  { abbr: 'DE', name: 'Delaware' },
  { abbr: 'DC', name: 'District of Columbia' },
  { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' },
  { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' },
  { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' },
  { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' },
  { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' },
  { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' },
  { abbr: 'WY', name: 'Wyoming' },
  { abbr: 'PR', name: 'Puerto Rico' },
  { abbr: 'VI', name: 'U.S. Virgin Islands' },
  { abbr: 'GU', name: 'Guam' },
];

const BY_ABBR = new Map(US_STATES.map((s) => [s.abbr, s]));
const BY_NAME = new Map(US_STATES.map((s) => [s.name.toLowerCase(), s]));

/**
 * Resolve a state token — "tx", "TX", "texas", "Texas" — to its abbreviation.
 * Returns null when the token names no US state.
 */
export function stateAbbrFrom(token: string | null | undefined): string | null {
  if (!token) return null;
  const t = token.trim();
  if (!t) return null;
  const upper = t.toUpperCase();
  if (BY_ABBR.has(upper)) return upper;
  return BY_NAME.get(t.toLowerCase())?.abbr ?? null;
}

export function stateNameFrom(token: string | null | undefined): string | null {
  const abbr = stateAbbrFrom(token);
  return abbr ? (BY_ABBR.get(abbr)?.name ?? null) : null;
}

/**
 * Longest state name is three words ("U.S. Virgin Islands"), so a trailing
 * state can be split off a comma-less query by testing the last 1–3 words.
 */
export const MAX_STATE_WORDS = 3;
