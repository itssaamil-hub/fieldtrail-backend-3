import { useEffect, useState } from "react";
import { api } from "./api.js";

export default function useSalesmanSettings({ setEmployeeRepliesEnabled }) {
  const [continuousTracking, setContinuousTracking] = useState(true);
  const [allowLeadWithoutStartDay, setAllowLeadWithoutStartDay] = useState(false);
  const [attendanceLocationPolicy, setAttendanceLocationPolicy] = useState({ start: true, end: true });
  const [dailyTarget, setDailyTarget] = useState(8);
  const [monthlyTarget, setMonthlyTarget] = useState(200);

  useEffect(() => {
    let mounted = true;
    api.salesmanGetProfile()
      .then((res) => {
        if (!mounted) return;
        setDailyTarget(res.profile?.daily_target || 8);
        setMonthlyTarget(res.profile?.monthly_target || 200);
      })
      .catch(() => { /* keep safe defaults on failure */ });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    api.salesmanGetSettings()
      .then((res) => {
        if (!mounted) return;
        setContinuousTracking(res.locationSettings?.continuousGpsTracking ?? true);
        setAttendanceLocationPolicy({
          start: res.locationSettings?.requireLocationToStartDay !== false,
          end: res.locationSettings?.requireLocationToEndDay !== false,
        });
        setAllowLeadWithoutStartDay(!!res.employeePermissions?.allowLeadWithoutStartDay);
        setEmployeeRepliesEnabled?.(res.messageSettings?.employeeRepliesEnabled !== false);
      })
      .catch(() => {
        if (!mounted) return;
        // Fail closed: if settings cannot load, Start Day remains required.
        setAllowLeadWithoutStartDay(false);
      });
    return () => { mounted = false; };
  }, [setEmployeeRepliesEnabled]);

  return {
    continuousTracking,
    allowLeadWithoutStartDay,
    attendanceLocationPolicy,
    dailyTarget,
    monthlyTarget,
  };
}
