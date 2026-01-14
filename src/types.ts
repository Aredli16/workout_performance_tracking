export interface BodyMetric {
  date: string; // ISO string
  weight?: number;
  fat?: number;
  muscle?: number;
  water?: number;
  bone?: number;
}

export interface StrongCompSet {
  date: string;
  workoutName: string;
  duration: string;
  exerciseName: string;
  setOrder: number;
  weight: number;
  reps: number;
  distance?: number;
  seconds?: number;
  rpe?: number;
  notes?: string;
}

// Aggregated Workout Session
export interface WorkoutSession {
  id: string; // Unique ID (date + workoutName)
  date: string;
  name: string;
  duration: string;
  sets: StrongCompSet[];
  volume: number; // Total volume
}

export interface AppData {
  metrics: BodyMetric[];
  workouts: WorkoutSession[];
}
