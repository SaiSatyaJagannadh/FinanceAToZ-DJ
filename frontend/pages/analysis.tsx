import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@clerk/nextjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import Layout from '../components/Layout';
import { API_URL } from '../lib/config';
import { parseUtc } from '../lib/dates';
import Head from 'next/head';

interface Job {
  id: string;
  created_at: string;
  status: string;
  job_type: string;
  report_payload?: {
    agent: string;
    content: string;
    generated_at: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  charts_payload?: Record<string, any> | null;  // Charter stores charts with dynamic keys
  retirement_payload?: {
    agent: string;
    analysis: string;
    generated_at: string;
  };
  growth_payload?: {
    agent: string;
    analysis: string;
    generated_at: string;
  };
  error_message?: string;
}

interface JobListItem {
  id: string;
  created_at: string;
  status: string;
  job_type: string;
}

type TabType = 'overview' | 'charts' | 'retirement' | 'growth';


const TABS: [TabType, string][] = [
  ['overview', '📊 Overview'],
  ['charts', '📈 Charts'],
  ['retirement', '🎯 Retirement Projection'],
  ['growth', '🚀 High Growth Picks'],
];

// Color palette for charts
const COLORS = [
  '#209DD7', // primary
  '#753991', // AI accent
  '#FFB707', // accent
  '#062147', // dark
  '#60A5FA', // light blue
  '#A78BFA', // light purple
  '#FBBF24', // yellow
  '#34D399', // green
  '#F87171', // red
  '#94A3B8', // gray
];

export default function Analysis() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { job_id } = router.query;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [fetchingLatest, setFetchingLatest] = useState(false);
  const [history, setHistory] = useState<JobListItem[]>([]);

  // Deep link to a tab, e.g. /analysis?job_id=...&tab=growth (from Advisor Team)
  useEffect(() => {
    const tab = router.query.tab as TabType | undefined;
    if (tab && TABS.some(([t]) => t === tab)) setActiveTab(tab);
  }, [router.query.tab]);

