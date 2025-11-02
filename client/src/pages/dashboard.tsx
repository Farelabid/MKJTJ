import { useQuery } from "@tanstack/react-query";
import { RadioStats } from "@shared/schema";
import { useState, useEffect, useRef } from "react";
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
import CrewOnDuty from "@/components/crew-on-duty";
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

  // Track listener trend - use ref to avoid updating before render
  const prevListenersRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (stats && stats.listenersCurrent !== undefined) {
      if (prevListenersRef.current !== null && prevListenersRef.current !== stats.listenersCurrent) {
        const diff = stats.listenersCurrent - prevListenersRef.current;
        const threshold = prevListenersRef.current * 0.05; // 5% change threshold
        
        if (diff > threshold) {
          setTrend('up');
        } else if (diff < -threshold) {
          setTrend('down');
        } else {
          setTrend('stable');
        }
        
        // Update state for display
        setPreviousListeners(prevListenersRef.current);
      }
      
      // Update ref for next comparison
      prevListenersRef.current = stats.listenersCurrent;
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
            {/* Left: Speedometer Gauge */}
            <div className="relative flex flex-col items-center justify-center p-4 bg-black/40 rounded-xl">
              {isLoading ? (
                <Skeleton className="h-80 w-80 rounded-full" />
              ) : (
                <div className="relative w-full max-w-sm aspect-square flex items-center justify-center">
                  {/* Speedometer SVG */}
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    <defs>
                      <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#FF69B4" />
                        <stop offset="50%" stopColor="#FF69B4" />
                        <stop offset="50%" stopColor="#C4F542" />
                        <stop offset="100%" stopColor="#C4F542" />
                      </linearGradient>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    
                    {/* Main Arc - Pink to Yellow gradient */}
                    <circle
                      cx="100"
                      cy="100"
                      r="85"
                      fill="none"
                      stroke="url(#gaugeGradient)"
                      strokeWidth="8"
                      strokeDasharray="267 267"
                      strokeDashoffset="67"
                      filter="url(#glow)"
                      style={{
                        transform: 'rotate(-180deg)',
                        transformOrigin: '50% 50%'
                      }}
                    />
                    
                    {/* Scale Marks */}
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                      const angle = -180 + (num * 200 / 9);
                      const radian = (angle * Math.PI) / 180;
                      const x1 = 100 + 75 * Math.cos(radian);
                      const y1 = 100 + 75 * Math.sin(radian);
                      const x2 = 100 + 85 * Math.cos(radian);
                      const y2 = 100 + 85 * Math.sin(radian);
                      const textX = 100 + 92 * Math.cos(radian);
                      const textY = 100 + 92 * Math.sin(radian);
                      
                      return (
                        <g key={num}>
                          <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={num <= 4 ? '#FF69B4' : '#C4F542'}
                            strokeWidth="2"
                          />
                          <text
                            x={textX}
                            y={textY}
                            fill={num <= 4 ? '#FF69B4' : '#C4F542'}
                            fontSize="12"
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            {num}
                          </text>
                        </g>
                      );
                    })}
                    
                    {/* Needle */}
                    {stats && (
                      <line
                        x1="100"
                        y1="100"
                        x2="100"
                        y2="30"
                        stroke="#FF1744"
                        strokeWidth="3"
                        strokeLinecap="round"
                        style={{
                          transform: `rotate(${-180 + (getListenerRatio() * 200 / 100)}deg)`,
                          transformOrigin: '50% 50%',
                          transition: 'transform 1s ease-out'
                        }}
                      />
                    )}
                    
                    {/* Center Circle */}
                    <circle cx="100" cy="100" r="5" fill="#FF1744" />
                  </svg>
                  
                  {/* Center Text Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2 mt-8">
                      <p className="text-xs font-bold text-[#C4F542] tracking-wider">
                        PENDENGAR SAAT INI
                      </p>
                      <Radio className="h-4 w-4 text-[#FF69B4] animate-pulse" />
                    </div>
                    
                    {/* Main Number */}
                    <h2 
                      className="text-5xl font-bold font-mono tracking-tight text-[#FF69B4] mb-1"
                      style={{
                        textShadow: '0 0 20px rgba(255, 105, 180, 0.8)'
                      }}
                      data-testid="text-listeners-current"
                    >
                      {stats?.listenersCurrent.toLocaleString()}
                    </h2>
                    
                    {/* Trend Indicator */}
                    {stats && previousListeners !== null && (
                      <p className="text-xs text-muted-foreground mb-3">
                        {getTrendPercentage() > 0 ? '+' : getTrendPercentage() < 0 ? '−' : ''} {Math.abs(getTrendPercentage()).toFixed(1)}% vs update terakhir
                      </p>
                    )}
                    
                    {/* Peak */}
                    {stats && (
                      <div className="space-y-1">
                        <p className="text-sm">
                          <span className="text-[#C4F542] font-bold">PEAK</span>
                          {' '}
                          <span 
                            className="text-2xl font-bold font-mono text-[#C4F542]"
                            style={{ textShadow: '0 0 15px rgba(196, 245, 66, 0.6)' }}
                          >
                            {stats.listenersPeak.toLocaleString()}
                          </span>
                        </p>
                        
                        {/* Percentage */}
                        <p 
                          className="text-xl font-bold text-[#FF69B4]"
                          style={{ textShadow: '0 0 15px rgba(255, 105, 180, 0.6)' }}
                        >
                          {getListenerRatio().toFixed(0)}% DARI PEAK
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Center: Crew On Duty (Operator + Producer Photos) */}
            <div className="flex items-center justify-center">
              <CrewOnDuty />
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
