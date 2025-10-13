import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Music } from "lucide-react";
import { useState, useEffect } from "react";

interface ProgramListenersData {
  programName: string;
  displayName: string;
  timeRange: string;
  startTime: string;
  endTime: string;
  cumulativeListeners: number; // Estimated Unique Listeners
  avgConcurrent: number; // Average Concurrent Listeners
  progressPercent: number;
  isActive: boolean;
  color: string;
}

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

  // Fetch program listeners data from new endpoint (every 4 minutes)
  const { data: programs, isLoading } = useQuery<ProgramListenersData[]>({
    queryKey: ["/api/program-listeners"],
    refetchInterval: 4 * 60 * 1000, // 4 minutes
  });

  const dateStr = formatDateString();
  const maxListeners = Math.max(...(programs?.map(p => p.cumulativeListeners) || [0]), 1);

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
          {programs?.map((program) => (
            <div key={program.programName} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div>
                    <p className="font-medium flex items-center gap-2" data-testid={`text-program-${program.displayName.toLowerCase().replace(/\s+/g, '-')}`}>
                      {program.displayName} - {dateStr}
                      {program.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-red-500 text-white rounded-full animate-pulse">
                          LIVE
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{program.timeRange}</p>
                  </div>
                </div>
                {/* Display both metrics with clear labels */}
                <div className="flex gap-3 items-center">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Avg Concurrent</p>
                    <span 
                      className="font-mono font-bold text-sm" 
                      data-testid={`text-program-avg-${program.displayName.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {program.avgConcurrent.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Est. Unique</p>
                    <span 
                      className="font-mono font-bold px-3 py-1.5 rounded-md min-w-[80px] text-center inline-block" 
                      style={{
                        backgroundColor: program.isActive ? program.color : 'transparent',
                        color: program.isActive ? 'white' : 'inherit',
                      }}
                      data-testid={`text-program-listeners-${program.displayName.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {program.cumulativeListeners.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              {/* Progress bar based on time (0-100%) */}
              <div className="h-6 bg-muted rounded-md overflow-hidden relative">
                <div
                  className="h-full transition-all duration-500 flex items-center justify-end px-2"
                  style={{
                    width: program.isActive ? `${program.progressPercent}%` : '0%',
                    backgroundColor: program.color,
                  }}
                >
                  {program.isActive && program.progressPercent > 10 && (
                    <span className="text-xs font-semibold text-white">
                      {program.progressPercent}%
                    </span>
                  )}
                </div>
                {/* Show percentage outside bar if too small */}
                {program.isActive && program.progressPercent <= 10 && program.progressPercent > 0 && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-foreground">
                    {program.progressPercent}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
