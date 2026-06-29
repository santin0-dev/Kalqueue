interface LoadingStateProps {
  title?: string;
  message?: string;
  fullScreen?: boolean;
}

export function LoadingState({
  title = "Loading",
  message = "Please wait...",
  fullScreen = false,
}: LoadingStateProps) {
  const content = (
    <div className="flex min-w-64 flex-col items-center rounded-lg border border-gray-100 bg-white px-8 py-7 text-center shadow-lg">
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-teal-700 border-t-transparent" />
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 px-4 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return (
    <div className="flex min-h-[320px] items-center justify-center px-4">
      {content}
    </div>
  );
}
