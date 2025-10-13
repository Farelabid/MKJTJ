import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Save, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import { AlertManagement } from "@/components/alert-management";

export default function Admin() {
  const { toast } = useToast();
  const [multiplier, setMultiplier] = useState("4");
  const [streamUrl, setStreamUrl] = useState("https://stream-eu-nc.arenastreaming.com:5450/");

  const { data: config } = useQuery<Record<string, string>>({
    queryKey: ["/api/config"],
  });

  useEffect(() => {
    if (config) {
      setMultiplier(config.listener_multiplier || "4");
      setStreamUrl(config.stream_url || "https://stream-eu-nc.arenastreaming.com:5450/");
    }
  }, [config]);

  const updateConfigMutation = useMutation({
    mutationFn: async (data: { key: string; value: string }) => {
      return apiRequest("POST", "/api/config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      toast({
        title: "Konfigurasi Disimpan",
        description: "Pengaturan telah berhasil diperbarui",
      });
    },
    onError: () => {
      toast({
        title: "Gagal Menyimpan",
        description: "Tidak dapat menyimpan konfigurasi. Silakan coba lagi.",
        variant: "destructive",
      });
    },
  });

  const handleSaveMultiplier = () => {
    updateConfigMutation.mutate({
      key: "listener_multiplier",
      value: multiplier,
    });
  };

  const handleSaveStreamUrl = () => {
    updateConfigMutation.mutate({
      key: "stream_url",
      value: streamUrl,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Settings className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Kelola konfigurasi TJ Radio Jakarta
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Configuration Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Listener Multiplier */}
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Listener Multiplier</h3>
              <p className="text-sm text-muted-foreground">
                Faktor pengali untuk jumlah pendengar yang ditampilkan
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="multiplier">Nilai Multiplier</Label>
                <Input
                  id="multiplier"
                  type="number"
                  min="1"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  data-testid="input-multiplier"
                />
              </div>
              <Button
                onClick={handleSaveMultiplier}
                disabled={updateConfigMutation.isPending}
                data-testid="button-save-multiplier"
              >
                <Save className="h-4 w-4 mr-2" />
                Simpan Multiplier
              </Button>
            </div>
          </Card>

          {/* Stream URL */}
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Stream URL</h3>
              <p className="text-sm text-muted-foreground">
                URL server Icecast untuk mengambil data statistik
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="streamUrl">URL Server</Label>
                <Input
                  id="streamUrl"
                  type="url"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  data-testid="input-stream-url"
                />
              </div>
              <Button
                onClick={handleSaveStreamUrl}
                disabled={updateConfigMutation.isPending}
                data-testid="button-save-url"
              >
                <Save className="h-4 w-4 mr-2" />
                Simpan URL
              </Button>
            </div>
          </Card>
        </section>

        {/* Alert Management */}
        <section>
          <AlertManagement />
        </section>

        {/* Info */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Catatan Konfigurasi</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Multiplier mengalikan jumlah pendengar dari server Icecast</li>
                <li>• URL stream harus mengarah ke halaman status server Icecast</li>
                <li>• Perubahan akan diterapkan pada refresh data berikutnya</li>
                <li>• Data historis tetap menggunakan multiplier saat data dikumpulkan</li>
              </ul>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
