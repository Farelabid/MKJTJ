import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type TimeRange = "24h" | "7d" | "30d";

export function ExportPanel() {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const hours = timeRange === "24h" ? 24 : timeRange === "7d" ? 168 : 720;

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const response = await fetch(`/api/export/csv?hours=${hours}`);
      
      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tj-radio-stats-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Berhasil",
        description: "Data statistik telah diunduh dalam format CSV",
      });
    } catch (error) {
      toast({
        title: "Export Gagal",
        description: "Tidak dapat mengekspor data. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Export Laporan</h3>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-3">Pilih Rentang Waktu:</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={timeRange === "24h" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("24h")}
              data-testid="export-24h"
            >
              24 Jam
            </Button>
            <Button
              variant={timeRange === "7d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("7d")}
              data-testid="export-7d"
            >
              7 Hari
            </Button>
            <Button
              variant={timeRange === "30d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("30d")}
              data-testid="export-30d"
            >
              30 Hari
            </Button>
          </div>
        </div>

        <div className="pt-2 space-y-2">
          <Button
            onClick={handleExportCSV}
            disabled={exporting}
            className="w-full"
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Mengekspor..." : "Export ke CSV"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          File CSV akan berisi data timestamp, jumlah pendengar, peak, bitrate, dan informasi lainnya.
        </p>
      </div>
    </Card>
  );
}
