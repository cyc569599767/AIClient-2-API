const API_KEY_FIELD_PATTERN = /(?:^|_)API_KEY$/i;

function extractProviderApiKeyEntries(providerConfig = {}) {
    if (!providerConfig || typeof providerConfig !== 'object') {
        return [];
    }

    const apiKeyEntries = [];
    for (const [key, value] of Object.entries(providerConfig)) {
        if (!API_KEY_FIELD_PATTERN.test(key)) {
            continue;
        }
        if (typeof value !== 'string') {
            continue;
        }
        const normalized = value.trim();
        if (!normalized) {
            continue;
        }
        apiKeyEntries.push({
            field: key,
            value: normalized
        });
    }
    return apiKeyEntries;
}

export function findDuplicateApiKey(providerPools = {}, providerType = '', providerUuid = '', providerConfig = {}) {
    const currentApiKeyEntries = extractProviderApiKeyEntries(providerConfig);
    if (currentApiKeyEntries.length === 0) {
        return null;
    }

    const currentApiKeyValues = new Set(currentApiKeyEntries.map(entry => entry.value));
    for (const [existingProviderType, providers] of Object.entries(providerPools || {})) {
        if (!Array.isArray(providers)) {
            continue;
        }

        for (const existingProvider of providers) {
            if (!existingProvider || typeof existingProvider !== 'object') {
                continue;
            }

            const existingUuid = existingProvider.uuid || '';
            if (existingProviderType === providerType && existingUuid === providerUuid) {
                continue;
            }

            const existingApiKeyEntries = extractProviderApiKeyEntries(existingProvider);
            for (const existingEntry of existingApiKeyEntries) {
                if (!currentApiKeyValues.has(existingEntry.value)) {
                    continue;
                }

                const currentEntry = currentApiKeyEntries.find(entry => entry.value === existingEntry.value);
                return {
                    currentApiKeyField: currentEntry?.field || null,
                    existingApiKeyField: existingEntry.field,
                    existingProviderType,
                    existingProviderUuid: existingUuid || null
                };
            }
        }
    }

    return null;
}
