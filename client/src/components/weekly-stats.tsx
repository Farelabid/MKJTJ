import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";

interface WeeklyStatItem {
  date: string;
  totalListeners: number;
  dayName: string;
  formattedDate: string;
}

interface WeeklyStatsData {
  weeklyStats: WeeklyStatItem[];
}

interface ThreeDayStatsData {
  dailyStats: Array<{
    date: string;
    totalListeners: number;
    dayName: string;
    formattedDate: string;
  }>;
  recordProgram: {
    name: string;
    listeners: number;
    displayName: string;
  };
}

export default function WeeklyStats() {
  const { data: weeklyData, isLoading: weeklyLoading } = useQuery<WeeklyStatsData>({
    queryKey: ["/api/weekly-stats"],
    refetchInterval: 30000,
  });

  const { data: championData, isLoading: championLoading } = useQuery<ThreeDayStatsData>({
    queryKey: ["/api/three-day-stats"],
    refetchInterval: 30000,
  });

  if (weeklyLoading || championLoading || !weeklyData || !championData) {
    return (
      <div className="flex flex-col h-full space-y-4">
        <Skeleton className="h-8 w-full" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const maxListeners = Math.max(...weeklyData.weeklyStats.map(s => s.totalListeners), 1);

  const getBarColor = (listeners: number) => {
    const percentage = (listeners / maxListeners) * 100;
    if (percentage >= 80) return 'bg-gradient-to-r from-red-500 to-red-600';
    if (percentage >= 60) return 'bg-gradient-to-r from-orange-500 to-orange-600';
    if (percentage >= 40) return 'bg-gradient-to-r from-yellow-500 to-yellow-600';
    return 'bg-gradient-to-r from-green-500 to-green-600';
  };

  const formatListeners = (listeners: number) => {
    if (listeners >= 1000000) {
      return `${(listeners / 1000).toFixed(0)}K`;
    }
    if (listeners >= 1000) {
      return `${(listeners / 1000).toFixed(0)}K`;
    }
    return listeners.toString();
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-4 bg-gradient-to-br from-gray-900/50 to-gray-800/50 rounded-lg border-2 border-yellow-600/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 px-3 py-2 rounded-md">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-300 animate-pulse" />
          <h3 className="text-white font-bold text-xs tracking-wide" data-testid="text-weekly-stats-header">
            JUMLAH LISTENERS SEMINGGU <span className="text-green-300">TERAKHIR</span>
          </h3>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="flex-1 space-y-1">
        {weeklyData.weeklyStats.map((stat, index) => {
          const percentage = (stat.totalListeners / maxListeners) * 100;
          const isToday = index === weeklyData.weeklyStats.length - 1;
          
          return (
            <div key={stat.date} className="flex items-center gap-2">
              {/* Date Label */}
              <div className="w-12 text-right">
                <p className="text-[10px] font-bold text-white" data-testid={`text-date-${index}`}>
                  {stat.formattedDate.split(' ')[0]}
                </p>
                <p className="text-[8px] text-muted-foreground uppercase">
                  {stat.dayName}
                </p>
              </div>

              {/* Bar */}
              <div className="flex-1 relative h-6 bg-gray-800/50 rounded-sm overflow-hidden">
                <div 
                  className={`h-full ${getBarColor(stat.totalListeners)} transition-all duration-500 flex items-center justify-end pr-1`}
                  style={{ width: `${percentage}%` }}
                >
                  <span className="text-[10px] font-bold text-white drop-shadow-lg" data-testid={`text-listeners-${index}`}>
                    {formatListeners(stat.totalListeners)}
                  </span>
                </div>
                {isToday && (
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-red-500 animate-pulse" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Program Favorite Section */}
      <div className="bg-gradient-to-br from-yellow-900/40 to-orange-900/40 border-2 border-yellow-600/50 rounded-lg px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy 
              className="h-5 w-5 text-yellow-400 drop-shadow-lg" 
              style={{
                filter: 'drop-shadow(0 0 8px rgba(250, 204, 21, 0.8))',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }}
              data-testid="icon-trophy"
            />
            <div>
              <p className="text-[9px] text-yellow-300/80 font-medium uppercase tracking-wide">
                PROGRAM FAVORITE TEMAN JAKARTA MINGGU INI
              </p>
              <p className="text-sm font-black text-yellow-400 tracking-wide drop-shadow-lg" data-testid="text-favorite-program">
                {championData.recordProgram.displayName.toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
