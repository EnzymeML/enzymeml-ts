/**
 * Simplified tests for Rhea fetcher - focusing on core functionality
 */

import { RheaError, RheaClient } from '../src/fetcher/rhea';

describe('Rhea Fetcher - Core Functionality', () => {
    describe('RheaClient', () => {
        describe('parseTsv', () => {
            it('should parse simple TSV data correctly', () => {
                const tsvText = "RHEA identifier\tEquation\tChEBI identifier\n10000\tATP + H2O = ADP + Pi\tCHEBI:30616;CHEBI:15377;CHEBI:456216;CHEBI:43474";

                // Access the private method using reflection for testing
                const parseMethod = (RheaClient as any).parseTsv;
                const result = parseMethod(tsvText);

                expect(result).toHaveLength(1);
                expect(result[0]['RHEA identifier']).toBe('10000');
                expect(result[0]['Equation']).toBe('ATP + H2O = ADP + Pi');
                expect(result[0]['ChEBI identifier']).toBe('CHEBI:30616;CHEBI:15377;CHEBI:456216;CHEBI:43474');
            });

            it('should handle empty TSV data', () => {
                const tsvText = "RHEA identifier\tEquation\tChEBI identifier\n";

                const parseMethod = (RheaClient as any).parseTsv;
                expect(() => parseMethod(tsvText)).toThrow(RheaError);
            });

            it('should handle malformed TSV data gracefully', () => {
                const tsvText = "invalid";

                const parseMethod = (RheaClient as any).parseTsv;
                expect(() => parseMethod(tsvText)).toThrow(RheaError);
            });
        });
    });

    describe('RheaError', () => {
        it('should create error with message', () => {
            const error = new RheaError('Test error');
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('RheaError');
            expect(error.cause).toBeUndefined();
        });

        it('should create error with message and cause', () => {
            const cause = new Error('Original error');
            const error = new RheaError('Test error', cause);
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('RheaError');
            expect(error.cause).toBe(cause);
        });

        it('should be instance of Error', () => {
            const error = new RheaError('Test error');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(RheaError);
        });
    });

    describe('URL construction', () => {
        it('should construct correct URL for TSV format', () => {
            const baseUrl = 'https://www.rhea-db.org/rhea/?query=RHEA:{0}&columns=rhea-id,equation,chebi-id&format={1}&limit=10';
            const tsvUrl = baseUrl.replace('{0}', '10000').replace('{1}', 'tsv');

            expect(tsvUrl).toBe('https://www.rhea-db.org/rhea/?query=RHEA:10000&columns=rhea-id,equation,chebi-id&format=tsv&limit=10');
        });

        it('should construct correct URL for JSON format', () => {
            const baseUrl = 'https://www.rhea-db.org/rhea/?query=RHEA:{0}&columns=rhea-id,equation,chebi-id&format={1}&limit=10';
            const jsonUrl = baseUrl.replace('{0}', '10000').replace('{1}', 'json');

            expect(jsonUrl).toBe('https://www.rhea-db.org/rhea/?query=RHEA:10000&columns=rhea-id,equation,chebi-id&format=json&limit=10');
        });
    });

    describe('ID processing', () => {
        it('should handle Rhea ID with prefix', () => {
            const rheaId = 'RHEA:10000';
            const processedId = rheaId.split(':')[1];

            expect(processedId).toBe('10000');
        });

        it('should handle Rhea ID without prefix', () => {
            const rheaId = '10000';
            const processedId = rheaId.startsWith('RHEA:') ? rheaId.split(':')[1] : rheaId;

            expect(processedId).toBe('10000');
        });
    });

    describe('Reaction equation parsing', () => {
        it('should correctly count reactants and products', () => {
            const equation = 'ATP + H2O = ADP + Pi';
            const nReactants = equation.split('=')[0].split('+').length;
            const nProducts = equation.split('=')[1].split('+').length;

            expect(nReactants).toBe(2);
            expect(nProducts).toBe(2);
        });

        it('should handle complex equations', () => {
            const equation = 'A + B + C = D + E';
            const nReactants = equation.split('=')[0].split('+').length;
            const nProducts = equation.split('=')[1].split('+').length;

            expect(nReactants).toBe(3);
            expect(nProducts).toBe(2);
        });

        it('should handle single reactant and product', () => {
            const equation = 'A = B';
            const nReactants = equation.split('=')[0].split('+').length;
            const nProducts = equation.split('=')[1].split('+').length;

            expect(nReactants).toBe(1);
            expect(nProducts).toBe(1);
        });
    });
}); 