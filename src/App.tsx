import React, { useEffect, useState, useMemo } from 'react';
import { parseFileContent } from './utils/parsers';
import type { AppData } from './types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, AreaChart, Area, Legend
} from 'recharts';
import { Upload, Activity, Scale, Dumbbell, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import { format, startOfWeek, isSameWeek } from 'date-fns';
import { fr } from 'date-fns/locale';


// Custom AutoSizer to fix Recharts responsiveness issues
const ChartAutoSizer = ({
  height,
  children
}: {
  height: number | string,
  children: (size: { width: number, height: number }) => React.ReactNode
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setDimensions({
            width: Math.round(entry.contentRect.width),
            height: Math.round(entry.contentRect.height)
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height }} className="min-w-0">
      {dimensions.width > 0 && dimensions.height > 0 && children(dimensions)}
    </div>
  );
};

function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<string>('Squat (Barbell)');

  // Load default data on mount
  useEffect(() => {
    const loadDefaultData = async () => {
      try {
        const [jsonRes, csvRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}data/my-fitness-data.json`).then(res => res.ok ? res.text() : null),
          fetch(`${import.meta.env.BASE_URL}data/strong_workouts.csv`).then(res => res.ok ? res.text() : null)
        ]);

        if (jsonRes || csvRes) {
          const parsed = await parseFileContent(jsonRes, csvRes);
          setData(parsed);
        }
      } catch (err) {
        console.error("Failed to load default data", err);
      } finally {
        setLoading(false);
      }
    };

    loadDefaultData();
  }, []);

  // File Upload Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setLoading(true);

    const files = Array.from(e.dataTransfer.files);
    let jsonContent: string | null = null;
    let csvContent: string | null = null;

    for (const file of files) {
      if (file.name.endsWith('.json')) {
        jsonContent = await file.text();
      } else if (file.name.endsWith('.csv')) {
        csvContent = await file.text();
      }
    }

    if (jsonContent || csvContent) {
      const parsed = await parseFileContent(jsonContent, csvContent);
      setData(parsed);
    }
    setLoading(false);
  };

  // processed data for charts
  const weeklyVolume = useMemo(() => {
    if (!data?.workouts.length) return [];

    // Group by week
    const weeks: { date: string, volume: number, workouts: number }[] = [];
    const sorted = [...data.workouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (sorted.length === 0) return [];

    let currentWeek = startOfWeek(new Date(sorted[0].date), { weekStartsOn: 1 });
    let volume = 0;
    let count = 0;

    sorted.forEach(w => {
      const wDate = new Date(w.date);
      if (isSameWeek(wDate, currentWeek, { weekStartsOn: 1 })) {
        volume += w.volume;
        count++;
      } else {
        weeks.push({
          date: format(currentWeek, 'dd MMM', { locale: fr }),
          volume: Math.round(volume),
          workouts: count
        });
        currentWeek = startOfWeek(wDate, { weekStartsOn: 1 });
        volume = w.volume;
        count = 1;
      }
    });
    // Push last
    weeks.push({
      date: format(currentWeek, 'dd MMM', { locale: fr }),
      volume: Math.round(volume),
      workouts: count
    });

    return weeks;
  }, [data]);

  const topExercises = useMemo(() => {
    if (!data) return [];

    // Count frequency
    const counts = new Map<string, number>();
    data.workouts.forEach(w => {
      w.sets.forEach(s => {
        counts.set(s.exerciseName, (counts.get(s.exerciseName) || 0) + 1);
      });
    });

    // Get top 6
    const sortedNames = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]) // Descending
      .slice(0, 6)
      .map(e => e[0]);

    // Build data for each
    return sortedNames.map(name => {
      const points: { date: string, e1rm: number, weight: number }[] = [];
      data.workouts.forEach(w => {
        w.sets.forEach(s => {
          if (s.exerciseName === name) {
            const e1rm = s.weight * (1 + s.reps / 30);
            points.push({
              date: w.date,
              e1rm: Math.round(e1rm),
              weight: s.weight
            });
          }
        });
      });
      return {
        name,
        data: points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      };
    });
  }, [data]);

  const exerciseProgress = useMemo(() => {
    if (!data) return [];
    const points: { date: string, weight: number, reps: number, e1rm: number }[] = [];

    data.workouts.forEach(w => {
      w.sets.forEach(s => {
        if (s.exerciseName === selectedExercise) {
          const e1rm = s.weight * (1 + s.reps / 30);
          points.push({
            date: w.date, // ISO
            weight: s.weight,
            reps: s.reps,
            e1rm: Math.round(e1rm)
          });
        }
      });
    });

    return points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, selectedExercise]);

  const uniqueExercises = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.workouts.forEach(w => w.sets.forEach(s => set.add(s.exerciseName)));
    return Array.from(set).sort();
  }, [data]);

  const filteredMetrics = useMemo(() => {
    if (!data) return [];
    // Filter out metrics with 0 or null weight
    return data.metrics.filter(m => m.weight && m.weight > 0);
  }, [data]);

  return (
    <div className="min-h-screen pb-20 bg-background text-text font-sans selection:bg-primary/30">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel border-b-0 rounded-none mb-8 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-primary to-accent rounded-lg shadow-lg shadow-primary/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            FitTrack Pro
          </h1>
        </div>

        <button className="text-sm font-medium text-muted hover:text-white transition-colors flex items-center gap-2">
          <CalendarIcon className="w-4 h-4" />
          {format(new Date(), 'dd MMMM yyyy', { locale: fr })}
        </button>
      </header>

      <main className="container mx-auto px-4 sm:px-6">

        {/* File Upload / Update */}
        <div
          className={clsx(
            "relative mb-10 rounded-2xl border-2 border-dashed transition-all duration-300 ease-in-out p-8 text-center group",
            dragActive ? "border-primary bg-primary/10 scale-[1.01]" : "border-border hover:border-muted bg-surface/30"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          < div className="pointer-events-none flex flex-col items-center gap-2">
            <div className="p-4 rounded-full bg-surface border border-border group-hover:border-primary/50 transition-colors">
              <Upload className="w-6 h-6 text-muted group-hover:text-primary" />
            </div>
            <p className="text-lg font-medium">Glissez vos fichiers ici pour mettre à jour</p>
            <p className="text-sm text-muted">Accepte .json (Fitness Data) et .csv (Strong App)</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : !data ? (
          <div className="text-center text-muted">
            Aucune donnée trouvée. Veuillez importer vos fichiers.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Summary Cards */}
            <div className="glass-panel p-6 col-span-1 lg:col-span-1 flex flex-col justify-between h-[150px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted text-sm font-medium">Poids Actuel</p>
                  <h3 className="text-3xl font-bold text-white mt-1">
                    {filteredMetrics[filteredMetrics.length - 1]?.weight} <span className="text-lg text-muted font-normal">kg</span>
                  </h3>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Scale className="w-5 h-5 text-blue-500" />
                </div>
              </div>
              <div className="text-sm text-green-400 flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Dernière pesée: {filteredMetrics[filteredMetrics.length - 1]?.date ? format(new Date(filteredMetrics[filteredMetrics.length - 1]?.date), 'dd MMM yyyy') : 'N/A'}
              </div>
            </div>

            <div className="glass-panel p-6 col-span-1 lg:col-span-1 flex flex-col justify-between h-[150px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted text-sm font-medium">Total Séances</p>
                  <h3 className="text-3xl font-bold text-white mt-1">
                    {data.workouts.length}
                  </h3>
                </div>
                <div className="p-2 bg-pink-500/10 rounded-lg">
                  <Dumbbell className="w-5 h-5 text-pink-500" />
                </div>
              </div>
              <div className="text-sm text-pink-400">
                Keep pushing!
              </div>
            </div>

            <div className="glass-panel p-6 col-span-1 lg:col-span-1 flex flex-col justify-between h-[150px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted text-sm font-medium">Volume Max (Hebdo)</p>
                  <h3 className="text-3xl font-bold text-white mt-1">
                    {(Math.max(...weeklyVolume.map(w => w.volume)) / 1000).toFixed(1)}k
                  </h3>
                </div>
                <div className="p-2 bg-violet-500/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-violet-500" />
                </div>
              </div>
              <div className="text-sm text-violet-400">
                kg cumulés
              </div>
            </div>

            {/* Performance Section Title */}
            <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Dumbbell className="w-6 h-6 text-primary" />
                Performances Musculaires (Top 6 Exercices Fréquents)
              </h2>
            </div>

            {/* Top Exercises Grid */}
            {topExercises.map((ex) => (
              <div key={ex.name} className="glass-panel p-6 col-span-1 md:col-span-1 lg:col-span-1">
                <h3 className="text-md font-semibold mb-4 text-white truncate" title={ex.name}>
                  {ex.name}
                </h3>
                <div className="mt-2 text-sm">
                  <ChartAutoSizer height={200}>
                    {({ width, height }) => (
                      <LineChart width={width} height={height} data={ex.data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="date" hide />
                        <YAxis domain={['dataMin - 5', 'auto']} stroke="#a1a1aa" hide />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                          labelFormatter={(label) => format(new Date(label), 'dd MMM yyyy')}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(val: any, name: any) => [
                            `${val} kg`,
                            name === 'e1rm' ? '1RM Est.' : 'Poids (kg)'
                          ]}
                        />
                        <Line type="monotone" dataKey="e1rm" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="e1rm" />
                        <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" dot={false} name="weight" />
                      </LineChart>
                    )}
                  </ChartAutoSizer>
                </div>
                <div className="mt-2 flex justify-between items-end">
                  <div>
                    <span className="text-xs text-muted">Max 1RM</span>
                    <p className="text-xl font-bold text-accent">{Math.max(...ex.data.map(d => d.e1rm))} <span className="text-xs font-normal text-muted">kg</span></p>
                  </div>
                  <div className="text-xs text-muted">
                    {ex.data.length} séances
                  </div>
                </div>
              </div>
            ))}

            {/* Detailed Chart Section (Restored) */}
            <div className="glass-panel p-6 col-span-1 md:col-span-2 lg:col-span-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent" />
                  Explorateur d'Exercice (Détails)
                </h3>
                <select
                  className="bg-surface border border-border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent min-w-[200px]"
                  value={selectedExercise}
                  onChange={(e) => setSelectedExercise(e.target.value)}
                >
                  {uniqueExercises.map(ex => (
                    <option key={ex} value={ex}>{ex}</option>
                  ))}
                </select>
              </div>
              <div className="mt-4">
                {exerciseProgress.length > 0 ? (
                  <ChartAutoSizer height={400}>
                    {({ width, height }) => (
                      <LineChart width={width} height={height} data={exerciseProgress} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis
                          dataKey="date"
                          stroke="#a1a1aa"
                          tickFormatter={(str) => format(new Date(str), 'MMM yy')}
                          minTickGap={30}
                        />
                        <YAxis domain={['auto', 'auto']} stroke="#a1a1aa" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                          labelFormatter={(label) => format(new Date(label), 'dd MMM yyyy')}
                        />
                        <Line type="monotone" dataKey="e1rm" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} activeDot={{ r: 6 }} name="1RM Est." />
                        <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Poids (kg)" />
                      </LineChart>
                    )}
                  </ChartAutoSizer>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted text-sm">Pas de données pour cet exercice</div>
                )}
              </div>
            </div>

            {/* Volume Chart */}
            <div className="glass-panel p-6 col-span-1 md:col-span-2 lg:col-span-3">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-secondary" />
                Volume Hebdomadaire
              </h3>
              <div className="mt-4">
                <ChartAutoSizer height={300}>
                  {({ width, height }) => (
                    <BarChart width={width} height={height} data={weeklyVolume}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#a1a1aa"
                        fontSize={12}
                      />
                      <YAxis stroke="#a1a1aa" unit="kg" tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                      <Tooltip
                        cursor={{ fill: '#27272a' }}
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                        formatter={(val: number | undefined) => [val ? `${(val / 1000).toFixed(2)}k kg` : '0 kg', 'Volume']}
                      />
                      <Bar dataKey="volume" fill="#ec4899" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ChartAutoSizer>
              </div>
            </div>

            {/* Secondary Section Header */}
            <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-8 pt-8 border-t border-border">
              <h2 className="text-xl font-bold text-muted flex items-center gap-2">
                <Activity className="w-6 h-6" />
                Santé & Métabolisme
              </h2>
            </div>

            {/* Weight Chart */}
            <div className="glass-panel p-6 col-span-1 lg:col-span-1 opacity-80 hover:opacity-100 transition-opacity">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-500" />
                Poids de corps
              </h3>
              <div className="mt-4">
                <ChartAutoSizer height={200}>
                  {({ width, height }) => (
                    <AreaChart width={width} height={height} data={filteredMetrics}>
                      <defs>
                        <linearGradient id="colorWeightSmall" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="date" hide />
                      <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                        labelFormatter={(label) => format(new Date(label), 'dd MMM yyyy')}
                      />
                      <Area type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} fill="url(#colorWeightSmall)" />
                    </AreaChart>
                  )}
                </ChartAutoSizer>
              </div>
            </div>

            {/* Body Composition */}
            <div className="glass-panel p-6 col-span-1 lg:col-span-2 opacity-80 hover:opacity-100 transition-opacity">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-500" />
                Composition (%)
              </h3>
              <div className="mt-4">
                <ChartAutoSizer height={200}>
                  {({ width, height }) => (
                    <LineChart width={width} height={height} data={filteredMetrics.filter(m => m.muscle && m.fat)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#a1a1aa"
                        tickFormatter={(str) => format(new Date(str), 'MMM yy')}
                      />
                      <YAxis stroke="#a1a1aa" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="muscle" stroke="#22c55e" strokeWidth={2} name="Muscle %" dot={false} />
                      <Line type="monotone" dataKey="fat" stroke="#ef4444" strokeWidth={2} name="Fat %" dot={false} />
                    </LineChart>
                  )}
                </ChartAutoSizer>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

export default App;
