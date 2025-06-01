/**
 * Simplified tests for ChEBI fetcher - focusing on core functionality
 */

import { processId, ChEBIError } from '../src/fetcher/chebi';

describe('ChEBI Fetcher - Core Functionality', () => {
    describe('processId', () => {
        it('should process a simple name correctly', () => {
            expect(processId('glucose')).toBe('glucose');
        });

        it('should replace special characters with underscores', () => {
            expect(processId('D-glucose 6-phosphate')).toBe('d_glucose_6_phosphate');
        });

        it('should handle multiple consecutive special characters', () => {
            expect(processId('test--name__here')).toBe('test_name_here');
        });

        it('should trim leading and trailing underscores', () => {
            expect(processId('_test_name_')).toBe('test_name');
        });

        it('should handle mixed case', () => {
            expect(processId('ATP-Mg2+')).toBe('atp_mg2');
        });

        it('should handle empty string', () => {
            expect(processId('')).toBe('');
        });

        it('should handle complex chemical names', () => {
            expect(processId('D-glucose 6-phosphate')).toBe('d_glucose_6_phosphate');
            expect(processId('ATP-Mg2+')).toBe('atp_mg2');
            expect(processId('(2S)-2-amino-3-hydroxypropanoic acid')).toBe('2s_2_amino_3_hydroxypropanoic_acid');
        });
    });

    describe('ChEBIError', () => {
        it('should create error with message', () => {
            const error = new ChEBIError('Test error');
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('ChEBIError');
            expect(error.cause).toBeUndefined();
        });

        it('should create error with message and cause', () => {
            const cause = new Error('Original error');
            const error = new ChEBIError('Test error', cause);
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('ChEBIError');
            expect(error.cause).toBe(cause);
        });

        it('should be instance of Error', () => {
            const error = new ChEBIError('Test error');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(ChEBIError);
        });
    });
}); 