/** Color choices for the preview creator. Labels are for the controls; only colors are applied. */

export const HAIR_CHOICES = [
  { label: 'Auburn', colors: { hair: '#8C3F22', hairHighlight: '#E0A45A' } },
  { label: 'Black', colors: { hair: '#1A120E', hairHighlight: '#4A3428' } },
  { label: 'Silver', colors: { hair: '#C5CCD4', hairHighlight: '#F4F7FA' } },
  { label: 'Copper', colors: { hair: '#B4532A', hairHighlight: '#F0A36A' } },
] as const;

export const SKIN_CHOICES = [
  { label: 'Warm', colors: { skin: '#E2B088', skinShadow: '#C4846A' } },
  { label: 'Fair', colors: { skin: '#F3D0B5', skinShadow: '#E0B090' } },
  { label: 'Deep', colors: { skin: '#8D5A3C', skinShadow: '#6B402C' } },
  { label: 'Olive', colors: { skin: '#C4A574', skinShadow: '#A68558' } },
] as const;

export const COLOR_CHOICES = [
  { label: 'Spruce cloth', colors: { tunic: '#1F6B52', tunicLight: '#3D946C' } },
  { label: 'Wine cloth', colors: { tunic: '#6E2438', tunicLight: '#A34B62' } },
  { label: 'Sea eyes', colors: { eye: '#1F4D45' } },
  { label: 'Amber eyes', colors: { eye: '#8A5A12' } },
] as const;
