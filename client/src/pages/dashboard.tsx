import { useQuery } from "@tanstack/react-query";
import { RadioStats } from "@shared/schema";
import { useState, useEffect } from "react";
import { Radio, Users, Signal, ExternalLink, RefreshCw, Copy, Check, Settings } from "lucide-react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { HistoricalChart } from "@/components/historical-chart";
import { ProgramListeners } from "@/components/program-listeners";
import { OnAirProgram } from "@/components/on-air-program";
import { useToast } from "@/hooks/use-toast";
import tjRadioLogo from "@assets/logo_official_tj_1760323825293.png";
import onAirImage from "@assets/onair_1760326793890.png";

export default function Dashboard() {
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(30);
  const [copied, setCopied] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const { toast } = useToast();

  const { data: stats, isLoading, error, refetch } = useQuery<RadioStats>({
    queryKey: ["/api/radio-stats"],
    refetchInterval: 30000,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setAutoRefreshCountdown((prev) => {
        if (prev <= 1) {
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = () => {
    refetch();
    setAutoRefreshCountdown(30);
    toast({
      title: "Data Diperbarui",
      description: "Statistik radio telah diperbarui",
    });
  };

  const handleCopyUrl = async () => {
    if (stats?.streamUrl) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(stats.streamUrl);
          setCopied(true);
          toast({
            title: "URL Disalin",
            description: "URL stream telah disalin ke clipboard",
          });
          setTimeout(() => setCopied(false), 2000);
        } else {
          // Fallback for non-secure contexts
          const textArea = document.createElement("textarea");
          textArea.value = stats.streamUrl;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          setCopied(true);
          toast({
            title: "URL Disalin",
            description: "URL stream telah disalin ke clipboard",
          });
          setTimeout(() => setCopied(false), 2000);
        }
      } catch (err) {
        toast({
          title: "Gagal Menyalin",
          description: "Tidak dapat menyalin URL. Silakan salin manual.",
          variant: "destructive",
        });
      }
    }
  };

  const getListenerRatio = () => {
    if (!stats || stats.listenersPeak === 0) return 0;
    const ratio = (stats.listenersCurrent / stats.listenersPeak) * 100;
    return Math.min(Math.max(ratio, 0), 100);
  };

  const getRatioColor = () => {
    const ratio = getListenerRatio();
    if (ratio >= 80) return "hsl(var(--chart-3))";
    if (ratio >= 50) return "hsl(var(--chart-5))";
    return "hsl(var(--chart-1))";
  };

  const formatDateTime = () => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const day = days[currentDateTime.getDay()];
    const time = currentDateTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const date = currentDateTime.getDate();
    const month = months[currentDateTime.getMonth()];
    const year = currentDateTime.getFullYear();
    
    return `${day}, ${time}, ${date} ${month} ${year}`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <div className="text-destructive mb-4">
            <Signal className="h-12 w-12 mx-auto mb-2" />
            <h2 className="text-xl font-semibold">Koneksi Terputus</h2>
          </div>
          <p className="text-muted-foreground mb-6">
            Tidak dapat terhubung ke server streaming. Silakan coba lagi.
          </p>
          <Button onClick={handleManualRefresh} data-testid="button-retry">
            <RefreshCw className="h-4 w-4 mr-2" />
            Coba Lagi
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 flex items-center justify-center">
                <img 
                  src={tjRadioLogo} 
                  alt="TJ Radio Jakarta Logo" 
                  className="h-12 w-12 object-contain"
                  data-testid="img-tj-radio-logo"
                />
              </div>
              <div>
                {isLoading ? (
                  <>
                    <Skeleton className="h-6 w-40 mb-1" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48 mt-1" />
                  </>
                ) : (
                  <>
                    <h1 className="text-xl font-bold" data-testid="text-radio-name">
                      {stats?.streamName}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {stats?.streamDescription}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1" data-testid="text-current-datetime">
                      {formatDateTime()}
                    </p>
                  </>
                )}
              </div>
            </div>
            
            {/* ON AIR Badge with Neon Image */}
            <div className="hidden md:flex items-center justify-center flex-shrink-0">
              <img 
                src={onAirImage} 
                alt="ON AIR" 
                className="h-10 w-auto object-contain"
                data-testid="img-on-air-badge"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-status-online animate-pulse-slow" />
                    <span className="font-medium">LIVE</span>
                  </div>
                  <span className="text-xs">•</span>
                  <span>Refresh dalam {autoRefreshCountdown}s</span>
                </div>
              </div>
              <Link href="/admin">
                <Button variant="ghost" size="icon" data-testid="button-admin">
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Admin Settings</span>
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Statistics */}
        <section className="text-center space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              PENDENGAR SAAT INI
            </p>
            {isLoading ? (
              <Skeleton className="h-24 w-64 mx-auto" />
            ) : (
              <div className="animate-counter-up">
                <h2 className="text-6xl md:text-7xl font-bold font-mono tracking-tight" data-testid="text-listeners-current">
                  {stats?.listenersCurrent.toLocaleString()}
                </h2>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-center gap-4">
            {isLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              <>
                <Badge variant="secondary" className="px-4 py-2 text-sm">
                  <Users className="h-4 w-4 mr-1" />
                  Peak: {stats?.listenersPeak.toLocaleString()}
                </Badge>
                <Badge 
                  variant="outline" 
                  className="px-4 py-2 text-sm"
                  style={{ 
                    borderColor: getRatioColor(),
                    color: getRatioColor() 
                  }}
                >
                  {getListenerRatio().toFixed(0)}% dari Peak
                </Badge>
              </>
            )}
          </div>

          {/* Progress Bar */}
          {!isLoading && stats && (
            <div className="max-w-md mx-auto">
              <Progress 
                value={getListenerRatio()} 
                className="h-2"
                style={{
                  // @ts-ignore
                  '--progress-background': getRatioColor()
                }}
              />
            </div>
          )}
        </section>

        {/* Information Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Station Details Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Detail Stasiun</h3>
              <Radio className="h-5 w-5 text-muted-foreground" />
            </div>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Nama Radio</p>
                  <p className="font-medium" data-testid="text-station-name">{stats?.streamName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Deskripsi</p>
                  <p className="font-medium" data-testid="text-station-description">{stats?.streamDescription}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Genre</p>
                  <p className="font-medium" data-testid="text-genre">{stats?.genre}</p>
                </div>
              </div>
            )}
          </Card>

          {/* Stream Information Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Informasi Stream</h3>
              <Signal className="h-5 w-5 text-muted-foreground" />
            </div>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Bitrate</p>
                  <p className="font-medium font-mono" data-testid="text-bitrate">{stats?.bitrate} kbps</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Format</p>
                  <p className="font-medium" data-testid="text-format">{stats?.contentType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stream Dimulai</p>
                  <p className="font-medium text-sm" data-testid="text-stream-started">{stats?.streamStarted}</p>
                </div>
              </div>
            )}
          </Card>

          {/* Currently Playing Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Sedang Diputar</h3>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-status-online animate-pulse-slow" />
              </div>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Lagu / Program</p>
                  <p className="font-medium" data-testid="text-currently-playing">
                    {stats?.currentlyPlaying || "Tidak ada informasi"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">URL Stream</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-mono text-xs truncate flex-1 bg-muted px-3 py-2 rounded-md" data-testid="text-stream-url">
                      {stats?.streamUrl}
                    </p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCopyUrl}
                      data-testid="button-copy-url"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-status-online" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* Data Visualization & On Air */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart Comparison */}
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Perbandingan Pendengar</h3>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Saat Ini</span>
                    <span className="font-mono font-semibold">{stats?.listenersCurrent.toLocaleString()}</span>
                  </div>
                  <div className="h-8 bg-muted rounded-md overflow-hidden">
                    <div 
                      className="h-full transition-all duration-500 flex items-center justify-end px-3"
                      style={{ 
                        width: `${getListenerRatio()}%`,
                        backgroundColor: getRatioColor()
                      }}
                    >
                      <span className="text-xs font-semibold text-white">
                        {getListenerRatio().toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Peak</span>
                    <span className="font-mono font-semibold">{stats?.listenersPeak.toLocaleString()}</span>
                  </div>
                  <div className="h-8 bg-muted rounded-md overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500 flex items-center justify-end px-3"
                      style={{ width: '100%' }}
                    >
                      <span className="text-xs font-semibold text-primary-foreground">100%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* On Air Program */}
          <OnAirProgram />
        </section>

        {/* Program Listeners */}
        <section>
          <ProgramListeners />
        </section>

        {/* Historical Chart */}
        <section>
          <HistoricalChart />
        </section>

        {/* Actions */}
        <section className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleManualRefresh}
              variant="outline"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Manual
            </Button>
            {stats?.streamUrl && (
              <Button
                asChild
                data-testid="button-listen-live"
              >
                <a href={stats.streamUrl} target="_blank" rel="noopener noreferrer">
                  <Radio className="h-4 w-4 mr-2" />
                  Dengarkan Live
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Terakhir diperbarui: {new Date().toLocaleTimeString('id-ID')}
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <p className="text-sm text-center text-muted-foreground">
            Hanya untuk keperluan Internal, tidak untuk disebarkan. Hak Cipta dilindungi Undang-Undang. | Media Kawal Jakarta
          </p>
        </div>
      </footer>
    </div>
  );
}
