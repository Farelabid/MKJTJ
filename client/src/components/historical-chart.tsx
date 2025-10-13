import { useQuery } from "@tanstack/react-query";
import { StatsHistory } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Calendar } from "lucide-react";
import { useState } from "react";

type TimeRange = "24h" | "7d" | "30d";

export function HistoricalChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");

  const hours = timeRange === "24h" ? 24 : timeRange === "7d" ? 168 : 720;

  const { data: history, isLoading } = useQuery<StatsHistory[]>({
    queryKey: ["/api/stats-history", hours],
    queryFn: async () => {
      const response = await fetch(`/api/stats-history?hours=${hours}`);
      if (!response.ok) throw new Error("Failed to fetch history");
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const chartData = history?.map((stat) => ({
    time: new Date(stat.timestamp).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      ...(timeRange !== "24h" && {
        day: "2-digit",
        month: "short",
      }),
    }),
    current: stat.listenersCurrent,
    peak: stat.listenersPeak,
    raw: stat.listenersRaw,
  })).reverse() || [];

  const getAverage = () => {
    if (!history || history.length === 0) return 0;
    const sum = history.reduce((acc, stat) => acc + stat.listenersCurrent, 0);
    return Math.round(sum / history.length);
  };

  const getMax = () => {
    if (!history || history.length === 0) return 0;
    return Math.max(...history.map(stat => stat.listenersCurrent));
  };

  const getMin = () => {
    if (!history || history.length === 0) return 0;
    return Math.min(...history.map(stat => stat.listenersCurrent));
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Tren Pendengar Historis</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={timeRange === "24h" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("24h")}
            data-testid="button-24h"
          >
            24 Jam
          </Button>
          <Button
            variant={timeRange === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("7d")}
            data-testid="button-7d"
          >
            7 Hari
          </Button>
          <Button
            variant={timeRange === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("30d")}
            data-testid="button-30d"
          >
            30 Hari
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : history && history.length > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Rata-rata</p>
              <p className="text-2xl font-bold font-mono" data-testid="text-avg-listeners">
                {getAverage().toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Maksimum</p>
              <p className="text-2xl font-bold font-mono text-chart-3" data-testid="text-max-listeners">
                {getMax().toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Minimum</p>
              <p className="text-2xl font-bold font-mono text-chart-5" data-testid="text-min-listeners">
                {getMin().toLocaleString()}
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="time" 
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="current"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                name="Pendengar Saat Ini"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="peak"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Peak"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-80 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Belum ada data historis yang tersedia.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Data akan mulai dikumpulkan setiap 5 menit.
          </p>
        </div>
      )}
    </Card>
  );
}
