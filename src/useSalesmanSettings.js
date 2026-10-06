import { useEffect, useState } from "react";
import { api } from "./api.js";

export default function useSalesmanSettings({ setEmployeeRepliesEnabled }) {
  // Location starts disabled/unknown. Never wake GPS from optimistic defaults
  // before the employee-specific policy has been loaded from the server.
  const [locationPolicyLoaded, setLocationPolicyLoaded] = useState(false);
  const [gpsLocation, setGpsLocation] = useState(false);
  const [continuousTracking, setContinuousTracking] = useState(false);
  const [allowLeadWithoutStartDay, setAllowLeadWithoutStartDay] = useState(false);
  const [attendanceLocationPolicy, setAttendanceLocationPolicy] = useState({ start: false, end: false });
  const [dailyTarget, setDailyTarget] = useState(8);
  const [monthlyTarget, setMonthlyTarget] = useState(200);
  const [employeeCity, setEmployeeCity] = useState("");

  useEffect(() => {
    let mounted = true;
    api.salesmanGetProfile()
      .then((res) => {
        if (!mounted) return;
        setDailyTarget(res.profile?.daily_target || 8);
        setMonthlyTarget(res.profile?.monthly_target || 200);
        setEmployeeCity(res.profile?.city || "");
      })
      .catch(() => { /* profile targets do not affect location safety */ });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    setLocationPolicyLoaded(false);
    api.salesmanGetSettings()
      .then((res) => {
        if (!mounted) return;
        const location = res.locationSettings;
        if (!location || typeof location.gpsLocation !== "boolean") {
          throw new Error("Employee location policy is unavailable");
        }
        const enabled = location.gpsLocation === true;
        setGpsLocation(enabled);
        setContinuousTracking(enabled && location.continuousGpsTracking === true);
        setAttendanceLocationPolicy({
          start: enabled && location.requireLocationToStartDay === true,
          end: enabled && location.requireLocationToEndDay === true,
        });
        setAllowLeadWithoutStartDay(!!res.employeePermissions?.allowLeadWithoutStartDay);
        setEmployeeRepliesEnabled?.(res.messageSettings?.employeeRepliesEnabled !== false);
        setLocationPolicyLoaded(true);
      })
      .catch(() => {
        if (!mounted) return;
        // Fail closed for GPS acquisition: a settings failure must never turn
        // GPS on, start continuous tracking, or make up Start/End requirements.
        setGpsLocation(false);
        setContinuousTracking(false);
        setAttendanceLocationPolicy({ start: false, end: false });
        setAllowLeadWithoutStartDay(false);
        setLocationPolicyLoaded(false);
      });
    return () => { mounted = false; };
  }, [setEmployeeRepliesEnabled]);

  return {
    locationPolicyLoaded,
    gpsLocation,
    continuousTracking,
    allowLeadWithoutStartDay,
    attendanceLocationPolicy,
    dailyTarget,
    monthlyTarget,
    employeeCity,
  };
}
