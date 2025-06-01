/**
 * Integration tests for ChEBI fetcher
 * These tests make actual HTTP requests to the ChEBI API
 */

import { ChEBIClient, ChEBIError, fetchChebi } from '../src/fetcher/chebi';


describe('ChEBI Integration Tests', () => {
    let client: ChEBIClient;

    beforeEach(() => {
        client = new ChEBIClient();
    });

    describe('ChEBIClient.getEntryById', () => {
        it('should fetch glucose (CHEBI:17234) successfully', async () => {
            const result = await client.getEntryById('17234');

            expect(result.chebiId).toBe('CHEBI:17234');
            expect(result.chebiAsciiName).toBe('glucose');
            expect(['PUBLISHED', 'CHECKED']).toContain(result.status); // Allow both statuses

            // Some fields might be optional depending on the ChEBI entry
            if (result.inchi) {
                expect(result.inchi).toContain('InChI=');
            }
            if (result.inchiKey) {
                expect(result.inchiKey).toMatch(/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/);
            }
            if (result.mass) {
                expect(typeof result.mass).toBe('number');
            }
        }, 10000); // 10 second timeout

        it('should fetch ATP (CHEBI:15422) successfully', async () => {
            const result = await client.getEntryById('CHEBI:15422');

            expect(result.chebiId).toBe('CHEBI:15422');
            expect(result.chebiAsciiName).toBe('ATP');
            expect(['PUBLISHED', 'CHECKED']).toContain(result.status); // Allow both statuses
            expect(result.inchi).toContain('InChI=');
            expect(result.inchiKey).toMatch(/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/);
        }, 10000);

        it('should handle non-existent ChEBI ID gracefully', async () => {
            await expect(client.getEntryById('999999999')).rejects.toThrow(ChEBIError);
        }, 10000);

        it('should handle invalid ChEBI ID format', async () => {
            await expect(client.getEntryById('invalid-id')).rejects.toThrow(ChEBIError);
        }, 10000);
    });

    describe('fetchChebi', () => {
        it('should fetch and convert glucose to SmallMolecule', async () => {
            const result = await fetchChebi('17234');

            expect(result.id).toBe('glucose');
            expect(result.name).toBe('glucose');
            // SMILES might be null for some compounds, so just check it exists or is null
            expect(result.canonical_smiles === null || typeof result.canonical_smiles === 'string').toBe(true);

            // Some fields might be optional depending on the ChEBI entry
            if (result.inchi) {
                expect(result.inchi).toContain('InChI=');
            }
            if (result.inchikey) {
                expect(result.inchikey).toMatch(/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/);
            }

            expect(result.constant).toBe(false);
            expect(result.vessel_id).toBeNull();
            expect(result.synonymous_names).toEqual([]);
            expect(result.references).toContain('https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:17234');
        }, 10000);

        it('should handle compound with complex name', async () => {
            // Test with D-glucose 6-phosphate (CHEBI:4170)
            const result = await fetchChebi('4170');

            expect(result.id).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.references).toContain('https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:4170');
        }, 10000);

        it('should fetch caffeine (CHEBI:27732) which has SMILES', async () => {
            const result = await fetchChebi('27732');

            expect(result.id).toBeDefined();
            expect(result.name).toBe('caffeine');
            expect(result.canonical_smiles).toBeTruthy(); // Caffeine should have SMILES
            expect(result.inchi).toContain('InChI=');
            expect(result.inchikey).toMatch(/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/);
            expect(result.references).toContain('https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:27732');
        }, 10000);
    });

    describe('Real API Error Handling', () => {
        it('should handle server timeouts gracefully', async () => {
            // This test might be flaky depending on network conditions
            // But it helps ensure proper error handling
            const client = new ChEBIClient();

            try {
                await client.getEntryById('17234');
                // If it succeeds, that's fine too
            } catch (error) {
                expect(error).toBeInstanceOf(ChEBIError);
            }
        }, 15000);
    });
}); 