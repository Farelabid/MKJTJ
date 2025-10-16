import { useQuery } from "@tanstack/react-query";

interface DailyStat {
  date: string;
  totalListeners: number;
  formattedDate: string;
}

interface RecordProgram {
  name: string;
  listeners: number;
  displayName: string;
}

interface ThreeDayStatsResponse {
  dailyStats: DailyStat[];
  recordProgram: RecordProgram;
}

export default function ThreeDayStats() {
  const { data, isLoading } = useQuery<ThreeDayStatsResponse>({
    queryKey: ["/api/three-day-stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-32 mb-3"></div>
          <div className="space-y-2">
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-8 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(0)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toString();
  };

  // Find max value for bar scaling
  const maxListeners = Math.max(...data.dailyStats.map(s => s.totalListeners), 1);

  return (
    <div className="space-y-4" data-testid="card-three-day-stats">
      <h3 className="text-[10px] font-bold text-[#C4F542] tracking-wider">
        JUMLAH LISTENERS SEBELUMNYA
      </h3>
      
      {/* Daily stats with horizontal bars */}
      <div className="space-y-3">
        {data.dailyStats.map((stat) => {
          const barWidth = (stat.totalListeners / maxListeners) * 100;
          
          return (
            <div 
              key={stat.date} 
              className="space-y-1"
              data-testid={`stat-day-${stat.date}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground">
                  {stat.formattedDate}
                </span>
                <span className="text-xl font-bold tabular-nums" data-testid={`text-listeners-${stat.date}`}>
                  {formatNumber(stat.totalListeners)}
                </span>
              </div>
              <div className="w-full bg-muted/30 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#C4F542] transition-all duration-500 ease-out"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Record program */}
      {data.recordProgram.name && (
        <div className="mt-4 pt-3 border-t border-border/30">
          <div className="text-[10px] font-bold text-muted-foreground mb-1">
            PROGRAM FAVORITE MINGGU INI
          </div>
          <div className="text-sm font-bold uppercase tracking-wide" data-testid="text-record-program">
            {data.recordProgram.displayName}
          </div>
        </div>
      )}
    </div>
  );
}
