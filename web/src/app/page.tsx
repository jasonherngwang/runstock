import { StockProvider } from "@/contexts/StockContext";
import { ChartSelectionProvider } from "@/contexts/ChartSelectionContext";
import { StockDashboard } from "@/components/StockDashboard";
import { GpuDetailChart } from "@/components/GpuDetailChart";

export default function Home() {
  return (
    <StockProvider>
      <ChartSelectionProvider>
          <div className="min-h-screen">
            <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-deep)]/95 backdrop-blur-sm">
              <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
                <div>
                  <h1 className="font-sans text-xl font-bold tracking-tight text-[var(--text-primary)]">
                    RunStock
                  </h1>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                    RunPod GPU availability & price history
                  </p>
                </div>
              </div>
            </header>
            <main className="mx-auto max-w-[1600px] px-6 py-8">
              <div className="mb-10">
                <GpuDetailChart />
              </div>
              <section>
                <StockDashboard />
              </section>
            </main>
          </div>
        </ChartSelectionProvider>
    </StockProvider>
  );
}
