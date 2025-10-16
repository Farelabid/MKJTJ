import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";

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
      <Card className="p-4 bg-card/50 backdrop-blur-sm">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-32 mb-3"></div>
          <div className="space-y-2">
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-8 bg-muted rounded"></div>
          </div>
        </div>
      </Card>
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

  return (
    <Card className="p-4 bg-card/50 backdrop-blur-sm" data-testid="card-three-day-stats">
      <h3 className="text-xs font-semibold mb-3 text-muted-foreground">
        JUMLAH PENDENGAR
      </h3>
      
      {/* Daily stats */}
      <div className="space-y-2 mb-4">
        {data.dailyStats.map((stat) => (
          <div 
            key={stat.date} 
            className="flex items-center gap-3"
            data-testid={`stat-day-${stat.date}`}
          >
            <div className="bg-[#C4F542] text-black px-2 py-0.5 text-[10px] font-bold rounded min-w-[90px] text-center">
              {stat.formattedDate}
            </div>
            <div className="text-2xl font-bold tabular-nums" data-testid={`text-listeners-${stat.date}`}>
              {formatNumber(stat.totalListeners)}
            </div>
          </div>
        ))}
      </div>

      {/* Record program */}
      {data.recordProgram.name && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="text-[10px] text-muted-foreground mb-1">
            REKOR PENDENGAR TERTINGGI
          </div>
          <div className="text-[10px] text-muted-foreground mb-1">
            PROGRAM
          </div>
          <div className="text-lg font-bold uppercase tracking-wide" data-testid="text-record-program">
            {data.recordProgram.displayName}
          </div>
        </div>
      )}
    </Card>
  );
}
