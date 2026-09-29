from pathlib import Path

app_path = Path('src/App.jsx')
api_path = Path('src/api.js')
app = app_path.read_text()
api = api_path.read_text()


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

# 1) Keep attendance policy client-side so optional location settings remain optional,
# and add a synchronous ref guard in addition to React's disabled state.
old = '''  const [continuousTracking, setContinuousTracking] = useState(true); // safe default until settings load
  const [allowLeadWithoutStartDay, setAllowLeadWithoutStartDay] = useState(false);
  const [dailyTarget, setDailyTarget] = useState(8); // overwritten by the salesman's actual profile below
  const [monthlyTarget, setMonthlyTarget] = useState(200);
  const lastPingSentRef = useRef(0);
'''
new = '''  const [continuousTracking, setContinuousTracking] = useState(true); // safe default until settings load
  const [allowLeadWithoutStartDay, setAllowLeadWithoutStartDay] = useState(false);
  const [attendanceLocationPolicy, setAttendanceLocationPolicy] = useState({ start: true, end: true });
  const [dailyTarget, setDailyTarget] = useState(8); // overwritten by the salesman's actual profile below
  const [monthlyTarget, setMonthlyTarget] = useState(200);
  const lastPingSentRef = useRef(0);
  const dayToggleInFlightRef = useRef(false);
'''
app = replace_once(app, old, new, 'attendance state')

# 2) Read the same Start/End location policy the backend enforces.
old = '''      .then((res) => {
        setContinuousTracking(res.locationSettings?.continuousGpsTracking ?? true);
        setAllowLeadWithoutStartDay(!!res.employeePermissions?.allowLeadWithoutStartDay);
        setEmployeeRepliesEnabled(res.messageSettings?.employeeRepliesEnabled !== false);
      })
'''
new = '''      .then((res) => {
        setContinuousTracking(res.locationSettings?.continuousGpsTracking ?? true);
        setAttendanceLocationPolicy({
          start: res.locationSettings?.requireLocationToStartDay !== false,
          end: res.locationSettings?.requireLocationToEndDay !== false,
        });
        setAllowLeadWithoutStartDay(!!res.employeePermissions?.allowLeadWithoutStartDay);
        setEmployeeRepliesEnabled(res.messageSettings?.employeeRepliesEnabled !== false);
      })
'''
app = replace_once(app, old, new, 'salesman location policy')

# 3) Every continuous watcher fix warms the attendance cache, not only throttled
# network pings. Preserve the fix's own sensor timestamp for age/audit fields.
old = '''    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        setGpsStatus("tracking");
        const now = Date.now();
        if (now - lastPingSentRef.current < PING_MIN_INTERVAL_MS) return; // throttle
        lastPingSentRef.current = now;
        const { latitude: lat, longitude: lng, speed, accuracy } = pos.coords;
        const batteryPct = await getBatteryPct();
        try {
          await api.salesmanPing({
            lat, lng,
            accuracyM: Math.round(accuracy),
            speedMps: speed || 0,
            batteryPct,
            isMockSuspected: false,
            capturedAt: new Date().toISOString(),
          });
        } catch {
          // A missed ping isn't fatal — the next watchPosition fix will retry.
        }
      },
'''
new = '''    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        setGpsStatus("tracking");
        const { latitude: lat, longitude: lng, speed, accuracy } = pos.coords;
        const capturedAt = pos.timestamp || Date.now();
        api.cacheAttendanceLocation({ lat, lng, accuracy, capturedAt });
        const now = Date.now();
        if (now - lastPingSentRef.current < PING_MIN_INTERVAL_MS) return; // throttle network pings only
        lastPingSentRef.current = now;
        const batteryPct = await getBatteryPct();
        try {
          await api.salesmanPing({
            lat, lng,
            accuracyM: Math.round(accuracy),
            speedMps: speed || 0,
            batteryPct,
            isMockSuspected: false,
            capturedAt: new Date(capturedAt).toISOString(),
          });
        } catch {
          // A missed ping isn't fatal — the next watchPosition fix will retry.
        }
      },
'''
app = replace_once(app, old, new, 'continuous GPS watcher')

