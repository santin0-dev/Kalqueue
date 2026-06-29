import { LoadingState } from "@/components/ui/loading-state";

export default function Loading() {
  return (
    <LoadingState
      fullScreen
      title="Loading"
      message="Preparing your workspace..."
    />
  );
}
