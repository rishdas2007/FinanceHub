import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Home, 
  Database, 
  Activity, 
  AlertTriangle,
  TrendingUp,
  BarChart3 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

const navigationItems: NavigationItem[] = [
  {
    path: "/",
    label: "Dashboard",
    icon: <Home className="h-4 w-4" />,
    description: "Main analytics dashboard"
  },
  {
    path: "/data-sufficiency",
    label: "Data Sufficiency",
    icon: <Database className="h-4 w-4" />,
    description: "Historical data coverage analysis",
    badge: "Critical",
    badgeVariant: "destructive"
  },
  {
    path: "/data-quality",
    label: "Data Quality",
    icon: <Activity className="h-4 w-4" />,
    description: "Data validation and monitoring"
  }
];

export function NavigationHeader() {
  const [location] = useLocation();

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">FinanceHub</h1>
            </div>
            <Badge variant="outline" className="text-xs">
              Pro
            </Badge>
          </div>

          {/* Navigation Items */}
          <nav className="flex items-center gap-1">
            {navigationItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={location === item.path ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "flex items-center gap-2 h-9",
                    location === item.path && "bg-primary text-primary-foreground"
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  {item.icon}
                  <span className="hidden sm:inline">{item.label}</span>
                  {item.badge && (
                    <Badge 
                      variant={item.badgeVariant || "secondary"} 
                      className="ml-1 text-xs px-1.5 py-0.5"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Button>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}

export function QuickStatsHeader({ 
  criticalIssues = 0, 
  totalSymbols = 0,
  avgConfidence = 0 
}: {
  criticalIssues?: number;
  totalSymbols?: number;
  avgConfidence?: number;
}) {
  return (
    <div className="bg-muted/30 border-b">
      <div className="container mx-auto px-6 py-2">
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span>Market Analysis Active</span>
          </div>
          
          {criticalIssues > 0 && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span>{criticalIssues} Critical Data Issues</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span>{totalSymbols} Symbols Tracked</span>
          </div>
          
          {avgConfidence > 0 && (
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span>{Math.round(avgConfidence * 100)}% Avg Data Confidence</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}