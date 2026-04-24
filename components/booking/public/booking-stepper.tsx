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
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition ${
                  completed
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-amber-700 text-white"
                      : "bg-white text-gray-400 border border-gray-200"
                }`}
              >
                {index + 1}
              </div>
              <div
                className={`h-1.5 flex-1 rounded-full transition ${
                  completed ? "bg-emerald-500" : active ? "bg-amber-300" : "bg-gray-200"
                }`}
              />
            </div>
            <p className={`text-[11px] font-medium ${active ? "text-gray-900" : completed ? "text-emerald-600" : "text-gray-500"}`}>
              {step}
            </p>
          </div>
        );
      })}
    </div>
  );
}
