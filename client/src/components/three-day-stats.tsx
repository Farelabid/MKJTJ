import { useQuery } from "@tanstack/react-query";
import { Calendar, Trophy, TrendingUp } from "lucide-react";

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
    <div className="relative h-full" data-testid="card-three-day-stats">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 opacity-10 rounded-xl"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(196, 245, 66, 0.1) 10px,
            rgba(196, 245, 66, 0.1) 20px
          )`
        }}
      />
      
      {/* Card Container with Gradient Border & Glow */}
      <div 
        className="relative rounded-xl p-[2px] animate-gradient-rotate h-full"
        style={{
          background: 'linear-gradient(90deg, #C4F542, #FF69B4, #C4F542, #FF69B4)',
          backgroundSize: '300% 100%'
        }}
      >
        <div className="relative bg-card/95 backdrop-blur-sm rounded-xl p-5 shadow-[0_0_30px_rgba(196,245,66,0.3),0_0_60px_rgba(255,105,180,0.2)] h-full">
          {/* Header with Animated Icon */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <Calendar className="h-4 w-4 text-[#C4F542] animate-pulse" />
              <div className="absolute inset-0 animate-ping opacity-75">
                <Calendar className="h-4 w-4 text-[#C4F542]" />
              </div>
            </div>
            <h3 className="text-[10px] font-bold text-[#C4F542] tracking-wider">
              JUMLAH LISTENERS SEBELUMNYA
            </h3>
            <div className="relative ml-auto">
              <TrendingUp className="h-3 w-3 text-[#FF69B4] animate-pulse" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
          
          {/* Daily stats with enhanced horizontal bars */}
          <div className="space-y-3">
            {data.dailyStats.map((stat, index) => {
              const barWidth = (stat.totalListeners / maxListeners) * 100;
              const isHighest = stat.totalListeners === maxListeners && maxListeners > 0;
              
              return (
                <div 
                  key={stat.date} 
                  className="space-y-1"
                  data-testid={`stat-day-${stat.date}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      {stat.formattedDate}
                    </span>
                    <span 
                      className="text-xl font-bold font-mono tabular-nums"
                      style={{
                        color: isHighest ? '#C4F542' : 'inherit',
                        textShadow: isHighest ? '0 0 15px rgba(196, 245, 66, 0.6), 0 0 30px rgba(196, 245, 66, 0.4)' : 'none'
                      }}
                      data-testid={`text-listeners-${stat.date}`}
                    >
                      {formatNumber(stat.totalListeners)}
                    </span>
                  </div>
                  <div className="relative w-full bg-background/50 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${barWidth}%`,
                        background: isHighest 
                          ? 'linear-gradient(90deg, #C4F542, #C4F542DD)' 
                          : 'linear-gradient(90deg, #C4F542DD, #C4F54299)',
                        boxShadow: isHighest 
                          ? '0 0 15px rgba(196, 245, 66, 0.6)' 
                          : '0 0 10px rgba(196, 245, 66, 0.3)'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Record program with Trophy Icon */}
          {data.recordProgram.name && (
            <div className="mt-4 pt-3 border-t border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <div className="relative">
                  <Trophy className="h-3 w-3 text-[#FF69B4] animate-pulse" />
                  <div className="absolute inset-0 animate-ping opacity-75" style={{ animationDelay: '0.5s' }}>
                    <Trophy className="h-3 w-3 text-[#FF69B4]" />
                  </div>
                </div>
                <div className="text-[10px] font-bold text-muted-foreground tracking-wider">
                  PROGRAM FAVORITE MINGGU INI
                </div>
              </div>
              <div 
                className="text-sm font-bold uppercase tracking-wide text-[#FF69B4]"
                style={{
                  textShadow: '0 0 15px rgba(255, 105, 180, 0.5)'
                }}
                data-testid="text-record-program"
              >
                {data.recordProgram.displayName}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