  // All past analyses for the history picker
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/jobs`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setHistory((data.jobs || []).sort((a: JobListItem, b: JobListItem) =>
            parseUtc(b.created_at).getTime() - parseUtc(a.created_at).getTime()));
        }
      } catch {
        /* history is optional */
      }
    })();
  }, [getToken]);

  const whenLabel = (iso: string) => {
    const d = parseUtc(iso);
    const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (days === 0) return `Today, ${time}`;
    if (days === 1) return `Yesterday, ${time}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: days > 300 ? 'numeric' : undefined })}, ${time}`;
  };

  useEffect(() => {
    const loadJob = async (jobId: string) => {
      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const jobData = await response.json();
          setJob(jobData);
        } else {
          console.error('Failed to fetch job');
        }
      } catch (error) {
        console.error('Error fetching job:', error);
      } finally {
        setLoading(false);
      }
    };

    const loadLatestJob = async () => {
      setFetchingLatest(true);
      try {
        const token = await getToken();
        // First, get the list of jobs to find the latest completed one
        const response = await fetch(`${API_URL}/api/jobs`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const jobs: JobListItem[] = data.jobs || [];
          // Find the latest completed job
          const latestCompletedJob = jobs
            .filter(j => j.status === 'completed')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

          if (latestCompletedJob) {
            // Load the full job details
            await loadJob(latestCompletedJob.id);
            // Update the URL to include the job_id without causing a page reload
            router.replace(`/analysis?job_id=${latestCompletedJob.id}`, undefined, { shallow: true });
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching latest job:', error);
        setLoading(false);
      } finally {
        setFetchingLatest(false);
      }
    };

    if (job_id) {
      loadJob(job_id as string);
    } else if (router.isReady) {
      // Router is ready but no job_id provided - fetch the latest analysis
      loadLatestJob();
    }
  }, [job_id, router.isReady, getToken, router]);


  const formatDate = (dateString: string) => {
    return parseUtc(dateString).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow px-8 py-12 text-center">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!job) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow px-8 py-12 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {fetchingLatest ? 'Loading Latest Analysis...' : 'No Analysis Available'}
              </h2>
              <p className="text-gray-600 mb-6">
                {fetchingLatest
                  ? 'Please wait while we load your latest analysis.'
                  : 'You have not completed any analyses yet. Start a new analysis to see results here.'}
              </p>
              {!fetchingLatest && (
                <button
                  onClick={() => router.push('/advisor-team')}
                  className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 font-semibold"
                >
                  Start New Analysis
                </button>
              )}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (job.status === 'running' || job.status === 'pending') {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow px-8 py-12 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Analysis In Progress</h2>
              <p className="text-gray-600 mb-6">Your analysis is still being processed. Please check back in a few moments.</p>
              <div className="flex justify-center space-x-2 mb-6">
                <div className="w-3 h-3 bg-ai-accent rounded-full animate-pulse"></div>
                <div className="w-3 h-3 bg-ai-accent rounded-full animate-pulse delay-75"></div>
                <div className="w-3 h-3 bg-ai-accent rounded-full animate-pulse delay-150"></div>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 font-semibold"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (job.status === 'failed') {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow px-8 py-12">
              <h2 className="text-2xl font-bold text-red-600 mb-4">Analysis Failed</h2>
              <p className="text-gray-600 mb-4">The analysis encountered an error and could not be completed.</p>
              {job.error_message && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-red-800">{job.error_message}</p>
                </div>
              )}
              <button
                onClick={() => router.push('/advisor-team')}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 font-semibold"
              >
                Try Another Analysis
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }


  // Tab content renderers
  const renderOverview = () => {
    const report = job?.report_payload?.content;
    if (!report) {
      return (
        <div className="text-center py-12 text-gray-500">
          No portfolio report available.
        </div>
      );
    }

    return (
      <div className="prose prose-lg max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            h1: ({children}) => <h1 className="text-3xl font-bold mb-4 text-gray-900">{children}</h1>,
            h2: ({children}) => <h2 className="text-2xl font-semibold mb-3 text-gray-800 mt-6">{children}</h2>,
            h3: ({children}) => <h3 className="text-xl font-medium mb-2 text-gray-700 mt-4">{children}</h3>,
            ul: ({children}) => <ul className="list-disc ml-6 mb-4 space-y-1">{children}</ul>,
            ol: ({children}) => <ol className="list-decimal ml-6 mb-4 space-y-1">{children}</ol>,
            li: ({children}) => <li className="text-gray-700">{children}</li>,
            p: ({children}) => <p className="mb-4 text-gray-700 leading-relaxed">{children}</p>,
            table: ({children}) => (
              <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse">{children}</table>
              </div>
            ),
            thead: ({children}) => <thead className="bg-gray-100">{children}</thead>,
            th: ({children}) => <th className="p-3 text-left font-semibold border border-gray-300">{children}</th>,
            td: ({children}) => <td className="p-3 border border-gray-300">{children}</td>,
            strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
            blockquote: ({children}) => (
              <blockquote className="border-l-4 border-primary pl-4 my-4 italic text-gray-600">
                {children}
              </blockquote>
            ),
          }}
        >
          {report}
        </ReactMarkdown>
      </div>
    );
  };

  const renderCharts = () => {
    const chartsPayload = job?.charts_payload;
    if (!chartsPayload || Object.keys(chartsPayload).length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          No chart data available.
        </div>
      );
    }

    // Helper function to format chart title from key
    const formatTitle = (key: string): string => {
      return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    // Helper function to determine chart type based on data structure or chart metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getChartType = (chartData: any): 'pie' | 'donut' | 'bar' | 'horizontalBar' | 'line' => {
      // If the charter agent specifies a type, use it directly if supported
      if (chartData.type) {
        const supportedTypes = ['pie', 'donut', 'bar', 'horizontalBar', 'line'];
        if (supportedTypes.includes(chartData.type)) {
          return chartData.type;
        }
        // Map variations to supported types
        const typeMap: Record<string, 'pie' | 'donut' | 'bar' | 'horizontalBar' | 'line'> = {
          'column': 'bar',
          'area': 'line'
        };
        if (typeMap[chartData.type]) {
          return typeMap[chartData.type];
        }
      }

      // Otherwise, make an intelligent guess based on the data
      // If data has dates/time series, use line chart
      if (chartData.data?.[0]?.date || chartData.data?.[0]?.year) return 'line';

      // If data represents parts of a whole (has percentages or small dataset), use pie
      if (chartData.data?.length <= 10 && chartData.data?.[0]?.value) return 'pie';

      // Default to bar chart for other cases
      return 'bar';
    };

    // Dynamically render all charts provided by the charter agent
    const chartEntries = Object.entries(chartsPayload);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {chartEntries.map(([key, chartData]: [string, any]) => {
          // Skip if no data
          if (!chartData?.data || chartData.data.length === 0) return null;

          const chartType = getChartType(chartData);
          const title = chartData.title || formatTitle(key);

          return (
            <div key={key} className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">{title}</h3>
              <ResponsiveContainer width="100%" height={300}>
                {chartType === 'pie' || chartType === 'donut' ? (
                  <PieChart>
                    <Pie
                      data={chartData.data}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label
                      outerRadius={100}
                      innerRadius={chartType === 'donut' ? 60 : 0}  // Donut has inner radius
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {chartData.data.map((entry: any, idx: number) => (
                        <Cell key={`cell-${idx}`} fill={entry.color || COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US')}`} />
                  </PieChart>
                ) : chartType === 'horizontalBar' ? (
                  // For horizontal bars, just use regular vertical bars with rotated labels
                  // Recharts horizontal layout can be problematic
                  <BarChart
                    data={chartData.data}
                    margin={{ left: 10, right: 30, top: 5, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={60}
                    />
                    <YAxis
                      tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US')}`} />
                    <Bar dataKey="value">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {chartData.data?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : chartType === 'bar' ? (
                  <BarChart data={chartData.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US')}`} />
                    <Bar dataKey="value" fill={chartData.color || COLORS[0]} />
                  </BarChart>
                ) : (
                  // Line chart for time series data
                  <LineChart data={chartData.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={chartData.xKey || "year"} />
                    <YAxis tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US')}`} />
                    <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} />
                  </LineChart>
                )}
              </ResponsiveContainer>

              {/* Add legend for pie/donut charts with many items */}
              {(chartType === 'pie' || chartType === 'donut') && chartData.data.length > 6 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {chartData.data.map((entry: any, idx: number) => (
                    <div key={entry.name} className="flex items-center text-sm">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: entry.color || COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-gray-600">{entry.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Retirement and Growth agents both save markdown in payload.analysis
  const renderAgentMarkdown = (analysis: string | undefined, emptyText: string, tint: string) => {
    if (!analysis) {
      return <div className="text-center py-12 text-gray-500">{emptyText}</div>;
    }

    return (
      <div className={`border rounded-lg p-6 ${tint}`}>
        <div className="prose prose-lg max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              h2: ({children}) => <h2 className="text-2xl font-semibold mt-6 mb-3 text-gray-800">{children}</h2>,
              h3: ({children}) => <h3 className="text-xl font-medium mb-2 text-gray-700">{children}</h3>,
              p: ({children}) => <p className="text-gray-700 leading-relaxed mb-4">{children}</p>,
              strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
              ul: ({children}) => <ul className="list-disc ml-6 mt-2 space-y-1">{children}</ul>,
              li: ({children}) => <li className="text-gray-700">{children}</li>,
              table: ({children}) => (
                <div className="overflow-x-auto mb-6"><table className="min-w-full text-sm bg-white rounded-lg">{children}</table></div>
              ),
              th: ({children}) => <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">{children}</th>,
              td: ({children}) => <td className="px-3 py-2 text-gray-700 border-b border-gray-100">{children}</td>,
            }}
          >
            {analysis}
          </ReactMarkdown>
        </div>
      </div>
    );
  };

  const renderRetirement = () =>
    renderAgentMarkdown(job?.retirement_payload?.analysis, 'No retirement projection available.', 'bg-ai-accent/10 border-ai-accent/20');

  const renderGrowth = () =>
    renderAgentMarkdown(
      job?.growth_payload?.analysis,
      'No high growth suggestions in this analysis. Run a new analysis to get them.',
      'bg-success/5 border-success/20'
    );

  return (
    <>
      <Head>
        <title>Analysis - FinFreedom AI</title>
      </Head>
      <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="bg-white rounded-lg shadow px-8 py-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-dark mb-2">Portfolio Analysis Results</h1>
                <p className="text-gray-600">
                  Showing the analysis from <strong>{whenLabel(job.created_at)}</strong>
                  {history[0]?.id === job.id ? ' (your latest)' : ''}
                </p>
              </div>
              <button
                onClick={() => router.push('/advisor-team')}
                className="px-6 py-3 bg-ai-accent text-white rounded-lg hover:bg-purple-700 font-semibold"
              >
                New Analysis
              </button>
            </div>
          </div>

          {/* Analysis history */}
          {history.length > 1 && (
            <div className="bg-white rounded-lg shadow px-6 py-4 mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">Your analyses ({history.length})</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {history.map((h, i) => (
                  <button
                    key={h.id}
                    onClick={() => router.push(`/analysis?job_id=${h.id}`)}
                    disabled={h.status !== 'completed'}
                    className={`shrink-0 text-left px-3 py-2 rounded-lg border text-sm transition ${
                      h.id === job.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 hover:border-primary disabled:opacity-50 disabled:hover:border-gray-200'
                    }`}
                  >
                    <span className="block font-medium whitespace-nowrap">{whenLabel(h.created_at)}</span>
                    <span className="block text-xs text-gray-500">
                      {h.id === job.id ? 'Viewing' : i === 0 ? 'Latest' : h.status === 'completed' ? 'Completed' : h.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px overflow-x-auto">
                {TABS.map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-3 px-6 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                      activeTab === tab
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow px-8 py-6">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'charts' && renderCharts()}
            {activeTab === 'retirement' && renderRetirement()}
            {activeTab === 'growth' && renderGrowth()}
          </div>
        </div>
      </div>
      </Layout>
    </>
  );
}