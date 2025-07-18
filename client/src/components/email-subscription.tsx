import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, CheckCircle, AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EmailTestButton } from "./email-test-button";

export function EmailSubscription() {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { toast } = useToast();

  const subscribeMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch('/api/email/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to subscribe');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setIsSubscribed(true);
      setEmail("");
      toast({
        title: "Subscription Successful!",
        description: "You're now subscribed to daily market commentary (8 AM EST, Monday-Friday). Email delivery depends on SendGrid configuration.",
        duration: 5000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Subscription Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    subscribeMutation.mutate(email);
  };

  if (isSubscribed) {
    return (
      <Card className="bg-financial-gray border-financial-border">
        <CardContent className="pt-6">
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-gain-green mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Successfully Subscribed!</h3>
            <p className="text-gray-400 text-sm">
              You're subscribed! Daily commentary emails will be sent at 8 AM EST (Monday-Friday) when SendGrid is properly configured.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
          <Mail className="w-5 h-5 text-gain-green" />
          Daily Market Commentary
        </CardTitle>
        <p className="text-gray-400 text-sm">
          Get AI-powered market analysis delivered to your inbox every weekday morning at 8 AM EST.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubscribe} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-white">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-financial-card border-financial-border text-white placeholder-gray-400"
              required
            />
          </div>
          
          <div className="bg-financial-card rounded-lg p-4">
            <h4 className="text-white font-semibold text-sm mb-2">What you'll receive:</h4>
            <ul className="text-gray-400 text-xs space-y-1">
              <li>• Daily market position analysis</li>
              <li>• Technical indicator insights (RSI, MACD, VIX)</li>
              <li>• Sector rotation analysis</li>
              <li>• Economic event impact assessment</li>
              <li>• Professional trader-style commentary</li>
            </ul>
          </div>

          <Button
            type="submit"
            className="w-full bg-gain-green hover:bg-green-600 text-white transition-colors"
            disabled={subscribeMutation.isPending}
          >
            {subscribeMutation.isPending ? (
              <>
                <AlertCircle className="w-4 h-4 mr-2 animate-spin" />
                Subscribing...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Subscribe to Daily Commentary
              </>
            )}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            Free service • Monday-Friday delivery • Easy unsubscribe
          </p>

          {/* Admin Test Button */}
          <div className="mt-6 pt-4 border-t border-financial-border">
            <h4 className="text-white font-semibold text-sm mb-2">Developer Testing</h4>
            <EmailTestButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}