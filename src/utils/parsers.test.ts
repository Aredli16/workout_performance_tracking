import { describe, it, expect } from 'vitest';
import { parseFileContent } from './parsers';

describe('parseFileContent', () => {
    it('should parse valid JSON fitness data correctly', async () => {
        const jsonContent = JSON.stringify({
            measurements: [
                { date: '2025-01-01', weight: 80.5, fat: 15, muscle: 40 },
                { date: '2025-01-02', weight: 80.2, fat: 14.8, muscle: 40.1 }
            ]
        });

        const result = await parseFileContent(jsonContent, null);

        expect(result.metrics).toHaveLength(2);
        expect(result.metrics[0].weight).toBe(80.5);
        expect(result.metrics[1].weight).toBe(80.2);
        expect(result.workouts).toHaveLength(0);
    });

    it('should parse valid CSV workout data correctly', async () => {
        const csvContent = `Date,Nom de l'entraînement,Durée,Nom de l'exercice,Ordre de la série,Poids,Réps,Distance,Secondes,RPE,Notes
2025-01-01 10:00:00,Full Body,60m,Squat,1,100,5,0,0,8,
2025-01-01 10:00:00,Full Body,60m,Squat,2,100,5,0,0,8.5,
2025-01-03 10:00:00,Upper,45m,Bench Press,1,80,8,0,0,9,`;

        const result = await parseFileContent(null, csvContent);

        // Should group into 2 sessions
        expect(result.workouts).toHaveLength(2);

        // First session: Jan 1st
        const workout1 = result.workouts[0];
        expect(workout1.name).toBe('Full Body');
        expect(workout1.sets).toHaveLength(2);
        expect(workout1.sets[0].exerciseName).toBe('Squat');
        expect(workout1.sets[0].weight).toBe(100);

        // Second session: Jan 3rd
        const workout2 = result.workouts[1];
        expect(workout2.name).toBe('Upper');
        expect(workout2.sets).toHaveLength(1);
        expect(workout2.sets[0].exerciseName).toBe('Bench Press');
    });

    it('should calculate volume properly', async () => {
        const csvContent = `Date,Nom de l'entraînement,Durée,Nom de l'exercice,Ordre de la série,Poids,Réps,Distance,Secondes,RPE,Notes
2025-01-01 10:00:00,Volume Test,60m,Squat,1,100,5,0,0,8,`; // 100 * 5 = 500 volume

        const result = await parseFileContent(null, csvContent);
        expect(result.workouts[0].volume).toBe(500);
    });

    it('should handle mixed input', async () => {
        const jsonContent = JSON.stringify({ measurements: [{ date: '2025-01-01', weight: 80 }] });
        const csvContent = `Date,Nom de l'entraînement,Durée,Nom de l'exercice,Ordre de la série,Poids,Réps,Distance,Secondes,RPE,Notes
2025-01-01 10:00:00,Test,60m,Squat,1,100,5,0,0,8,`;

        const result = await parseFileContent(jsonContent, csvContent);

        expect(result.metrics).toHaveLength(1);
        expect(result.workouts).toHaveLength(1);
    });
});
