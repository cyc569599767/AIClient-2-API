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

let handleDeleteProvider;

beforeAll(async () => {
    ({ handleDeleteProvider } = await import('../src/ui-modules/provider-api.js'));
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
    return path.join(
        process.cwd(),
        'configs',
        `provider_pools.delete-subgroup.test.${Date.now()}.${Math.random().toString(16).slice(2)}.json`
    );
}

describe('delete provider subgroup behavior', () => {
    test('keeps custom child group when last provider is removed', async () => {
        const tempFilePath = createTempFilePath();
        const providerType = 'openai-custom-prod';
        fs.writeFileSync(tempFilePath, JSON.stringify({
            [providerType]: [{ uuid: 'child-node-1', customName: 'node1' }]
        }, null, 2), 'utf-8');

        const res = createMockRes();
        await handleDeleteProvider(
            {},
            res,
            { PROVIDER_POOLS_FILE_PATH: tempFilePath },
            { providerPools: {}, initializeProviderStatus: jest.fn() },
            providerType,
            'child-node-1'
        );

        const payload = JSON.parse(res.body);
        const saved = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'));
        expect(res.statusCode).toBe(200);
        expect(payload.success).toBe(true);
        expect(saved).toHaveProperty(providerType);
        expect(saved[providerType]).toEqual([]);

        if (fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch {}
        }
    });

    test('still removes base group when last provider is removed', async () => {
        const tempFilePath = createTempFilePath();
        const providerType = 'openai-custom';
        fs.writeFileSync(tempFilePath, JSON.stringify({
            [providerType]: [{ uuid: 'base-node-1', customName: 'node1' }]
        }, null, 2), 'utf-8');

        const res = createMockRes();
        await handleDeleteProvider(
            {},
            res,
            { PROVIDER_POOLS_FILE_PATH: tempFilePath },
            { providerPools: {}, initializeProviderStatus: jest.fn() },
            providerType,
            'base-node-1'
        );

        const payload = JSON.parse(res.body);
        const saved = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'));
        expect(res.statusCode).toBe(200);
        expect(payload.success).toBe(true);
        expect(saved[providerType]).toBeUndefined();

        if (fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch {}
        }
    });
});
