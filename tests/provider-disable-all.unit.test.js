import fs from 'fs';
import path from 'path';
import { describe, expect, test, jest, beforeAll } from '@jest/globals';

jest.mock('../src/providers/adapter.js', () => ({
    getRegisteredProviders: jest.fn(() => []),
    getServiceAdapter: jest.fn(() => ({
        generateContent: jest.fn(async () => ({ ok: true }))
    })),
    serviceInstances: {}
}));

let handleDisableAllProviders;

beforeAll(async () => {
    ({ handleDisableAllProviders } = await import('../src/ui-modules/provider-api.js'));
});

function createMockRes() {
    return {
        statusCode: 0,
        headers: {},
        body: '',
        writeHead(code, headers) {
            this.statusCode = code;
            this.headers = headers;
        },
        end(payload = '') {
            this.body = payload;
        }
    };
}

function createTempFilePath() {
    const tempDir = path.join('C:\\Users\\Administrator\\.codex\\memories', 'tmp-provider-tests');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    return path.join(
        tempDir,
        `provider_pools.disable-all.test.${Date.now()}.${Math.random().toString(16).slice(2)}.json`
    );
}

function safeUnlink(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch {}
    }
}

describe('disable all providers in group', () => {
    test('disables only current group providers and keeps child group unchanged', async () => {
        const tempFilePath = createTempFilePath();
        fs.writeFileSync(tempFilePath, JSON.stringify({
            'openai-custom': [
                { uuid: 'parent-1', customName: 'parent1', isDisabled: false },
                { uuid: 'parent-2', customName: 'parent2', isDisabled: true }
            ],
            'openai-custom-prod': [
                { uuid: 'child-1', customName: 'child1', isDisabled: false }
            ]
        }, null, 2), 'utf-8');

        const providerPoolManager = {
            providerPools: {},
            initializeProviderStatus: jest.fn()
        };
        const res = createMockRes();

        await handleDisableAllProviders(
            {},
            res,
            { PROVIDER_POOLS_FILE_PATH: tempFilePath },
            providerPoolManager,
            'openai-custom'
        );

        const payload = JSON.parse(res.body);
        const saved = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'));

        expect(res.statusCode).toBe(200);
        expect(payload.success).toBe(true);
        expect(payload.disabledCount).toBe(1);
        expect(saved['openai-custom'].every(provider => provider.isDisabled === true)).toBe(true);
        expect(saved['openai-custom-prod'][0].isDisabled).toBe(false);
        expect(providerPoolManager.initializeProviderStatus).toHaveBeenCalled();

        safeUnlink(tempFilePath);
    });

    test('returns 404 when provider group does not exist', async () => {
        const tempFilePath = createTempFilePath();
        fs.writeFileSync(tempFilePath, JSON.stringify({
            'openai-custom-prod': [
                { uuid: 'child-1', customName: 'child1', isDisabled: false }
            ]
        }, null, 2), 'utf-8');

        const res = createMockRes();

        await handleDisableAllProviders(
            {},
            res,
            { PROVIDER_POOLS_FILE_PATH: tempFilePath },
            { providerPools: {}, initializeProviderStatus: jest.fn() },
            'openai-custom'
        );

        const payload = JSON.parse(res.body);
        expect(res.statusCode).toBe(404);
        expect(payload.error.message).toContain('Provider group not found');

        safeUnlink(tempFilePath);
    });
});
