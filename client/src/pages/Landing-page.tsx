import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select } from "../components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Small stats card component
function StatsCard() {
  const [uptime, setUptime] = React.useState<string>('00:00:00');
  const [ping, setPing] = React.useState<string>('—');

  // Uptime every 1s
  React.useEffect(() => {
    let mounted = true;
    async function fetchUptime() {
      try {
        const res = await fetch('/api/uptime');
        if (!res.ok) return;
        const j = await res.json();
        if (mounted) setUptime(j.uptime || '—');
      } catch {}
    }
    fetchUptime();
    const id = setInterval(fetchUptime, 1000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Ping every 10s
  React.useEffect(() => {
    let mounted = true;
    async function fetchPing() {
      try {
        const res = await fetch('/api/ping');
        if (!res.ok) return;
        const j = await res.json();
        if (mounted) setPing(j.latency || '—');
      } catch {}
    }
    fetchPing();
    const id = setInterval(fetchPing, 10000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <Card className="p-4 rounded-xl shadow-md landing-card-backdrop">
      <div className="text-sm font-semibold mb-2">Stats</div>
      <hr className="border-gray-300 my-2" />
      <div className="text-xs text-gray-700">
        <div className="flex justify-between"><span>Uptime</span><span>{uptime}</span></div>
        <div className="flex justify-between mt-2"><span>Ping</span><span>{ping}</span></div>
      </div>
    </Card>
  );
}

const formSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  contactMethod: z.string(),
  contactNote: z.string().min(1, "Contact details are required"),
});

const LandingPage = () => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
  contactMethod: "",
      contactNote: "",
    },
  });


  const [loading, setLoading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  const handleLoginRequest = async (data: z.infer<typeof formSchema>) => {
    try {
      setLoading(true);
      setStatusMessage(null);

      const resp = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setStatusMessage(err?.message || `Signup failed (${resp.status})`);
        return;
      }

      const result = await resp.json().catch(() => ({}));
      setStatusMessage(result?.message || 'Request submitted — we will contact you soon.');
      form.reset();
    } catch (err: any) {
      setStatusMessage(err?.message || 'Network error submitting request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-gray-900 animated-rainbow">
      <style>{`
        .animated-rainbow{
          /* animated multi-color rainbow using a large moving gradient */
          background: linear-gradient(270deg, #ff4d4d, #ffb86b, #f7ff6b, #6bffb8, #6bb3ff, #b56bff, #ff6bd8);
          background-size: 1400% 1400%;
          animation: rainbow 18s ease infinite;
          /* fallback color */
          background-color: #06186d;
        }
        @keyframes rainbow{
          0%{background-position:0% 50%;}
          50%{background-position:100% 50%;}
          100%{background-position:0% 50%;}
        }
  /* lighter cards visually over the animated background */
  .landing-card-backdrop{ background-color: rgba(255,255,255,0.9); }
  /* ensure text inside the card is dark for better contrast */
  .landing-card-backdrop *{ color: #0f172a !important; }
      `}</style>
  <div className="relative max-w-7xl mx-auto px-4 py-6 lg:flex lg:items-start lg:gap-8">
        {/* Title top-left on large screens (absolute so it doesn't push cards down) */}
          <div className="hidden lg:block absolute top-6 left-6 z-20">
          <h1 className="text-4xl lg:text-5xl font-bold">SLM Router</h1>
          <p className="text-sm text-gray-600">Secure, Fast, and Private Web Browsing Solution</p>
        </div>
  {/* Stats card was absolute; moved into right column to match form width */}
        {/* Left column: stacked cards */}
  <div className="lg:flex-1 lg:pt-20">

          {/* Quick navigation buttons */}
          <div className="flex items-center gap-3 mb-6">
            <a className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm" href="/slmbrowser">Open SLM Browser</a>
            <a className="px-4 py-2 bg-white/90 text-gray-900 rounded-md border border-gray-200 shadow-sm" href="/dashboard">Go to Dashboard</a>
          </div>

          <div className="space-y-6">
            <Card className="p-6 border-gray-300 rounded-xl shadow-lg landing-card-backdrop">
              <h3 className="text-xl font-semibold mb-4">Secure Browsing</h3>
              <p className="text-gray-700">Browse the web securely through our encrypted proxy service</p>
            </Card>

            <Card className="p-6 border-gray-300 rounded-xl shadow-lg landing-card-backdrop">
              <h3 className="text-xl font-semibold mb-4">Advanced Dashboard</h3>
              <p className="text-gray-700">Monitor and control your proxy settings with our intuitive dashboard</p>
            </Card>

            <Card className="p-6 border-gray-300 rounded-xl shadow-lg landing-card-backdrop">
              <h3 className="text-xl font-semibold mb-4">Real-time Statistics</h3>
              <p className="text-gray-700">Track performance metrics and usage statistics in real-time</p>
            </Card>
          </div>
        </div>

        {/* Right column: contact form (sticky) */}
        <div className="mt-8 lg:mt-0 lg:w-80">
          <div className="mb-4 lg:mb-6">
            <div className="hidden lg:block">
              <StatsCard />
            </div>
          </div>
          <div className="sticky top-6">
            <Card className="p-6 border-gray-300 rounded-xl shadow-xl landing-card-backdrop">
              <h2 className="text-2xl font-bold mb-4 text-center">Not a user? Request a login:</h2>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleLoginRequest)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} className="bg-white/60 text-gray-900 placeholder-gray-600 px-3 py-2 rounded-md border border-gray-300" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contactMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Method</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. email@example.com or +1-555-5555" className="bg-white/60 text-gray-900 placeholder-gray-600 px-3 py-2 rounded-md border border-gray-300" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contactNote"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Note (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your needs or how we can reach you."
                            {...field}
                            className="bg-white/60 text-gray-900 placeholder-gray-600 px-3 py-2 rounded-md border border-gray-300"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full bg-gradient-to-r from-indigo-300 via-pink-300 to-yellow-300 text-gray-900 font-semibold hover:opacity-95 shadow-md" disabled={loading}>
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                        </svg>
                        Sending...
                      </span>
                    ) : (
                      'Submit Request'
                    )}
                  </Button>
                  {statusMessage && (
                    <div className="mt-3 text-sm text-center text-gray-700">{statusMessage}</div>
                  )}
                </form>
              </Form>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-gray-500">
        <p>&copy; 2025 SLM Router. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
