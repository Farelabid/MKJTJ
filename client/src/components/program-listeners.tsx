import { useQuery } from "@tanstack/react-query";
import { RadioStats } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Music } from "lucide-react";
import { useState, useEffect } from "react";

interface ProgramStats {
  name: string;
  timeRange: string;
  listeners: number;
  color: string;
  isOnAir: boolean;
}

// Program schedule with time slots
const PROGRAMS = [
  { name: "Night Flow", timeRange: "00:00 - 06:00", start: 0, end: 360, color: "hsl(var(--chart-6))" },
  { name: "Good Morning Jakarta", timeRange: "06:00 - 10:00", start: 360, end: 600, color: "hsl(var(--chart-1))" },
  { name: "Office Hour", timeRange: "10:00 - 13:00", start: 600, end: 780, color: "hsl(var(--chart-2))" },
  { name: "Coffee Break", timeRange: "13:00 - 16:00", start: 780, end: 960, color: "hsl(var(--chart-3))" },
  { name: "Drive Time", timeRange: "16:00 - 20:00", start: 960, end: 1200, color: "hsl(var(--chart-4))" },
  { name: "Shift Malam", timeRange: "20:00 - 23:00", start: 1200, end: 1380, color: "hsl(var(--chart-5))" },
  { name: "Yesterday Hits", timeRange: "23:00 - 00:00", start: 1380, end: 1440, color: "hsl(var(--chart-1))" },
];

export function ProgramListeners() {
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDateString = () => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const day = days[currentDate.getDay()];
    const date = currentDate.getDate();
    const month = months[currentDate.getMonth()];
    const year = currentDate.getFullYear();
    
    return `${day} ${date} ${month} ${year}`;
  };

  // Fetch current radio stats for real-time listeners
  const { data: stats, isLoading } = useQuery<RadioStats>({
    queryKey: ["/api/radio-stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const calculateProgramListeners = (): ProgramStats[] => {
    const dateStr = formatDateString();
    
    // Calculate current time in WIB (UTC+7)
    const now = new Date();
    const wibOffset = 7 * 60; // WIB is UTC+7
    const localOffset = now.getTimezoneOffset(); // Local offset in minutes (negative for positive timezone)
    const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
    
    const hour = wibTime.getHours();
    const minute = wibTime.getMinutes();
    const minutesSinceMidnight = hour * 60 + minute;

    // Get current listeners (already multiplied by 4 from backend)
    const currentListenersRaw = stats?.listenersRaw || 0;
    const currentListeners = currentListenersRaw * 4; // Apply multiplier

    // Find which program is currently on air
    let onAirProgramName = "";
    
    for (const program of PROGRAMS) {
      // Handle midnight wraparound for Yesterday Hits
      if (program.name === "Yesterday Hits") {
        if (minutesSinceMidnight >= program.start || minutesSinceMidnight < PROGRAMS[0].end) {
          onAirProgramName = program.name;
          break;
        }
      } else if (program.name === "Night Flow") {
        if (minutesSinceMidnight >= program.start && minutesSinceMidnight < program.end) {
          onAirProgramName = program.name;
          break;
        }
      } else {
        if (minutesSinceMidnight >= program.start && minutesSinceMidnight < program.end) {
          onAirProgramName = program.name;
          break;
        }
      }
    }

    return PROGRAMS.map((program) => ({
      name: `${program.name} - ${dateStr}`,
      timeRange: program.timeRange,
      listeners: program.name === onAirProgramName ? currentListeners : 0,
      color: program.color,
      isOnAir: program.name === onAirProgramName,
    }));
  };

  const programs = calculateProgramListeners();
  const maxListeners = Math.max(...programs.map(p => p.listeners), 1);

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Jumlah Pendengar Tiap Program</h3>
        <Music className="h-5 w-5 text-muted-foreground" />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          {programs.map((program) => (
            <div key={program.name} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div>
                    <p className="font-medium flex items-center gap-2" data-testid={`text-program-${program.name.toLowerCase().replace(/\s+/g, '-')}`}>
                      {program.name}
                      {program.isOnAir && (
                        <span className="text-xs px-2 py-0.5 bg-red-500 text-white rounded-full animate-pulse">
                          LIVE
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{program.timeRange}</p>
                  </div>
                </div>
                <span className="font-mono font-semibold" data-testid={`text-program-listeners-${program.name.toLowerCase().replace(/\s+/g, '-')}`}>
                  {program.listeners.toLocaleString()}
                </span>
              </div>
              <div className="h-6 bg-muted rounded-md overflow-hidden">
                <div
                  className="h-full transition-all duration-500 flex items-center justify-end px-2"
                  style={{
                    width: `${(program.listeners / maxListeners) * 100}%`,
                    backgroundColor: program.color,
                  }}
                >
                  {program.listeners > 0 && (
                    <span className="text-xs font-semibold text-white">
                      {((program.listeners / maxListeners) * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
