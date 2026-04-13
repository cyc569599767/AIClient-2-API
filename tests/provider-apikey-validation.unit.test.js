import { describe, expect, test } from '@jest/globals';
import { findDuplicateApiKey } from '../src/utils/provider-api-key-validator.js';

describe('provider api key duplicate validation', () => {
    test('detects duplicate API key across provider types', () => {
        const providerPools = {
            'openai-custom': [
                {
                    uuid: 'openai-1',
                    OPENAI_API_KEY: 'sk-shared-key'
                }
            ],
            'claude-custom': [
                {
                    uuid: 'claude-1',
                    CLAUDE_API_KEY: 'sk-claude-key'
                }
            ]
        };

        const conflict = findDuplicateApiKey(providerPools, 'claude-custom', 'claude-2', {
            CLAUDE_API_KEY: 'sk-shared-key'
        });

        expect(conflict).toEqual({
            currentApiKeyField: 'CLAUDE_API_KEY',
            existingApiKeyField: 'OPENAI_API_KEY',
            existingProviderType: 'openai-custom',
            existingProviderUuid: 'openai-1'
        });
    });

    test('ignores current provider when updating same uuid', () => {
        const providerPools = {
            'openai-custom': [
                {
                    uuid: 'openai-1',
                    OPENAI_API_KEY: 'sk-openai-key'
                }
            ]
        };

        const conflict = findDuplicateApiKey(providerPools, 'openai-custom', 'openai-1', {
            OPENAI_API_KEY: 'sk-openai-key'
        });

        expect(conflict).toBeNull();
    });

    test('ignores non API key fields', () => {
        const providerPools = {
            'grok-custom': [
                {
                    uuid: 'grok-1',
                    GROK_COOKIE_TOKEN: 'shared-secret-value'
                }
            ]
        };

        const conflict = findDuplicateApiKey(providerPools, 'openai-custom', 'openai-1', {
            OPENAI_API_KEY: 'shared-secret-value'
        });

        expect(conflict).toBeNull();
    });

    test('trims API key value before comparison', () => {
        const providerPools = {
            'openai-custom': [
                {
                    uuid: 'openai-1',
                    OPENAI_API_KEY: 'sk-trimmed-key'
                }
            ]
        };

        const conflict = findDuplicateApiKey(providerPools, 'claude-custom', 'claude-1', {
            CLAUDE_API_KEY: '   sk-trimmed-key   '
        });

        expect(conflict).not.toBeNull();
        expect(conflict.existingProviderType).toBe('openai-custom');
    });
});