# 4) Short, battery-bounded warm-up watcher. It runs before Start Day for fast
# first taps, and remains the warm-up path after Start when continuous tracking
# is disabled. It never sends a tracking ping to the server.
marker = '''  }, [dayStarted, continuousTracking, getBatteryPct]);

  // Flush the offline lead queue whenever we're online.
'''
warm = '''  }, [dayStarted, continuousTracking, getBatteryPct]);

  // Warm one accurate attendance fix without turning optional continuous tracking
  // into all-day tracking. Before Start Day this helps both modes; after Start Day
  // it only runs when Continuous GPS Tracking is OFF. Stop after 60s or <=50m.
  useEffect(() => {
    if (!navigator.geolocation) return;
    if (!attendanceLocationPolicy.start && !attendanceLocationPolicy.end) return;
    if (dayStarted && continuousTracking) return; // the active-day watcher above already keeps GPS warm

    let watchId = null;
    let stopTimer = null;

    const stopWarmup = () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      if (stopTimer) clearTimeout(stopTimer);
      stopTimer = null;
    };

    const startWarmup = () => {
      if (document.hidden || watchId != null) return;
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          api.cacheAttendanceLocation({
            lat,
            lng,
            accuracy,
            capturedAt: pos.timestamp || Date.now(),
          });
          if (Number.isFinite(accuracy) && accuracy <= 50) stopWarmup();
        },
        (err) => {
          // Do not keep prompting/retrying a denied warm-up. The attendance
          // resolver will surface the precise error if Start/End is tapped.
          if (err.code === err.PERMISSION_DENIED) stopWarmup();
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
      );
      stopTimer = setTimeout(stopWarmup, 60000);
    };

    const onVisibility = () => {
      if (document.hidden) stopWarmup();
      else startWarmup();
    };

    startWarmup();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", startWarmup);
    return () => {
      stopWarmup();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", startWarmup);
    };
  }, [dayStarted, continuousTracking, attendanceLocationPolicy.start, attendanceLocationPolicy.end]);

  // Flush the offline lead queue whenever we're online.
'''
app = replace_once(app, marker, warm, 'attendance warm watcher')

# 5) Remove the old competing getCurrentPosition preflight. One central resolver
# now owns cached/fresh/retry/fallback GPS and audit metadata.
old = '''  const getCurrentPositionAsync = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("unavailable"));
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 });
    });

  const [showClosing,setShowClosing]=useState(false);
  const [justToggled, setJustToggled] = useState(false); // brief "Started"/"Ended" confirmation flash

  const handleToggleDay = async closing => {
    if(dayStarted && !closing){setShowClosing(true);return;}
    if (togglingDay) return; // guard against double-taps while a request is already in flight
    setTogglingDay(true);
    try {
      const pos = await getCurrentPositionAsync().catch(() => null);
      const lat = pos?.coords.latitude;
      const lng = pos?.coords.longitude;
      if (dayStarted) {
        await api.endDayWithClosing({...closing,lat,lng});
        setShowClosing(false);
        setDayStartedFlag(session.id, false);
        setDayStartedState(false);
      } else {
        await api.salesmanDayStart(lat, lng);
        setDayStartedFlag(session.id, true);
        setDayStartedState(true);
      }
      setJustToggled(true);
      setTimeout(() => setJustToggled(false), 1600);
    } catch (err) {
      if(closing)throw err;
      setLoadError(err instanceof ApiError ? err.message : "Couldn't reach the server — try again.");
    } finally {
      setTogglingDay(false);
    }
  };
'''
new = '''  const [showClosing,setShowClosing]=useState(false);
  const [justToggled, setJustToggled] = useState(false); // brief "Started"/"Ended" confirmation flash

  const handleToggleDay = async closing => {
    if(dayStarted && !closing){setShowClosing(true);return;}
    if (dayToggleInFlightRef.current || togglingDay) return; // synchronous + UI guard against double taps
    dayToggleInFlightRef.current = true;
    setTogglingDay(true);
    try {
      if (dayStarted) {
        await api.endDayWithClosing(
          { ...closing },
          { locationRequired: attendanceLocationPolicy.end }
        );
        setShowClosing(false);
        setDayStartedFlag(session.id, false);
        setDayStartedState(false);
      } else {
        await api.salesmanDayStart({ locationRequired: attendanceLocationPolicy.start });
        setDayStartedFlag(session.id, true);
        setDayStartedState(true);
      }
      setJustToggled(true);
      setTimeout(() => setJustToggled(false), 1600);
    } catch (err) {
      if(closing)throw err;
      setLoadError(err instanceof ApiError ? err.message : "Couldn't reach the server — try again.");
    } finally {
      dayToggleInFlightRef.current = false;
      setTogglingDay(false);
    }
  };
'''
app = replace_once(app, old, new, 'Start/End Day resolver path')

# Restore the pre-existing Collections receipt URL exactly. This removes an
# unrelated typo from the earlier GPS-only edit.
wrong = '`${getApiBase()}/collections/${encodeURIComponent(key)}/${id}/receipt?format=pdf`'
right = '`${getApiBase()}/collections/${encodeURIComponent(key)}/payments/${id}/receipt?format=pdf`'
api = replace_once(api, wrong, right, 'collection receipt URL')

app_path.write_text(app)
api_path.write_text(api)
print('attendance GPS refactor applied')
