import { useQuery } from "@tanstack/react-query";
import { Calendar } from "lucide-react";
import juaraIcon from "@assets/juara_1762080477351.png";

interface DailyStat {
  date: string;
  totalListeners: number;
  dayName: string;
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
    staleTime: 0, // Always fetch fresh data
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-32 mb-3"></div>
          <div className="h-48 bg-muted rounded"></div>
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

  // Format date as "27 OKT" style
  const formatShortDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGS', 'SEP', 'OKT', 'NOP', 'DES'];
    return `${day} ${months[month - 1]}`;
  };

  // Find max value for bar scaling
  const maxListeners = Math.max(...data.dailyStats.map(s => s.totalListeners), 1);

  // Gradient colors from yellow to red (6 colors for 6 bars)
  const barColors = [
    '#FFD700', // Yellow (oldest)
    '#FFC107', // Amber
    '#FF9800', // Orange
    '#FF6F00', // Deep Orange
    '#FF5722', // Red-Orange
    '#F44336', // Red (newest)
  ];

  return (
    <div className="relative h-full" data-testid="card-three-day-stats">
      {/* Card Container with Gradient Border */}
      <div 
        className="relative rounded-xl p-[3px] h-full"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.6), rgba(255, 152, 0, 0.6), rgba(244, 67, 54, 0.6))',
        }}
      >
        <div className="relative bg-[#1a1a1a] backdrop-blur-sm rounded-xl p-5 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-[#C4F542]" />
            <h3 className="text-[11px] font-bold tracking-wider">
              <span className="text-[#C4F542]">JUMLAH LISTENERS</span>{' '}
              <span className="text-white">SEMINGGU</span>{' '}
              <span className="text-[#FF69B4]">TERAKHIR</span>
            </h3>
          </div>
          
          {/* Vertical Bars Chart */}
          <div className="flex-1 flex items-end justify-between gap-2 mb-4 px-2">
            {data.dailyStats.map((stat, index) => {
              const barHeight = (stat.totalListeners / maxListeners) * 100;
              const barColor = barColors[index];
              
              return (
                <div 
                  key={stat.date}
                  className="flex-1 flex flex-col items-center gap-2"
                  data-testid={`stat-day-${stat.date}`}
                  style={{ 
                    animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`
                  }}
                >
                  {/* Value Label */}
                  <div 
                    className="text-sm font-bold font-mono tabular-nums"
                    style={{ 
                      color: barColor,
                      textShadow: `0 0 10px ${barColor}80`
                    }}
                    data-testid={`text-listeners-${stat.date}`}
                  >
                    {formatNumber(stat.totalListeners)}
                  </div>
                  
                  {/* Vertical Bar */}
                  <div className="w-full flex flex-col items-center">
                    <div 
                      className="w-full rounded-t-lg transition-all duration-1000 ease-out relative"
                      style={{
                        height: `${Math.max(barHeight, 5)}%`,
                        maxHeight: '140px',
                        minHeight: '20px',
                        background: `linear-gradient(to top, ${barColor}, ${barColor}DD)`,
                        boxShadow: `0 0 15px ${barColor}60, inset 0 2px 8px rgba(255,255,255,0.2)`
                      }}
                    />
                  </div>
                  
                  {/* Day Name & Date Labels */}
                  <div className="flex flex-col items-center gap-0.5 mt-1">
                    <div className="text-[9px] font-bold text-white uppercase tracking-wide">
                      {formatShortDate(stat.date)}
                    </div>
                    <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide">
                      {stat.dayName}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Record Program with Trophy Icon */}
          {data.recordProgram.name && (
            <div className="pt-3 border-t border-border/20">
              <div className="flex items-center justify-center gap-2 mb-2">
                <img 
                  src={juaraIcon} 
                  alt="Trophy" 
                  className="h-6 w-6 animate-pulse"
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.8))'
                  }}
                />
                <div className="text-[9px] font-bold tracking-wider uppercase">
                  <span className="text-[#FF69B4]">PROGRAM FAVORITE</span>{' '}
                  <span className="text-[#C4F542]">TEMAN JAKARTA</span>{' '}
                  <span className="text-white">MINGGU INI</span>
                </div>
              </div>
              <div 
                className="text-center text-xl font-bold uppercase tracking-wide"
                style={{
                  color: '#FF9800',
                  textShadow: '0 0 20px rgba(255, 152, 0, 0.8)'
                }}
                data-testid="text-record-program"
              >
                {data.recordProgram.displayName}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
