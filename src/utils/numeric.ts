export function normalizePositiveNumberInput(rawValue: string, allowDecimal = true) {
  let value = rawValue.replace(',', '.').replace(/[^\d.]/g, '');

  if (value === '') {
    return { value: '', error: '' };
  }

  const parts = value.split('.');
  if (parts.length > 2) {
    value = `${parts[0]}.${parts.slice(1).join('')}`;
  }

  if (!allowDecimal) {
    value = value.split('.')[0] ?? '';
  }

  let [integerPart = '', decimalPart = ''] = value.split('.');
  integerPart = integerPart.replace(/^0+(?=\d)/, '');
  if (integerPart === '') {
    integerPart = '0';
  }

  if (decimalPart && allowDecimal) {
    decimalPart = decimalPart.slice(0, 2);
  } else {
    decimalPart = '';
  }

  const normalized = allowDecimal && value.includes('.')
    ? `${integerPart}.${decimalPart}`
    : integerPart;

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return {
      value: '0',
      error: 'Solo se permiten números válidos iguales o mayores a 0.',
    };
  }

  return { value: normalized, error: '' };
}
