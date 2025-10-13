import { useQuery } from "@tanstack/react-query";
import { StatsHistory } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Music } from "lucide-react";

interface ProgramStats {
  name: string;
  timeRange: string;
  listeners: number;
  color: string;
}

export function ProgramListeners() {
  const { data: history, isLoading } = useQuery<StatsHistory[]>({
    queryKey: ["/api/stats-history", 24],
    queryFn: async () => {
      const response = await fetch(`/api/stats-history?hours=24`);
      if (!response.ok) throw new Error("Failed to fetch history");
      return response.json();
    },
    refetchInterval: 60000,
  });

  const calculateProgramListeners = (): ProgramStats[] => {
    if (!history || history.length === 0) {
      return [
        { name: "Good Morning Jakarta", timeRange: "06:00 - 10:00", listeners: 0, color: "hsl(var(--chart-1))" },
        { name: "Office Hour", timeRange: "10:01 - 13:00", listeners: 0, color: "hsl(var(--chart-2))" },
        { name: "Coffee Break", timeRange: "13:01 - 16:00", listeners: 0, color: "hsl(var(--chart-3))" },
        { name: "Drive Time", timeRange: "16:01 - 20:00", listeners: 0, color: "hsl(var(--chart-4))" },
        { name: "Shift Malam", timeRange: "20:01 - 22:00", listeners: 0, color: "hsl(var(--chart-5))" },
        { name: "Yesterday Hits", timeRange: "22:01 - 05:59", listeners: 0, color: "hsl(var(--chart-1))" },
      ];
    }

    const programData = {
      goodMorning: { sum: 0, count: 0 },
      officeHour: { sum: 0, count: 0 },
      coffeeBreak: { sum: 0, count: 0 },
      driveTime: { sum: 0, count: 0 },
      shiftMalam: { sum: 0, count: 0 },
      yesterdayHits: { sum: 0, count: 0 },
    };

    history.forEach((stat) => {
      const date = new Date(stat.timestamp);
      const hour = date.getHours();

      if (hour >= 6 && hour < 10) {
        programData.goodMorning.sum += stat.listenersRaw;
        programData.goodMorning.count++;
      } else if (hour >= 10 && hour < 13) {
        programData.officeHour.sum += stat.listenersRaw;
        programData.officeHour.count++;
      } else if (hour >= 13 && hour < 16) {
        programData.coffeeBreak.sum += stat.listenersRaw;
        programData.coffeeBreak.count++;
      } else if (hour >= 16 && hour < 20) {
        programData.driveTime.sum += stat.listenersRaw;
        programData.driveTime.count++;
      } else if (hour >= 20 && hour < 22) {
        programData.shiftMalam.sum += stat.listenersRaw;
        programData.shiftMalam.count++;
      } else {
        programData.yesterdayHits.sum += stat.listenersRaw;
        programData.yesterdayHits.count++;
      }
    });

    return [
      {
        name: "Good Morning Jakarta",
        timeRange: "06:00 - 10:00",
        listeners: programData.goodMorning.sum * 4,
        color: "hsl(var(--chart-1))",
      },
      {
        name: "Office Hour",
        timeRange: "10:01 - 13:00",
        listeners: programData.officeHour.sum * 4,
        color: "hsl(var(--chart-2))",
      },
      {
        name: "Coffee Break",
        timeRange: "13:01 - 16:00",
        listeners: programData.coffeeBreak.sum * 4,
        color: "hsl(var(--chart-3))",
      },
      {
        name: "Drive Time",
        timeRange: "16:01 - 20:00",
        listeners: programData.driveTime.sum * 4,
        color: "hsl(var(--chart-4))",
      },
      {
        name: "Shift Malam",
        timeRange: "20:01 - 22:00",
        listeners: programData.shiftMalam.sum * 4,
        color: "hsl(var(--chart-5))",
      },
      {
        name: "Yesterday Hits",
        timeRange: "22:01 - 05:59",
        listeners: programData.yesterdayHits.sum * 4,
        color: "hsl(var(--chart-1))",
      },
    ];
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
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
                <div>
                  <p className="font-medium" data-testid={`text-program-${program.name.toLowerCase().replace(/\s+/g, '-')}`}>
                    {program.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{program.timeRange}</p>
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
