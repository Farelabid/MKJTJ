import { useQuery } from "@tanstack/react-query";
import { RadioStats } from "@shared/schema";
import { useState, useEffect } from "react";
import { Radio, Users, Signal, ExternalLink, RefreshCw, Copy, Check, Settings, TrendingUp, TrendingDown, Minus } from "lucide-react";
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
import { ComingUpNext } from "@/components/coming-up-next";
import ThreeDayStats from "@/components/three-day-stats";
import { useToast } from "@/hooks/use-toast";
import tjRadioLogo from "@assets/logo_official_tj_1760323825293.png";
import sponsorHeaderImage from "@assets/back_header_1760419724787.png";

export default function Dashboard() {
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(30);
  const [copied, setCopied] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [previousListeners, setPreviousListeners] = useState<number | null>(null);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const { toast } = useToast();

  const { data: stats, isLoading, error, refetch } = useQuery<RadioStats>({
    queryKey: ["/api/radio-stats"],
    refetchInterval: 30000,
    staleTime: 0, // Always fetch fresh data
  });

  // Debug: log stats when it changes
  useEffect(() => {
    if (stats) {
      console.log('[Dashboard] Stats updated:', {
        listenersRaw: stats.listenersRaw,
        listenersCurrent: stats.listenersCurrent,
        multiplier: stats.listenersCurrent / stats.listenersRaw
      });
    }
  }, [stats]);

  // Track listener trend
  useEffect(() => {
    if (stats && stats.listenersCurrent !== undefined) {
      if (previousListeners !== null) {
        const diff = stats.listenersCurrent - previousListeners;
        const threshold = previousListeners * 0.05; // 5% change threshold
        
        if (diff > threshold) {
          setTrend('up');
        } else if (diff < -threshold) {
          setTrend('down');
        } else {
          setTrend('stable');
        }
      }
      setPreviousListeners(stats.listenersCurrent);
    }
  }, [stats?.listenersCurrent]);

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

  const getTrendPercentage = () => {
    if (!stats || !previousListeners || previousListeners === 0) return 0;
    const diff = stats.listenersCurrent - previousListeners;
    return ((diff / previousListeners) * 100);
  };

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-[#C4F542]';
    if (trend === 'down') return 'text-[#FF69B4]';
    return 'text-muted-foreground';
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
          <div className="flex items-center justify-between gap-4 relative">
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
            
            {/* Sponsor Header Image */}
            <div className="hidden md:flex items-center justify-center flex-shrink-0 absolute left-1/2 -translate-x-1/2">
              <img 
                src={sponsorHeaderImage} 
                alt="Supported by" 
                className="h-[82px] w-auto object-contain"
                data-testid="img-sponsor-header"
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
        {/* Hero Statistics - Redesigned 3 Column Layout */}
        <section className="bg-card/30 backdrop-blur-sm rounded-lg p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {/* Left: Current Listeners & Peak - Enhanced with 6 Visual Features */}
            <div className="relative flex flex-col">
              {/* Background Pattern (Feature 6) */}
              <div 
                className="absolute inset-0 opacity-10 rounded-xl"
                style={{
                  backgroundImage: `repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 10px,
                    rgba(196, 245, 66, 0.1) 10px,
                    rgba(196, 245, 66, 0.1) 20px
                  ), repeating-linear-gradient(
                    -45deg,
                    transparent,
                    transparent 10px,
                    rgba(255, 105, 180, 0.1) 10px,
                    rgba(255, 105, 180, 0.1) 20px
                  )`
                }}
              />
              
              {/* Card Container with Gradient Border & Glow (Feature 1) */}
              <div 
                className="relative rounded-xl p-[2px] animate-gradient-rotate h-full"
                style={{
                  background: 'linear-gradient(90deg, #FF69B4, #C4F542, #FF69B4, #C4F542)',
                  backgroundSize: '300% 100%'
                }}
              >
                <div className="relative bg-card/95 backdrop-blur-sm rounded-xl p-6 shadow-[0_0_30px_rgba(255,105,180,0.3),0_0_60px_rgba(196,245,66,0.2)] h-full">
                  <div className="text-center lg:text-left space-y-4">
                    {/* Header with Animated Icons (Feature 2) */}
                    <div className="flex items-center justify-center lg:justify-start gap-2">
                      <div className="relative">
                        <Signal className="h-4 w-4 text-[#C4F542] animate-pulse" />
                        <div className="absolute inset-0 animate-ping opacity-75">
                          <Signal className="h-4 w-4 text-[#C4F542]" />
                        </div>
                      </div>
                      <p className="text-xs font-bold text-[#C4F542] tracking-wider">
                        PENDENGAR SAAT INI
                      </p>
                      <div className="relative">
                        <Radio className="h-4 w-4 text-[#FF69B4] animate-pulse" />
                        <div className="absolute inset-0 animate-ping opacity-75" style={{ animationDelay: '0.5s' }}>
                          <Radio className="h-4 w-4 text-[#FF69B4]" />
                        </div>
                      </div>
                    </div>
                    
                    {isLoading ? (
                      <Skeleton className="h-20 w-48 mx-auto lg:mx-0" />
                    ) : (
                      <div className="animate-counter-up">
                        {/* Big Number with Glow Effect (Feature 3) */}
                        <h2 
                          className="text-5xl lg:text-6xl font-bold font-mono tracking-tight text-[#FF69B4]"
                          style={{
                            textShadow: '0 0 20px rgba(255, 105, 180, 0.6), 0 0 40px rgba(255, 105, 180, 0.4), 0 0 60px rgba(255, 105, 180, 0.2)'
                          }}
                          data-testid="text-listeners-current"
                        >
                          {stats?.listenersCurrent.toLocaleString()}
                        </h2>
                      </div>
                    )}
                    
                    {!isLoading && stats && (
                      <div className="space-y-3">
                        {/* Trending Indicator (Feature 5) */}
                        {previousListeners !== null && (
                          <div className="flex items-center justify-center lg:justify-start gap-2">
                            <div className={`flex items-center gap-1 ${getTrendColor()}`}>
                              {getTrendIcon()}
                              <span className="text-sm font-bold">
                                {Math.abs(getTrendPercentage()).toFixed(1)}%
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              vs update terakhir
                            </span>
                          </div>
                        )}
                        
                        {/* Peak Stats */}
                        <div className="text-left space-y-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-[#C4F542] font-bold">PEAK</span>
                            <span className="text-2xl font-bold font-mono text-[#C4F542]" style={{
                              textShadow: '0 0 15px rgba(196, 245, 66, 0.5)'
                            }}>
                              {stats.listenersPeak.toLocaleString()}
                            </span>
                          </div>
                          
                          {/* Progress Bar Visual (Feature 4) */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold" style={{ color: getRatioColor() }}>
                                {getListenerRatio().toFixed(0)}% DARI PEAK
                              </span>
                            </div>
                            <div className="relative h-2 bg-background/50 rounded-full overflow-hidden">
                              <div 
                                className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                                style={{
                                  width: `${getListenerRatio()}%`,
                                  background: `linear-gradient(90deg, ${getRatioColor()}, ${getRatioColor()}99)`,
                                  boxShadow: `0 0 10px ${getRatioColor()}`
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Cassette GIF (Autoplay Looping) */}
            <div className="flex items-center justify-center">
              <div className="relative w-full max-w-sm aspect-video rounded-lg overflow-hidden bg-black/20">
                <img
                  src="/attached_assets/kasetgif_1760582132231.gif"
                  alt="TJ Radio Jakarta Cassette Animation"
                  className="w-full h-full object-cover"
                  data-testid="image-hero-cassette"
                />
              </div>
            </div>

            {/* Right: 3-Day Stats with Horizontal Bars */}
            <div className="flex flex-col h-full">
              <ThreeDayStats />
            </div>
          </div>
        </section>

        {/* Coming Up Next & On Air */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coming Up Next */}
          <ComingUpNext />

          {/* On Air Program */}
          <OnAirProgram />
        </section>

        {/* Program Listeners */}
        <section>
          <ProgramListeners />
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
