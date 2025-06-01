/**
 * Simplified tests for PDB fetcher - focusing on core functionality
 */

import { processId, PDBError } from '../src/fetcher/pdb';

describe('PDB Fetcher - Core Functionality', () => {
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
    });

    describe('PDBError', () => {
        it('should create error with message', () => {
            const error = new PDBError('Test error');
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('PDBError');
            expect(error.cause).toBeUndefined();
        });

        it('should create error with message and cause', () => {
            const cause = new Error('Original error');
            const error = new PDBError('Test error', cause);
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('PDBError');
            expect(error.cause).toBe(cause);
        });

        it('should be instance of Error', () => {
            const error = new PDBError('Test error');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(PDBError);
        });
    });
}); 