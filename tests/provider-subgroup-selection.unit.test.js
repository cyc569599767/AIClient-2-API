
import { describe, expect, test, jest, beforeAll, afterEach } from '@jest/globals';

jest.mock('../src/providers/adapter.js', () => ({
    getServiceAdapter: jest.fn(() => ({
        generateContent: jest.fn(async () => ({ ok: true }))
    }))
}));

let ProviderPoolManager;
let managerUnderTest = null;

beforeAll(async () => {
    ({ ProviderPoolManager } = await import('../src/providers/provider-pool-manager.js'));
});

afterEach(() => {
    if (!managerUnderTest) return;
    if (managerUnderTest.saveTimer) {
        clearTimeout(managerUnderTest.saveTimer);
        managerUnderTest.saveTimer = null;
    }
    for (const timer of Object.values(managerUnderTest.refreshBufferTimers || {})) {
        if (timer) clearTimeout(timer);
    }
    managerUnderTest = null;
});

function createProvider(uuid) {
    return {
        uuid,
        isHealthy: true,
        isDisabled: false,
        usageCount: 0,
        errorCount: 0,
        lastUsed: null
    };
}

describe('provider subgroup selection', () => {
    test('prefers parent group when parent has matching provider', async () => {
        const manager = new ProviderPoolManager(
            {
                'openai-custom': [
                    {
                        ...createProvider('parent-1'),
                        supportedModels: ['gpt-5.4']
                    }
                ],
                'openai-custom-10': [
                    {
                        ...createProvider('child-10-1'),
                        supportedModels: ['gpt-5.4']
                    }
                ],
                'openai-custom-2': [
                    {
                        ...createProvider('child-2-1'),
                        supportedModels: ['gpt-5.4']
                    }
                ]
            },
            { globalConfig: {} }
        );
        managerUnderTest = manager;
        manager._debouncedSave = () => {};

        const result = await manager.selectProviderWithFallback('openai-custom', 'gpt-5.4', {
            skipUsageCount: true,
            disableConfiguredFallback: true
        });

        expect(result).not.toBeNull();
        expect(result.actualProviderType).toBe('openai-custom');
        expect(result.config.uuid).toBe('parent-1');
    });

    test('falls back to child groups by sorted order when parent does not satisfy requested model', async () => {
        const manager = new ProviderPoolManager(
            {
                'openai-custom': [
                    {
                        ...createProvider('parent-1'),
                        supportedModels: ['gpt-4o-mini']
                    }
                ],
                'openai-custom-10': [
                    {
                        ...createProvider('child-10-1'),
                        supportedModels: ['gpt-5.4']
                    }
                ],
                'openai-custom-2': [
                    {
                        ...createProvider('child-2-1'),
                        supportedModels: ['gpt-5.4']
                    }
                ]
            },
            { globalConfig: {} }
        );
        managerUnderTest = manager;
        manager._debouncedSave = () => {};

        const result = await manager.selectProviderWithFallback('openai-custom', 'gpt-5.4', {
            skipUsageCount: true,
            disableConfiguredFallback: true
        });

        expect(result).not.toBeNull();
        expect(result.actualProviderType).toBe('openai-custom-2');
        expect(result.config.uuid).toBe('child-2-1');
    });

    test('falls back to child group when parent group has no providers', async () => {
        const manager = new ProviderPoolManager(
            {
                'openai-custom': [],
                'openai-custom-prod': [createProvider('child-1')]
            },
            { globalConfig: {} }
        );
        managerUnderTest = manager;

        manager._debouncedSave = () => {};

        const result = await manager.selectProviderWithFallback('openai-custom', 'gpt-5.4', {
            skipUsageCount: true,
            disableConfiguredFallback: true
        });

        expect(result).not.toBeNull();
        expect(result.actualProviderType).toBe('openai-custom-prod');
        expect(result.config.uuid).toBe('child-1');
    });
});
