// Plain string list, not an enum — adding a new restriction here is the
// whole change needed (fighters.dietary_restrictions is a text[]).
export const DIETARY_RESTRICTIONS: { value: string; label: string }[] = [
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'lactose_intolerant', label: 'Lactose intolerant' },
  { value: 'gluten_free', label: 'Gluten-free' },
  { value: 'nut_allergy', label: 'Nut allergy' },
  { value: 'shellfish_allergy', label: 'Shellfish allergy' },
];

export function dietaryRestrictionLabel(value: string): string {
  return DIETARY_RESTRICTIONS.find((r) => r.value === value)?.label ?? value;
}
