import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AlertThreshold } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bell, Plus, Trash2, Power, PowerOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AlertManagement() {
  const { toast } = useToast();
  const [thresholdType, setThresholdType] = useState("min_listeners");
  const [thresholdValue, setThresholdValue] = useState("");

  const { data: thresholds, isLoading } = useQuery<AlertThreshold[]>({
    queryKey: ["/api/alert-thresholds"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { thresholdType: string; value: number; enabled: boolean }) => {
      return apiRequest("POST", "/api/alert-thresholds", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-thresholds"] });
      setThresholdValue("");
      toast({
        title: "Threshold Dibuat",
        description: "Alert threshold baru telah ditambahkan",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest("PATCH", `/api/alert-thresholds/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-thresholds"] });
      toast({
        title: "Status Diperbarui",
        description: "Status alert threshold telah diubah",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/alert-thresholds/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-thresholds"] });
      toast({
        title: "Threshold Dihapus",
        description: "Alert threshold telah dihapus",
      });
    },
  });

  const handleCreate = () => {
    if (!thresholdValue) {
      toast({
        title: "Input Tidak Valid",
        description: "Masukkan nilai threshold",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      thresholdType,
      value: parseInt(thresholdValue),
      enabled: true,
    });
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Alert Thresholds</h3>
      </div>

      {/* Create New Threshold */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-md">
        <h4 className="font-medium text-sm">Tambah Threshold Baru</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="type">Tipe</Label>
            <Select value={thresholdType} onValueChange={setThresholdType}>
              <SelectTrigger id="type" data-testid="select-threshold-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="min_listeners">Minimum Listeners</SelectItem>
                <SelectItem value="max_listeners">Maximum Listeners</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="value">Nilai</Label>
            <Input
              id="value"
              type="number"
              value={thresholdValue}
              onChange={(e) => setThresholdValue(e.target.value)}
              placeholder="Contoh: 1000"
              data-testid="input-threshold-value"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="w-full"
              data-testid="button-create-threshold"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah
            </Button>
          </div>
        </div>
      </div>

      {/* Existing Thresholds */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Threshold Aktif</h4>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : thresholds && thresholds.length > 0 ? (
          <div className="space-y-2">
            {thresholds.map((threshold) => (
              <div
                key={threshold.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-md"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <Badge variant={threshold.thresholdType === "min_listeners" ? "default" : "secondary"}>
                      {threshold.thresholdType === "min_listeners" ? "MIN" : "MAX"}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-medium">{threshold.value.toLocaleString()} listeners</p>
                    <p className="text-xs text-muted-foreground">
                      {threshold.thresholdType === "min_listeners" 
                        ? "Alert jika di bawah nilai ini" 
                        : "Alert jika di atas nilai ini"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleMutation.mutate({ id: threshold.id, enabled: !threshold.enabled })}
                    data-testid={`button-toggle-${threshold.id}`}
                  >
                    {threshold.enabled ? (
                      <Power className="h-4 w-4 text-status-online" />
                    ) : (
                      <PowerOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(threshold.id)}
                    data-testid={`button-delete-${threshold.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">
            Belum ada threshold yang dibuat. Tambahkan threshold di atas.
          </div>
        )}
      </div>
    </Card>
  );
}
