export const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    // Allow international or specific formats to bypass
    if (value.startsWith('+') || value.startsWith('1')) return value;
    
    const input = value.replace(/\D/g, '');
    const constrainedInput = input.substring(0, 10);
    
    if (constrainedInput.length < 4) return constrainedInput;
    if (constrainedInput.length < 7) return `(${constrainedInput.slice(0, 3)}) ${constrainedInput.slice(3)}`;
    return `(${constrainedInput.slice(0, 3)}) ${constrainedInput.slice(3, 6)}-${constrainedInput.slice(6, 10)}`;
};