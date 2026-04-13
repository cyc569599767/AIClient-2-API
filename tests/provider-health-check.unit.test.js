import fs from 'fs';
import path from 'path';
import { describe, expect, test, jest, afterEach, beforeAll } from '@jest/globals';

jest.mock('../src/providers/adapter.js', () => ({
    getRegisteredProviders: jest.fn(() => []),
    getServiceAdapter: jest.fn(() => ({
        generateContent: jest.fn(async () => ({ ok: true }))
    })),
    serviceInstances: {}
}));

let handleHealthCheck;
let handleSingleProviderHealthCheck;
let ProviderPoolManager;

beforeAll(async () => {
    ({ handleHealthCheck, handleSingleProviderHealthCheck } = await import('../src/ui-modules/provider-api.js'));
    ({ ProviderPoolManager } = await import('../src/providers/provider-pool-manager.js'));
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

const tempFilePath = path.join(process.cwd(), 'configs', 'provider_pools.healthcheck.test.json');

afterEach(() => {
    if (fs.existsSync(tempFilePath)) {
        try {
            fs.unlinkSync(tempFilePath);
        } catch (error) {
            // Windows 环境下偶发文件句柄占用，忽略清理失败，避免影响断言结果
        }
    }
});

describe('provider health check behavior', () => {
    test('batch health check ignores checkHealth=false and still runs manual checks', async () => {
        const providerType = 'openai-custom';
        const providerStatus = [
            {
                config: {
                    uuid: 'disabled-node',
                    isHealthy: false,
                    isDisabled: true,
                    checkHealth: true,
                    usageCount: 2,
                    errorCount: 1
                }
            },
            {
                config: {
                    uuid: 'skipped-node',
                    isHealthy: false,
                    isDisabled: false,
                    checkHealth: false,
                    usageCount: 3,
                    errorCount: 1
                }
            },
            {
                config: {
                    uuid: 'checked-node',
                    isHealthy: false,
                    isDisabled: false,
                    checkHealth: true,
                    checkModelName: 'gpt-4o-mini',
                    usageCount: 4,
                    errorCount: 2
                }
            }
        ];

        const mockProviderPoolManager = {
            providerStatus: {
                [providerType]: providerStatus
            },
            _checkProviderHealth: jest.fn(async () => ({
                success: true,
                modelName: 'gpt-4o-mini'
            })),
            markProviderHealthy: jest.fn((type, providerConfig, resetUsageCount = false, healthCheckModel = null, countAsUsage = true) => {
                const target = providerStatus.find(item => item.config.uuid === providerConfig.uuid);
                if (!target) return;
                target.config.isHealthy = true;
                target.config.errorCount = 0;
                if (resetUsageCount) {
                    target.config.usageCount = 0;
                } else if (countAsUsage) {
                    target.config.usageCount++;
                }
                if (healthCheckModel) {
                    target.config.lastHealthCheckModel = healthCheckModel;
                }
            }),
            markProviderUnhealthy: jest.fn(),
            markProviderUnhealthyImmediately: jest.fn()
        };

        const res = createMockRes();
        await handleHealthCheck(
            {},
            res,
            { PROVIDER_POOLS_FILE_PATH: tempFilePath },
            mockProviderPoolManager,
            providerType
        );

        const payload = JSON.parse(res.body);
        expect(res.statusCode).toBe(200);
        expect(payload.success).toBe(true);
        expect(payload.successCount).toBe(2);
        expect(payload.failCount).toBe(1);
        expect(payload.skippedCount).toBe(0);
        expect(payload.results).toHaveLength(3);

        expect(mockProviderPoolManager._checkProviderHealth).toHaveBeenCalledTimes(2);
        expect(mockProviderPoolManager.markProviderHealthy).toHaveBeenCalledTimes(2);
        expect(mockProviderPoolManager.markProviderHealthy.mock.calls[0][4]).toBe(false);
        expect(mockProviderPoolManager.markProviderUnhealthyImmediately).toHaveBeenCalledTimes(1);

        const disabledResult = payload.results.find(item => item.uuid === 'disabled-node');
        expect(disabledResult.success).toBe(false);
        expect(disabledResult.healthy).toBe(false);
        expect(disabledResult.reason).toBe('disabled');
        expect(disabledResult.isWarning).toBe(true);

        const skippedResult = payload.results.find(item => item.uuid === 'skipped-node');
        expect(skippedResult.success).toBe(true);
        expect(skippedResult.healthy).toBe(true);
        expect(skippedResult.reason).toBeUndefined();
        expect(skippedResult.isWarning).toBeUndefined();

        const checkedNode = providerStatus.find(item => item.config.uuid === 'checked-node');
        expect(checkedNode.config.usageCount).toBe(4);
    });

    test('batch health check with no unhealthy providers returns skippedCount=0', async () => {
        const providerType = 'openai-custom';
        const mockProviderPoolManager = {
            providerStatus: {
                [providerType]: [
                    {
                        config: {
                            uuid: 'healthy-node',
                            isHealthy: true,
                            isDisabled: false
                        }
                    }
                ]
            }
        };

        const res = createMockRes();
        await handleHealthCheck(
            {},
            res,
            { PROVIDER_POOLS_FILE_PATH: tempFilePath },
            mockProviderPoolManager,
            providerType
        );

        const payload = JSON.parse(res.body);
        expect(res.statusCode).toBe(200);
        expect(payload.success).toBe(true);
        expect(payload.successCount).toBe(0);
        expect(payload.failCount).toBe(0);
        expect(payload.skippedCount).toBe(0);
        expect(payload.results).toEqual([]);
    });

    test('single health check still runs when checkHealth=false', async () => {
        const providerType = 'openai-custom';
        const providerUuid = 'single-warning-node';
        const providerStatus = [
            {
                config: {
                    uuid: providerUuid,
                    isHealthy: false,
                    isDisabled: false,
                    checkHealth: false,
                    usageCount: 1,
                    errorCount: 1
                }
            }
        ];

        const mockProviderPoolManager = {
            providerStatus: {
                [providerType]: providerStatus
            },
            _checkProviderHealth: jest.fn(async () => ({
                success: true,
                modelName: 'gpt-4o-mini'
            })),
            markProviderHealthy: jest.fn((type, providerConfig, resetUsageCount = false, healthCheckModel = null, countAsUsage = true) => {
                const target = providerStatus.find(item => item.config.uuid === providerConfig.uuid);
                if (!target) return;
                target.config.isHealthy = true;
                target.config.errorCount = 0;
                if (healthCheckModel) {
                    target.config.lastHealthCheckModel = healthCheckModel;
                }
            }),
            markProviderUnhealthyImmediately: jest.fn((type, providerConfig, message) => {
                const target = providerStatus.find(item => item.config.uuid === providerConfig.uuid);
                if (!target) return;
                target.config.isHealthy = false;
                target.config.lastErrorMessage = message;
            })
        };

        const res = createMockRes();
        await handleSingleProviderHealthCheck(
            {},
            res,
            { PROVIDER_POOLS_FILE_PATH: tempFilePath },
            mockProviderPoolManager,
            providerType,
            providerUuid
        );

        const payload = JSON.parse(res.body);
        expect(res.statusCode).toBe(200);
        expect(payload.success).toBe(true);
        expect(payload.healthy).toBe(true);
        expect(payload.isWarning).toBe(false);
        expect(payload.reason).toBeNull();
        expect(mockProviderPoolManager._checkProviderHealth).toHaveBeenCalledTimes(1);
        expect(mockProviderPoolManager.markProviderHealthy).toHaveBeenCalledTimes(1);
        expect(mockProviderPoolManager.markProviderUnhealthyImmediately).toHaveBeenCalledTimes(0);
    });

    test('markProviderHealthy supports countAsUsage=false', () => {
        const manager = new ProviderPoolManager({}, { globalConfig: {} });
        manager._debouncedSave = () => {};
        manager.providerStatus['openai-custom'] = [
            {
                config: {
                    uuid: 'node-1',
                    isHealthy: false,
                    usageCount: 7,
                    errorCount: 3,
                    refreshCount: 1,
                    needsRefresh: true,
                    lastErrorTime: new Date().toISOString(),
                    _lastSelectionSeq: 10
                },
                uuid: 'node-1',
                type: 'openai-custom',
                state: {
                    activeCount: 0,
                    waitingCount: 0,
                    queue: []
                }
            }
        ];

        manager.markProviderHealthy('openai-custom', { uuid: 'node-1' }, false, 'gpt-4.1', false);
        expect(manager.providerStatus['openai-custom'][0].config.usageCount).toBe(7);

        manager.markProviderHealthy('openai-custom', { uuid: 'node-1' }, false, 'gpt-4.1', true);
        expect(manager.providerStatus['openai-custom'][0].config.usageCount).toBe(8);
    });

    test('formats health check error with status and response detail', () => {
        const manager = new ProviderPoolManager({}, { globalConfig: {} });
        const formatted = manager._formatHealthCheckError({
            message: 'Request failed with status code 401',
            response: {
                status: 401,
                data: {
                    error: {
                        message: 'Invalid API key provided'
                    }
                }
            }
        });

        expect(formatted).toContain('HTTP 401');
        expect(formatted).toContain('Invalid API key provided');
    });
});
