import Papa from 'papaparse';
import type { BodyMetric, StrongCompSet, WorkoutSession, AppData } from '../types';
import { isValid } from 'date-fns';

export const parseFileContent = async (
    jsonContent: string | null,
    csvContent: string | null
): Promise<AppData> => {
    let metrics: BodyMetric[] = [];
    let workouts: WorkoutSession[] = [];

    // Parse JSON
    if (jsonContent) {
        try {
            const data = JSON.parse(jsonContent);
            const measurements = data.measurements || [];
            const stats = data.stats || [];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parsedMeasurements = measurements.map((m: any) => ({
                date: m.date,
                weight: m.weight,
                fat: m.fat,
                muscle: m.muscle,
                water: m.water,
                bone: m.bone,
            }));

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parsedStats = stats.map((s: any) => ({
                date: s.day || s.date,
                weight: s.weight,
                fat: s.fat,
                muscle: s.muscle,
                bone: s.bone,
            }));

            // Merge and deduplicate by date (simple approach: just concat and sort, charts handle multiple points)
            metrics = [...parsedMeasurements, ...parsedStats].filter(m => m.date && isValid(new Date(m.date))).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        } catch (e) {
            console.error("Error parsing JSON", e);
        }
    }

    // Parse CSV
    if (csvContent) {
        try {
            const result = Papa.parse(csvContent, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true, // Automatically converts numbers
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawSets = result.data as any[];
            const validSets: StrongCompSet[] = rawSets
                .filter(row => row['Ordre de la série'] !== 'Minuteur de repos' && row['Date'])
                .map(row => ({
                    date: row['Date'],
                    workoutName: row["Nom de l'entraînement"],
                    duration: row['Durée'],
                    exerciseName: row["Nom de l'exercice"],
                    setOrder: parseInt(row['Ordre de la série']),
                    weight: typeof row['Poids'] === 'number' ? row['Poids'] : parseFloat(row['Poids'] || 0),
                    reps: typeof row['Réps'] === 'number' ? row['Réps'] : parseFloat(row['Réps'] || 0),
                    distance: row['Distance'],
                    seconds: row['Secondes'],
                    rpe: row['RPE'],
                    notes: row['Notes'],
                }));

            // Group by Workout Session
            const sessionMap = new Map<string, WorkoutSession>();

            validSets.forEach(set => {
                // Create an ID based on Date + WorkoutName
                // Note: Dates in finding might be precise.
                // The CSV date is "2025-08-21 12:52:22".
                const sessionId = `${set.date}-${set.workoutName}`;

                if (!sessionMap.has(sessionId)) {
                    sessionMap.set(sessionId, {
                        id: sessionId,
                        date: set.date,
                        name: set.workoutName,
                        duration: set.duration,
                        sets: [],
                        volume: 0
                    });
                }

                const session = sessionMap.get(sessionId)!;
                session.sets.push(set);

                // Volume calculation defined as Weight * Reps.
                // For bodyweight exercises, Weight might be 0.
                // User asked for performance tracking. Volume is a good metric.
                if (set.weight && set.reps) {
                    session.volume += (set.weight * set.reps);
                }
            });

            workouts = Array.from(sessionMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        } catch (e) {
            console.error("Error parsing CSV", e);
        }
    }

    return { metrics, workouts };
};
