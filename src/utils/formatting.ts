export const formatPhoneNumber = (value: string, countryCode: string = '+1') => {
    if (!value) return value;

    // If it's NOT US/Canada (+1), do NOT truncate or force (XXX) format.
    // Just return the input so international numbers display fully.
    if (countryCode && countryCode !== '+1') {
        return value;
    }

    // US/Canada Formatting ONLY
    const input = value.replace(/\D/g, '');
    const constrainedInput = input.substring(0, 10);
    
    if (constrainedInput.length < 4) return constrainedInput;
    if (constrainedInput.length < 7) return `(${constrainedInput.slice(0, 3)}) ${constrainedInput.slice(3)}`;
    return `(${constrainedInput.slice(0, 3)}) ${constrainedInput.slice(3, 6)}-${constrainedInput.slice(6, 10)}`;
};