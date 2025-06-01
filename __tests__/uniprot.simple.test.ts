/**
 * Simplified tests for UniProt fetcher - focusing on core functionality
 */

import { processId, UniProtError } from '../src/fetcher/uniprot';

describe('UniProt Fetcher - Core Functionality', () => {
    describe('processId', () => {
        it('should process a simple name correctly', () => {
            expect(processId('hemoglobin')).toBe('hemoglobin');
        });

        it('should replace special characters with underscores', () => {
            expect(processId('protein kinase A')).toBe('protein_kinase_a');
        });

        it('should handle multiple consecutive special characters', () => {
            expect(processId('test--protein__name')).toBe('test_protein_name');
        });

        it('should trim leading and trailing underscores', () => {
            expect(processId('_protein_name_')).toBe('protein_name');
        });

        it('should handle mixed case', () => {
            expect(processId('DNA-binding protein')).toBe('dna_binding_protein');
        });

        it('should handle empty string', () => {
            expect(processId('')).toBe('');
        });

        it('should handle complex protein names', () => {
            expect(processId('Cytochrome c oxidase subunit I')).toBe('cytochrome_c_oxidase_subunit_i');
            expect(processId('β-lactamase')).toBe('lactamase');
            expect(processId('5\'-nucleotidase')).toBe('5_nucleotidase');
        });

        it('should handle protein names with EC numbers', () => {
            expect(processId('Alcohol dehydrogenase (EC 1.1.1.1)')).toBe('alcohol_dehydrogenase_ec_1_1_1_1');
        });

        it('should handle UniProt-specific protein names', () => {
            expect(processId('Insulin-like growth factor I')).toBe('insulin_like_growth_factor_i');
            expect(processId('Heat shock protein 70')).toBe('heat_shock_protein_70');
            expect(processId('Alpha/beta hydrolase')).toBe('alpha_beta_hydrolase');
        });
    });

    describe('UniProtError', () => {
        it('should create error with message', () => {
            const error = new UniProtError('Test error');
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('UniProtError');
            expect(error.cause).toBeUndefined();
        });

        it('should create error with message and cause', () => {
            const cause = new Error('Original error');
            const error = new UniProtError('Test error', cause);
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('UniProtError');
            expect(error.cause).toBe(cause);
        });

        it('should be instance of Error', () => {
            const error = new UniProtError('Test error');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(UniProtError);
        });
    });
}); 