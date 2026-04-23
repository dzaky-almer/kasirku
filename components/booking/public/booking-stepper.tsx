"use client";

export function BookingStepper({
  currentStep,
  steps,
}: {
  currentStep: number;
  steps: string[];
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {steps.map((step, index) => {
        const active = index === currentStep;
        const completed = index < currentStep;

        return (
          <div key={step} className="space-y-2">
            <div
              className={`h-2 rounded-full transition ${
                completed ? "bg-emerald-500" : active ? "bg-slate-950" : "bg-slate-200"
              }`}
            />
            <p className={`text-[11px] font-medium ${active ? "text-slate-950" : "text-slate-500"}`}>{step}</p>
          </div>
        );
      })}
    </div>
  );
}
