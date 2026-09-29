import { useCallback, useState } from "react";

export default function useSalesmanTasks() {
  const [pendingTasks, setPendingTasks] = useState(null);

  const handlePendingTasksChange = useCallback((count) => {
    setPendingTasks(count);
  }, []);

  return {
    pendingTasks,
    handlePendingTasksChange,
  };
}
