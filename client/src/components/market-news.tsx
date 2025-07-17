import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, ExternalLink, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useETF } from "@/context/etf-context";

interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Date;
  symbols: string[];
}

export function MarketNews() {
  const { selectedETF } = useETF();
  
  const { data: newsData, isLoading } = useQuery<NewsArticle[]>({
    queryKey: ['/api/market-news'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - new Date(date).getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInHours > 0) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInMinutes > 0) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const getRelevantNews = (articles: NewsArticle[]) => {
    // Filter and prioritize news relevant to selected ETF
    return articles.filter(article => 
      article.symbols.includes(selectedETF.symbol) || 
      article.symbols.includes('SPY') || // Always include general market news
      article.title.toLowerCase().includes(selectedETF.symbol.toLowerCase())
    ).slice(0, 5); // Show top 5 relevant articles
  };

  if (isLoading) {
    return (
      <Card className="bg-financial-gray border-financial-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white flex items-center">
            <Bell className="w-5 h-5 mr-2" />
            Market News
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-400 py-8">Loading market news...</div>
        </CardContent>
      </Card>
    );
  }

  const relevantNews = newsData ? getRelevantNews(newsData) : [];

  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white flex items-center">
          <Bell className="w-5 h-5 mr-2" />
          Market News
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {relevantNews.map((article, index) => (
            <div key={index} className="bg-financial-card rounded-lg p-4 hover:bg-financial-border transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-3">
                  <div className="text-white font-medium text-sm leading-tight">
                    {article.title}
                  </div>
                  <div className="text-xs text-gray-400 mt-2 line-clamp-2">
                    {article.summary}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center text-xs text-gray-500">
                      <Calendar className="w-3 h-3 mr-1" />
                      {formatTimeAgo(article.publishedAt)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">{article.source}</span>
                      {article.url !== `#news-${index + 1}` && (
                        <a 
                          href={article.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-gain-green hover:text-green-400 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  {article.symbols.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {article.symbols.slice(0, 3).map((symbol) => (
                        <span 
                          key={symbol} 
                          className={`text-xs px-2 py-1 rounded ${
                            symbol === selectedETF.symbol 
                              ? 'bg-gain-green text-white' 
                              : 'bg-financial-border text-gray-400'
                          }`}
                        >
                          {symbol}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {relevantNews.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            No recent news available for {selectedETF.symbol}
          </div>
        )}
        
        <div className="mt-4 text-xs text-gray-400">
          <p>
            Real-time financial news filtered for {selectedETF.symbol} and general market updates. 
            News articles are sourced from major financial publications and updated every 5 minutes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
