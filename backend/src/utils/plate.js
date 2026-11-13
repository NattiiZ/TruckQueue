export const PLATE_PATTERN = /^\d{2}-\d{1,4}$/;
export const PLATE_EXAMPLE = '70-1234';

/** Normalize plate format */
export function normalizePlate(input) 
{
  const s = String(input ?? '').replace(/[\s-]/g, '');
  return /^\d{3,6}$/.test(s) ? `${s.slice(0, 2)}-${s.slice(2)}` : s;
}

export const isValidPlate = (plate) => PLATE_PATTERN.test(plate);
