import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Calendar, Clock, AlertTriangle, Shield, Check, Info, 
  Play, Pause, Sliders, RefreshCw, TrendingUp, Cpu, HelpCircle, 
  Wrench, Thermometer, Zap, Volume2, Database, ArrowRight, Eye, 
  Sparkles, Plus, Trash2, ArrowLeftRight, FileDown, FileUp
} from 'lucide-react';

// Interfaces for CNC Telemetry Data
interface TelemetryPoint {
  timestamp: string; // ISO format or scannable time
  healthIndex: number; // 0 - 100
  vibration: number; // mm/s (0 - 6.0, nominal < 1.5)
  temperature: number; // °C (20 - 95, nominal < 55)
  toolWear: number; // µm (0 - 500, nominal < 200)
  coolantPressure: number; // PSI (0 - 80, nominal 40 - 50)
  acousticNoise: number; // dB (50 - 110, nominal < 78)
  motorCurrent: number; // Amperes (0 - 35, nominal < 15)
  label: string; // Brief snapshot description
}

// Pre-packaged critical historical events for quick engineering replay
const CRITICAL_HISTORICAL_EVENTS: TelemetryPoint[] = [
  {
    timestamp: "2026-05-19T10:26:00",
    healthIndex: 96,
    vibration: 1.05,
    temperature: 42.4,
    toolWear: 72.0,
    coolantPressure: 44.8,
    acousticNoise: 71.5,
    motorCurrent: 11.2,
    label: "Standard Nominal Baseline (T-12 Tooling)"
  },
  {
    timestamp: "2026-05-18T14:30:00",
    healthIndex: 41,
    vibration: 4.85,
    temperature: 68.2,
    toolWear: 195.0,
    coolantPressure: 41.5,
    acousticNoise: 94.2,
    motorCurrent: 24.8,
    label: "Axis-3 Spindle Unbalance Deviation"
  },
  {
    timestamp: "2026-05-17T03:15:00",
    healthIndex: 22,
    vibration: 1.95,
    temperature: 87.5,
    toolWear: 340.0,
    coolantPressure: 11.2,
    acousticNoise: 88.0,
    motorCurrent: 18.5,
    label: "Coolant Delivery Pump Starvation"
  },
  {
    timestamp: "2026-05-15T22:00:00",
    healthIndex: 56,
    vibration: 2.30,
    temperature: 51.0,
    toolWear: 425.0,
    coolantPressure: 43.1,
    acousticNoise: 82.4,
    motorCurrent: 21.3,
    label: "Carbide Cutter Blade Wear Out Event"
  },
  {
    timestamp: "2026-05-14T08:45:00",
    healthIndex: 68,
    vibration: 1.20,
    temperature: 45.0,
    toolWear: 110.0,
    coolantPressure: 64.5,
    acousticNoise: 74.0,
    motorCurrent: 28.2,
    label: "Feed-Drive Motor Over-current Overload"
  }
];

// Generate an initial 24-hour historical trace around the active timeframe
const generateHistoricalTimeline = (centerTime: Date, count: number = 24): TelemetryPoint[] => {
  const points: TelemetryPoint[] = [];
  const baseTime = new Date(centerTime.getTime());
  
  for (let i = count - 1; i >= 0; i--) {
    const timeOffset = new Date(baseTime.getTime() - i * 60 * 60 * 1000); // 1-hour increments
    const hourFactor = timeOffset.getHours();
    
    // Create a deterministic yet organic waving telemetry curve
    const vibrationNoise = 0.4 * Math.sin(hourFactor * 0.4) + 1.1;
    const tempNoise = 5 * Math.cos(hourFactor * 0.3) + 42;
    const toolWearAcc = Math.min(450, 40 + (hourFactor * 3.5) + (timeOffset.getDate() % 5) * 20);
    const pressureNoise = 4 * Math.sin(hourFactor * 0.5) + 43;
    const noiseLevel = 65 + vibrationNoise * 8 + (hourFactor % 4);
    const motorAmp = 11 + 2 * Math.sin(hourFactor * 0.8);
    
    // Mathematically aggregate to form an elegant simulated health score
    const avgStress = (
      (vibrationNoise / 3.0) + 
      (tempNoise / 70.0) + 
      (toolWearAcc / 400.0) + 
      (Math.abs(pressureNoise - 45) / 20.0)
    ) / 4;
    const calculatedHealth = Math.round(Math.max(15, Math.min(100, 100 - (avgStress * 50))));

    points.push({
      timestamp: timeOffset.toISOString().substring(0, 16),
      healthIndex: calculatedHealth,
      vibration: parseFloat(vibrationNoise.toFixed(2)),
      temperature: parseFloat(tempNoise.toFixed(1)),
      toolWear: Math.round(toolWearAcc),
      coolantPressure: parseFloat(pressureNoise.toFixed(1)),
      acousticNoise: parseFloat(noiseLevel.toFixed(1)),
      motorCurrent: parseFloat(motorAmp.toFixed(1)),
      label: "Autonomous Operational Telemetry"
    });
  }
  return points;
};

export default function App() {
  // System states
  const [isLiveMode, setIsLiveMode] = useState<boolean>(true);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string>("2026-05-19T10:26");
  
  // Simulation and Alert states
  const [isAlarmMuted, setIsAlarmMuted] = useState<boolean>(false);
  const [isStressSimulated, setIsStressSimulated] = useState<boolean>(false);
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);

  // High fidelity stream arrays
  const [historicalData, setHistoricalData] = useState<TelemetryPoint[]>(() => {
    return generateHistoricalTimeline(new Date("2026-05-19T10:26:00"));
  });

  // Real-time appended streaming array for Live Mode
  const [liveStreamData, setLiveStreamData] = useState<TelemetryPoint[]>(() => {
    return generateHistoricalTimeline(new Date("2026-05-19T10:26:00"), 15);
  });

  // State for user uploaded anomaly metrics
  const [uploadedFilesFeedback, setUploadedFilesFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Anomaly slider tolerance configuration
  const [vibrationAlertLimit, setVibrationAlertLimit] = useState<number>(2.5); // mm/s
  const [temperatureAlertLimit, setTemperatureAlertLimit] = useState<number>(65.0); // °C

  // Date Comparator State
  const [compareDateA, setCompareDateA] = useState<string>("2026-05-19T10:26");
  const [compareDateB, setCompareDateB] = useState<string>("2026-05-18T14:30");
  const [showComparator, setShowComparator] = useState<boolean>(false);

  // Active highlighted parameters tooltip trace
  const [activeTrendPoint, setActiveTrendPoint] = useState<TelemetryPoint | null>(null);

  // Form custom state for date & hour picker
  const [customDate, setCustomDate] = useState<string>("2026-05-19");
  const [customTime, setCustomTime] = useState<string>("10:26");

  // Live timer simulation effect
  useEffect(() => {
    if (!isLiveMode) return;

    const timer = setInterval(() => {
      setLiveStreamData(prev => {
        const lastPoint = prev[prev.length - 1];
        const nextTime = new Date(new Date(lastPoint.timestamp).getTime() + 15 * 1000); // add 15s
        
        // Push a realistic, minorly oscillating real-time data point
        const driftFactor = Math.sin(Date.now() * 0.0001);
        const randFluc = (Math.random() - 0.5) * 0.1;
        
        // Elevate variables significantly if stress simulation is enabled
        const vibration = isStressSimulated
          ? parseFloat(Math.max(3.8, Math.min(5.8, lastPoint.vibration + 0.35 + (Math.random() - 0.5) * 0.15)).toFixed(2))
          : parseFloat(Math.max(0.4, Math.min(5.8, lastPoint.vibration + driftFactor * 0.15 + randFluc)).toFixed(2));
          
        const temperature = isStressSimulated
          ? parseFloat(Math.max(76.0, Math.min(94.5, lastPoint.temperature + 1.8 + (Math.random() - 0.5) * 1.0)).toFixed(1))
          : parseFloat(Math.max(22, Math.min(94, lastPoint.temperature + driftFactor * 0.8 + randFluc * 5)).toFixed(1));
          
        const toolWear = isStressSimulated
          ? Math.min(500, lastPoint.toolWear + Math.floor(Math.random() * 3) + 2)
          : Math.min(500, lastPoint.toolWear + (Math.random() > 0.85 ? 1 : 0));
          
        const coolantPressure = isStressSimulated
          ? parseFloat(Math.max(12.0, Math.min(30.0, lastPoint.coolantPressure - 1.5 + (Math.random() - 0.5) * 2.0)).toFixed(1))
          : parseFloat(Math.max(10, Math.min(75, lastPoint.coolantPressure + randFluc * 2)).toFixed(1));
          
        const acousticNoise = parseFloat(Math.max(55, Math.min(108, 70 + vibration * 6 + randFluc * 3)).toFixed(1));
        const motorCurrent = parseFloat(Math.max(2, Math.min(32, 10 + vibration * 2.2 + randFluc)).toFixed(1));

        // Evaluate aggregate health index
        const stressScore = (
          (vibration / vibrationAlertLimit) * 0.35 +
          (temperature / temperatureAlertLimit) * 0.3 +
          (toolWear / 400.0) * 0.2 +
          (Math.abs(coolantPressure - 45) / 20.0) * 0.15
        );
        const healthIndex = Math.round(Math.max(8, Math.min(100, 100 - (stressScore * 40))));

        const newPoint: TelemetryPoint = {
          timestamp: nextTime.toISOString().substring(0, 16),
          healthIndex,
          vibration,
          temperature,
          toolWear,
          coolantPressure,
          acousticNoise,
          motorCurrent,
          label: isStressSimulated ? "Simulated High Load Stress" : "Live CNC Telemetry Stream"
        };

        // Update selectedTimestamp with the latest stream coordinate
        setSelectedTimestamp(newPoint.timestamp);

        // Keep buffer size clamped to latest 20 points
        const shifted = prev.slice(1);
        return [...shifted, newPoint];
      });
    }, 2500);

    return () => clearInterval(timer);
  }, [isLiveMode, vibrationAlertLimit, temperatureAlertLimit, isStressSimulated]);

  // Synchronize calendar custom text with the selectedTimestamp state
  useEffect(() => {
    if (selectedTimestamp) {
      const parts = selectedTimestamp.split('T');
      if (parts[0]) setCustomDate(parts[0]);
      if (parts[1]) setCustomTime(parts[1]);
    }
  }, [selectedTimestamp]);

  // Handle manual coordinate changes from custom date-picker
  const handleApplyCustomMoment = () => {
    const formattedMoment = `${customDate}T${customTime}`;
    setSelectedTimestamp(formattedMoment);
    
    // Check if this matches a preset or needs custom interpolation
    const isMatched = historicalData.some(p => p.timestamp === formattedMoment);
    if (!isMatched) {
      // Generate standard interpolated values to fit custom curve
      const customPoint = generateCustomInterpolatedPoint(formattedMoment);
      setHistoricalData(prev => {
        // Remove duplicate and append sorted
        const cleaned = prev.filter(p => p.timestamp !== formattedMoment);
        const updated = [...cleaned, customPoint].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        return updated.slice(-30); // Maintain a buffer size
      });
    }

    setUploadedFilesFeedback({
      type: 'success',
      text: `Successfully re-calibrated view grid to historical snapshot coordinate: [${formattedMoment.replace('T', ' ')}]`
    });
  };

  // Helper to generate a realistic, stable data point for any custom date/time requested
  const generateCustomInterpolatedPoint = (timeString: string): TelemetryPoint => {
    const epoch = new Date(timeString).getTime() || Date.now();
    const seed = Math.sin(epoch * 0.000001);
    
    const vibration = parseFloat(Math.max(0.6, Math.min(4.8, 1.2 + seed * 0.8)).toFixed(2));
    const temperature = parseFloat(Math.max(25, Math.min(88, 43.5 + seed * 12.0)).toFixed(1));
    const toolWear = Math.round(Math.max(20, Math.min(480, 150 + seed * 100)));
    const coolantPressure = parseFloat(Math.max(15, Math.min(70, 44.2 - seed * 5.5)).toFixed(1));
    const acousticNoise = parseFloat(Math.max(60, Math.min(102, 72.5 + vibration * 5)).toFixed(1));
    const motorCurrent = parseFloat(Math.max(4, Math.min(29, 11.5 + seed * 3.2)).toFixed(1));

    const stressScore = (
      (vibration / vibrationAlertLimit) * 0.35 +
      (temperature / temperatureAlertLimit) * 0.3 +
      (toolWear / 400.0) * 0.2 +
      (Math.abs(coolantPressure - 45) / 20.0) * 0.15
    );
    const healthIndex = Math.round(Math.max(12, Math.min(100, 100 - (stressScore * 42))));

    return {
      timestamp: timeString,
      healthIndex,
      vibration,
      temperature,
      toolWear,
      coolantPressure,
      acousticNoise,
      motorCurrent,
      label: "Interpolated Mathematical Archive Node"
    };
  };

  // Retrieve telemetry matching the selected timestamp
  const getActivePoint = (): TelemetryPoint => {
    const dataPool = isLiveMode ? liveStreamData : historicalData;
    const found = dataPool.find(p => p.timestamp === selectedTimestamp);
    if (found) return found;
    
    // Fallback to closest available chronological point
    if (dataPool.length > 0) {
      return dataPool[dataPool.length - 1];
    }
    
    // Defend against completely empty data
    return CRITICAL_HISTORICAL_EVENTS[0];
  };

  const activeTelemetry = getActivePoint();

  // Trigger highlight flash on active telemetry update
  useEffect(() => {
    setIsFlashActive(true);
    const timer = setTimeout(() => {
      setIsFlashActive(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [activeTelemetry.timestamp, activeTelemetry.healthIndex, activeTelemetry.vibration, activeTelemetry.temperature]);

  // Calculate dynamic physical metrics deviations to find the "Top Parameter Responsible"
  const getAnomalousRanking = (pt: TelemetryPoint) => {
    const factors = [
      { name: "Spindle Vibration", val: pt.vibration, normMax: 1.5, ratio: pt.vibration / 1.5, unit: "mm/s", icon: "🌀" },
      { name: "Spindle Temperature", val: pt.temperature, normMax: 55.0, ratio: pt.temperature / 55.0, unit: "°C", icon: "🌡️" },
      { name: "Tool Carriage Wear", val: pt.toolWear, normMax: 200.0, ratio: pt.toolWear / 200.0, unit: "µm", icon: "💎" },
      { name: "Coolant Delivery Pressure", val: Math.abs(pt.coolantPressure - 45), normMax: 10.0, ratio: Math.abs(pt.coolantPressure - 45) / 10.0, unit: "PSI (Dev)", icon: "💧" },
      { name: "Feed-Drive Motor Load", val: pt.motorCurrent, normMax: 15.0, ratio: pt.motorCurrent / 15.0, unit: "A", icon: "⚡" },
      { name: "Acoustic Envelope", val: pt.acousticNoise, normMax: 78.0, ratio: pt.acousticNoise / 78.0, unit: "dB", icon: "🔊" }
    ];

    // Sort by ratio in descending order
    return factors.sort((a, b) => b.ratio - a.ratio);
  };

  const parametersBySeverity = getAnomalousRanking(activeTelemetry);
  const primaryAnomalyMetric = parametersBySeverity[0];

  // Dynamic remaining useful life RUL forecasting (calculated dynamically based on stress factors)
  const calculateRUL = (pt: TelemetryPoint): { hours: number; status: string; color: string; ratio: number } => {
    // Base RUL is 450 operating hours for a pristine machine to project into June 2026 starting from May baseline dataset
    const vibrationStress = Math.max(0, pt.vibration - 1.2) * 55;
    const temperatureStress = Math.max(0, pt.temperature - 50) * 4.5;
    const toolWearStress = (pt.toolWear / 500) * 180;
    const structuralFatigue = vibrationStress + temperatureStress + toolWearStress;

    const remainingHours = Math.max(0, parseFloat((450 - structuralFatigue).toFixed(1)));
    
    let status = "Healthy Lifetime Cycle";
    let color = "text-emerald-400";
    let ratio = remainingHours / 450;

    if (remainingHours <= 40) {
      status = "Critical Depletion / Replacement Overdue";
      color = "text-rose-500 animate-pulse font-bold";
    } else if (remainingHours <= 120) {
      status = "Accelerated Wear / Maintenance Window Active";
      color = "text-amber-400 font-semibold";
    } else if (remainingHours <= 250) {
      status = "Stable Operating Interval";
      color = "text-cyan-400";
    }

    return { hours: remainingHours, status, color, ratio };
  };

  const activeRUL = calculateRUL(activeTelemetry);

  const getActiveAlerts = (pt: TelemetryPoint) => {
    const alerts = [];
    if (pt.vibration >= vibrationAlertLimit) {
      alerts.push({
        id: "vib-01",
        severity: "CRITICAL",
        title: "Spindle Mechanical Vibration Breach",
        message: `Vibration reading of ${pt.vibration} mm/s exceeds active alert tolerance threshold (${vibrationAlertLimit} mm/s). Severe misalignment or bearing decay suspected.`,
        icon: "🌀",
        color: "border-rose-500 text-rose-400 bg-rose-500/10",
        action: "Reduce spindle RPM by 25% instantly, check chuck locking jaws."
      });
    }
    if (pt.temperature >= temperatureAlertLimit) {
      alerts.push({
        id: "temp-01",
        severity: "CRITICAL",
        title: "Thermal Spindle Bearing Runaway",
        message: `Spindle bearing temperature has spiked to ${pt.temperature} °C, breaching safety limit of ${temperatureAlertLimit} °C. High friction risk detected.`,
        icon: "🌡️",
        color: "border-rose-500 text-rose-400 bg-rose-500/10",
        action: "Flush auxiliary coolant fluid, pause cutting loop immediately."
      });
    }
    if (pt.toolWear >= 300) {
      alerts.push({
        id: "tool-01",
        severity: "WARNING",
        title: "Abrasive Flank Tooling Wear Limit",
        message: `Tool cutter flank wear has reached ${pt.toolWear} µm (Nominal Limit: 200 µm, Critical: 450 µm). G-code processing accuracy may degrade.`,
        icon: "💎",
        color: "border-amber-500 text-amber-400 bg-amber-500/10",
        action: "Dispatch carbide tip slot replacement package, swap slot code."
      });
    }
    if (pt.coolantPressure < 25) {
      alerts.push({
        id: "cool-01",
        severity: "WARNING",
        title: "Coolant Delivery Pump Underpressure",
        message: `Coolant hydraulic pressure has fallen to ${pt.coolantPressure} PSI (Nominal Range: 40-50 PSI). High thermal load buildup risk.`,
        icon: "💧",
        color: "border-amber-500 text-amber-400 bg-amber-500/10",
        action: "Top off water-soluble fluid tank volume, inspect hydraulic valve seals."
      });
    }
    if (pt.motorCurrent >= 25) {
      alerts.push({
        id: "motor-01",
        severity: "WARNING",
        title: "Drive Motor Electrical Over-Current",
        message: `Spindle axis drive motor current has drawn ${pt.motorCurrent} Amps (Nominal Limit: 15 Amps). Excessive cutting resistance detected.`,
        icon: "⚡",
        color: "border-cyan-500 text-cyan-400 bg-cyan-500/10",
        action: "Inspect workpiece material hardness spec, slow down feed rate override."
      });
    }
    return alerts;
  };

  const activeAlerts = getActiveAlerts(activeTelemetry);

  // Helper to format Date based on selectedTimestamp offset
  const getEstimatedDate = (baseTimeStr: string, offsetHours: number) => {
    try {
      const baseDate = new Date(baseTimeStr);
      if (isNaN(baseDate.getTime())) return { date: "Invalid Base Timestamp", daysStr: "N/A" };
      
      const targetDate = new Date(baseDate.getTime() + offsetHours * 60 * 60 * 1000);
      const formattedDate = targetDate.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      // Calculate diff relative to base date
      const diffDays = offsetHours / 24;
      let daysStr = "";
      if (offsetHours <= 0) {
        daysStr = "IMMEDIATE (Action Overdue)";
      } else if (offsetHours < 1) {
        daysStr = `In approx. ${offsetHours.toFixed(1)} operating hours`;
      } else if (diffDays < 1) {
        daysStr = `In approx. ${(diffDays * 24).toFixed(1)} operating hours (today)`;
      } else {
        daysStr = `In approx. ${diffDays.toFixed(1)} operating days`;
      }

      return { date: formattedDate, daysStr, hours: offsetHours };
    } catch (e) {
      return { date: "Error estimating date", daysStr: "N/A", hours: 0 };
    }
  };

  // Failure date calculation: when activeRUL hits 0
  const failurePrediction = getEstimatedDate(activeTelemetry.timestamp, activeRUL.hours);

  // Maintenance is required when activeRUL hits 120 (or immediately if already below 120)
  const maintenanceHoursRemaining = Math.max(0, activeRUL.hours - 120);
  const maintenancePrediction = getEstimatedDate(activeTelemetry.timestamp, maintenanceHoursRemaining);

  // Dynamic Recommended Actions Engine
  const getActionRecommendation = (pt: TelemetryPoint): { action: string; urgency: string; color: string; code: string } => {
    if (pt.healthIndex >= 85) {
      return {
        action: "No immediate hardware interventions required. Continue standard CNC g-code spindle cycles. Scheduled preventative lubrication block in 48 operating hours.",
        urgency: "Nominal Operating Standards",
        color: "text-emerald-400 bg-emerald-500/5 border-emerald-500/20",
        code: "REC-A01-OK"
      };
    } else if (primaryAnomalyMetric.name === "Spindle Vibration") {
      return {
        action: "⚠️ High amplitude vibration localized in Spindle Axis. Immediately schedule axis recalibration, check spindle jaw tightness, and reduce spindle motor velocity by 25% (Override index to 75%).",
        urgency: "High Priority Remediation Required",
        color: "text-rose-400 bg-rose-500/5 border-rose-500/20",
        code: "REC-V82-VIB"
      };
    } else if (primaryAnomalyMetric.name === "Spindle Temperature") {
      return {
        action: "🔥 Critical Spindle bearing temperature rise detected. Flush auxiliary coolant channels, inspect feed valve flow coefficients, and clean fine chip sediment block from coolant nozzle filter.",
        urgency: "Immediate Temperature Flush Action",
        color: "text-rose-400 bg-rose-500/5 border-rose-500/20",
        code: "REC-T45-THR"
      };
    } else if (primaryAnomalyMetric.name === "Tool Carriage Wear") {
      return {
        action: "💎 Extreme abrasive wear detected on carbide insert cutting flank. Change carbide tip tool slot T-12, review diamond flank coatings, and check work-piece hardness alignment metrics.",
        urgency: "Change Tool Insert Slot T-12",
        color: "text-amber-400 bg-amber-500/5 border-amber-500/20",
        code: "REC-W91-CAR"
      };
    } else if (pt.coolantPressure < 25) {
      return {
        action: "💧 Inadequate coolant pump hydraulic delivery pressure. Re-pressurize pump accumulator block, inspect hydraulic seals for aqueous fluid leaks, and top off water-soluble fluid volume.",
        urgency: "Low Hydraulic Fluid Action Required",
        color: "text-rose-400 bg-rose-500/5 border-rose-500/20",
        code: "REC-P09-COOL"
      };
    } else {
      return {
        action: "🔧 Operational efficiency indices are moderately stable, but bearing stress markers indicate standard friction creep. Clean sliding guide rails, lubricate linear ball screws, and inspect thermal dissipation fans.",
        urgency: "Routine Preventative Service",
        color: "text-cyan-400 bg-cyan-500/5 border-cyan-500/20",
        code: "REC-M50-ROU"
      };
    }
  };

  const recommendation = getActionRecommendation(activeTelemetry);

  // Parse custom mock stream uploads (.json or .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFilesFeedback(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let points: any[] = [];

        if (file.name.endsWith('.json')) {
          points = JSON.parse(text);
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n').filter(Boolean);
          if (lines.length < 2) throw new Error("CSV file lacks rows");
          const headers = lines[0].split(',').map(h => h.trim());
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const item: any = {};
            headers.forEach((h, idx) => {
              item[h] = values[idx];
            });
            points.push(item);
          }
        } else {
          throw new Error("Unsupported format. Please supply a standard .json or .csv telemetry stream file.");
        }

        // Validate and map fields to TelemetryPoint array
        const normalized: TelemetryPoint[] = points.map((p, index) => {
          const vibration = parseFloat(p.vibration || p.Vibration || 1.1);
          const temperature = parseFloat(p.temperature || p.Temperature || 42);
          const toolWear = parseInt(p.toolWear || p.tool_wear || p.ToolWear || 80);
          const coolantPressure = parseFloat(p.coolantPressure || p.coolant_pressure || p.Pressure || 45);
          const acousticNoise = parseFloat(p.acousticNoise || p.noise || 72);
          const motorCurrent = parseFloat(p.motorCurrent || p.current || 12);
          const healthIndex = parseInt(p.healthIndex || p.health || 95);

          return {
            timestamp: p.timestamp || p.time || new Date(Date.now() - index * 60000).toISOString().substring(0, 16),
            healthIndex: isNaN(healthIndex) ? 90 : healthIndex,
            vibration: isNaN(vibration) ? 1.0 : vibration,
            temperature: isNaN(temperature) ? 40 : temperature,
            toolWear: isNaN(toolWear) ? 50 : toolWear,
            coolantPressure: isNaN(coolantPressure) ? 45 : coolantPressure,
            acousticNoise: isNaN(acousticNoise) ? 70 : acousticNoise,
            motorCurrent: isNaN(motorCurrent) ? 11 : motorCurrent,
            label: p.label || "Uploaded Industrial Stream Data"
          };
        });

        // Set telemetry source
        setIsLiveMode(false);
        setHistoricalData(normalized);
        if (normalized.length > 0) {
          setSelectedTimestamp(normalized[normalized.length - 1].timestamp);
        }

        setUploadedFilesFeedback({
          type: 'success',
          text: `Success: Loaded ${normalized.length} CNC telemetry coordinates. Health index recalibrated automatically.`
        });
      } catch (err: any) {
        setUploadedFilesFeedback({
          type: 'error',
          text: `Upload Failed: ${err.message || 'Check file columns.'}`
        });
      }
    };
    reader.readAsText(file);
  };

  // Helper trigger to download standard CNC simulation data template
  const triggerTemplateDownload = () => {
    const templateData = [
      {
        timestamp: "2026-07-19T10:00",
        healthIndex: 98,
        vibration: 0.95,
        temperature: 38.5,
        toolWear: 45,
        coolantPressure: 46.2,
        acousticNoise: 68.2,
        motorCurrent: 9.8,
        label: "Pristine Calibration Frame"
      },
      {
        timestamp: "2026-07-19T10:15",
        healthIndex: 35,
        vibration: 5.42,
        temperature: 72.8,
        toolWear: 310,
        coolantPressure: 38.1,
        acousticNoise: 97.4,
        motorCurrent: 26.5,
        label: "Simulated Axis Friction Spill"
      }
    ];
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(templateData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "cnc_telemetry_template.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Retrieve date statistics for comparison module
  const getComparePoint = (timeStr: string): TelemetryPoint => {
    const combinedPool = [...historicalData, ...liveStreamData, ...CRITICAL_HISTORICAL_EVENTS];
    const matched = combinedPool.find(p => p.timestamp === timeStr);
    if (matched) return matched;
    
    // Interpolate on the fly if not exists
    return generateCustomInterpolatedPoint(timeStr);
  };

  const compPointA = getComparePoint(compareDateA);
  const compPointB = getComparePoint(compareDateB);

  // Health categories and styles
  const getHealthMeta = (score: number) => {
    if (score >= 85) return { text: "OPTIMAL", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", glow: "bg-emerald-500" };
    if (score >= 70) return { text: "STABLE", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", glow: "bg-cyan-500" };
    if (score >= 45) return { text: "DEGRADED", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", glow: "bg-amber-500" };
    return { text: "CRITICAL FAULT", color: "text-rose-400 bg-rose-500/10 border-rose-500/20", glow: "bg-rose-500 animate-pulse" };
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#E2E8F0] font-sans antialiased flex flex-col">
      {/* GLOBAL BANNER */}
      <header className="bg-[#10141D] border-b border-[#212631] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/25">
            <Cpu className="w-5.5 h-5.5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-extrabold tracking-tight text-white uppercase">Okuma CNC Machine</h1>
              <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/40">Predictive Edge</span>
            </div>
            <p className="text-xs text-[#94A3B8]">Industrial Anomaly Radar & Predictive Maintenance Copilot</p>
          </div>
        </div>

        {/* TIME STAMP FEEDBACK */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center space-x-2 bg-[#161922] border border-[#2D3139] px-3 py-1.5 rounded text-[#94A3B8]">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>OPERATING RATE: <span className="font-semibold text-white">4.2 Gbps</span></span>
          </div>
          <div className="flex items-center space-x-2 bg-[#161922] border border-[#2D3139] px-3 py-1.5 rounded text-[#94A3B8]">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>SELECTED TIMESTAMP: <span className="font-semibold text-white">{selectedTimestamp.replace('T', ' ')}</span></span>
          </div>
          <div className="flex items-center space-x-1.5 bg-[#161922] border border-[#2D3139] px-3 py-1.5 rounded">
            <span className={`w-2 h-2 rounded-full ${isLiveMode ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
            <span className={`text-[10px] font-bold uppercase ${isLiveMode ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isLiveMode ? '📡 Live Monitor' : '📅 Replay Archive'}
            </span>
          </div>
        </div>
      </header>

      {/* CORE OPERATOR ROOM */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* CONTROL DECK SWITCHER */}
        <div className="bg-[#10141D] border border-[#212631] rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Sliders className="w-5 h-5 text-blue-400" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider block">Telemetry Source Mode</span>
              <div className="flex bg-[#07090E] p-1 rounded border border-[#212631] mt-1">
                <button
                  onClick={() => setIsLiveMode(true)}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    isLiveMode ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Real-time CNC Stream</span>
                </button>
                <button
                  onClick={() => setIsLiveMode(false)}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    !isLiveMode ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Historical Replay</span>
                </button>
              </div>
            </div>
          </div>

          {/* HISTORICAL MANUAL COORDINATE PICKER */}
          {!isLiveMode && (
            <div className="flex flex-wrap items-end gap-3 bg-[#07090E] p-3 rounded border border-[#212631] self-start md:self-auto">
              <div>
                <label className="block text-[9px] uppercase font-bold font-mono text-slate-400 mb-1">Target Replay Date</label>
                <input 
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="bg-[#10141D] border border-[#2D3139] text-xs font-mono text-white p-1.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-bold font-mono text-slate-400 mb-1">Hour / Minute</label>
                <input 
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="bg-[#10141D] border border-[#2D3139] text-xs font-mono text-white p-1.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleApplyCustomMoment}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition cursor-pointer flex items-center space-x-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Coordinate</span>
              </button>
            </div>
          )}

          {/* INSTANT INCIDENT HOT JUMP PRESETS */}
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider block">Jump to Historical Faults</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {CRITICAL_HISTORICAL_EVENTS.map((event, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setIsLiveMode(false);
                    // Append event to pool if missing
                    if (!historicalData.some(p => p.timestamp === event.timestamp)) {
                      setHistoricalData(prev => [event, ...prev].sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
                    }
                    setSelectedTimestamp(event.timestamp);
                    setUploadedFilesFeedback({
                      type: 'success',
                      text: `Loaded preset: [${event.label}]`
                    });
                  }}
                  className={`px-2.5 py-1.5 rounded border text-[10px] font-bold uppercase transition cursor-pointer flex items-center space-x-1 ${
                    selectedTimestamp === event.timestamp && !isLiveMode
                      ? 'bg-blue-600 border-blue-500 text-white shadow'
                      : 'bg-[#161922] border-[#2D3139] text-[#94A3B8] hover:text-[#E2E8F0]'
                  }`}
                >
                  <span className="text-[11px]">
                    {idx === 0 ? '🟢' : idx === 1 ? '🌀' : idx === 2 ? '🔥' : idx === 3 ? '💎' : '⚡'}
                  </span>
                  <span>{event.label.split(' ')[1]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* FEEDBACK CORNER */}
        {uploadedFilesFeedback && (
          <div className={`p-3 rounded-lg border text-xs leading-normal flex items-start space-x-2.5 transition ${
            uploadedFilesFeedback.type === 'success' 
              ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' 
              : 'bg-rose-950/20 border-rose-900/40 text-rose-400'
          }`}>
            <span className="text-sm shrink-0">{uploadedFilesFeedback.type === 'success' ? '✅' : '❌'}</span>
            <div className="flex-1">
              <span className="font-bold block uppercase text-[9px] tracking-wider mb-0.5">Okuma Diagnostics Response</span>
              <p>{uploadedFilesFeedback.text}</p>
            </div>
            <button 
              onClick={() => setUploadedFilesFeedback(null)}
              className="text-slate-400 hover:text-white text-[11px] font-mono px-1 hover:bg-slate-800 rounded"
            >
              ✕
            </button>
          </div>
        )}

        {/* TWIN CRITICAL EDGE METRIC BOARDS: ALERT SYSTEM & PREDICTION SYSTEM */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* =======================================================
              1. ALERT SYSTEM CENTER
              ======================================================= */}
          <div id="alert-system-card" className="bg-[#10141D] border border-[#212631] rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
            {/* Top pulse indicator */}
            <div>
              <div className="flex items-center justify-between border-b border-[#212631] pb-3 mb-4">
                <div className="flex items-center space-x-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeAlerts.length > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${activeAlerts.length > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                  </span>
                  <div>
                    <h3 className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                      ⚠️ CNC ACTIVE ALERT SYSTEM
                    </h3>
                    <p className="text-[10px] text-slate-500">Autonomous sensor out-of-bounds radar scan</p>
                  </div>
                </div>
                
                {/* Alarm controller buttons */}
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase transition flex items-center gap-1 ${
                    isAlarmMuted 
                      ? 'bg-slate-900 border border-slate-800 text-slate-400' 
                      : activeAlerts.length > 0 
                      ? 'bg-rose-950/40 border border-rose-800/50 text-rose-400 animate-pulse'
                      : 'bg-blue-950/40 border border-blue-800/50 text-blue-400'
                  }`}>
                    <span>{isAlarmMuted ? "🔇 Alarm Silent" : activeAlerts.length > 0 ? "🔊 ALARM ACTIVE" : "🔊 Monitoring"}</span>
                  </span>
                  <button 
                    onClick={() => setIsAlarmMuted(!isAlarmMuted)}
                    className="px-2 py-1 bg-[#161922] hover:bg-[#202534] border border-[#2D3139] text-[10px] font-mono font-bold uppercase rounded text-slate-400 hover:text-white transition cursor-pointer"
                    title={isAlarmMuted ? "Unmute sound indicator" : "Mute sound indicator"}
                  >
                    {isAlarmMuted ? "Unmute" : "Mute"}
                  </button>
                </div>
              </div>

              {/* Stress state generator banner */}
              <div className="bg-[#07090E] rounded-lg border border-[#212631] p-3 mb-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Stress Tester Simulation</span>
                  <p className="text-[11px] text-slate-500">Inject high spindle friction stress to test alerts and predictions in real-time.</p>
                </div>
                <button
                  onClick={() => {
                    setIsStressSimulated(!isStressSimulated);
                    if (!isLiveMode) {
                      setIsLiveMode(true);
                    }
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold font-mono uppercase tracking-wider transition duration-200 cursor-pointer ${
                    isStressSimulated 
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50 animate-pulse border border-rose-400' 
                      : 'bg-[#161922] hover:bg-[#202534] border border-[#2D3139] text-[#94A3B8]'
                  }`}
                >
                  {isStressSimulated ? '🛑 STOP STRESS' : '⚡ INJECT STRESS'}
                </button>
              </div>

              {/* List of active warnings */}
              {activeAlerts.length === 0 ? (
                <div className="bg-emerald-950/10 border border-emerald-900/30 rounded-lg p-5 text-center flex flex-col items-center justify-center space-y-2 py-8">
                  <div className="w-10 h-10 rounded-full bg-emerald-950/60 border border-emerald-900/40 flex items-center justify-center text-emerald-400 text-lg">
                    🛡️
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">ALL CNC CHANNELS NORMAL</span>
                    <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                      Sensors are operating within safe baseline tolerances. Vibration & thermal limits show high safety margins.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[175px] overflow-y-auto pr-1">
                  {activeAlerts.map((alert, idx) => (
                    <div 
                      key={alert.id} 
                      className={`p-3 rounded-lg border text-xs leading-normal flex items-start space-x-2.5 transition ${alert.color}`}
                    >
                      <span className="text-lg shrink-0">{alert.icon}</span>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-white text-[11px] uppercase tracking-wide">
                            [{alert.severity}] {alert.title}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500 bg-black/30 px-1 py-0.2 rounded font-bold">
                            ACT-0{idx+1}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px] leading-normal">{alert.message}</p>
                        <div className="bg-[#07090E]/60 border border-white/5 p-1.5 rounded mt-1">
                          <span className="text-[9px] font-mono font-bold text-[#94A3B8] block uppercase">URGENT REMEDIATION ACTION:</span>
                          <span className="text-white text-[11px] font-medium">{alert.action}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick telemetry limit status ticker */}
            <div className="mt-4 pt-3.5 border-t border-[#212631] grid grid-cols-3 gap-2 text-center text-[10px] font-mono text-slate-400">
              <div className="bg-[#07090E] p-1.5 rounded border border-[#212631]/40">
                <span className="block text-slate-500">VIB LIMIT</span>
                <span className="font-bold text-white mt-0.5 block">{vibrationAlertLimit} mm/s</span>
              </div>
              <div className="bg-[#07090E] p-1.5 rounded border border-[#212631]/40">
                <span className="block text-slate-500">TEMP LIMIT</span>
                <span className="font-bold text-white mt-0.5 block">{temperatureAlertLimit}°C</span>
              </div>
              <div className="bg-[#07090E] p-1.5 rounded border border-[#212631]/40">
                <span className="block text-slate-500">TOOL LIMIT</span>
                <span className="font-bold text-white mt-0.5 block">300 µm</span>
              </div>
            </div>
          </div>


          {/* =======================================================
              2. PREDICTION SYSTEM CENTER
              ======================================================= */}
          <div id="prediction-system-card" className="bg-[#10141D] border border-[#212631] rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
            {/* Glow backing */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-2xl pointer-events-none" />
            
            <div>
              <div className="flex items-center justify-between border-b border-[#212631] pb-3 mb-4">
                <div className="flex items-center space-x-2.5">
                  <span className="text-blue-400 text-sm">🔮</span>
                  <div>
                    <h3 className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                      🔮 NEURAL PREDICTIVE COPILOT
                    </h3>
                    <p className="text-[10px] text-slate-500">Remaining Useful Life (RUL) & wear trajectory projection</p>
                  </div>
                </div>
                
                <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/40 font-mono">
                  Okuma-LSTM-v4
                </span>
              </div>

              {/* Primary dates projection grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* PREDICTED FAILURE DATE CARD */}
                <div className={`p-3.5 rounded-lg border text-left space-y-2 transition duration-300 ${
                  activeRUL.hours <= 15
                    ? 'bg-rose-950/15 border-rose-500/55 text-rose-300'
                    : activeRUL.hours <= 45
                    ? 'bg-amber-950/15 border-amber-500/40 text-amber-300'
                    : 'bg-[#07090E] border-[#212631] text-slate-300'
                }`}>
                  <div className="flex items-center justify-between text-[10px] font-mono font-extrabold">
                    <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      💀 PREDICTED FAILURE DATE
                    </span>
                    {activeRUL.hours <= 15 && <span className="animate-ping w-2 h-2 rounded-full bg-rose-500" />}
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-xs font-black text-white block tracking-tight leading-snug">
                      {failurePrediction.date}
                    </span>
                    <span className={`text-[11px] block font-bold font-mono ${
                      activeRUL.hours <= 15 ? 'text-rose-400' : activeRUL.hours <= 45 ? 'text-amber-400' : 'text-blue-400'
                    }`}>
                      {failurePrediction.daysStr} ({activeRUL.hours} Operating Hours Left)
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-normal border-t border-[#212631]/60 pt-1.5">
                    Projected moment spindle load torque reaches ultimate shear fatigue (0 operating hours remaining).
                  </p>
                </div>

                {/* PREDICTED REQUIRED MAINTENANCE WINDOW CARD */}
                <div className={`p-3.5 rounded-lg border text-left space-y-2 transition duration-300 ${
                  activeRUL.hours <= 120
                    ? 'bg-rose-950/15 border-rose-500/50 text-rose-300'
                    : 'bg-[#07090E] border-[#212631] text-slate-300'
                }`}>
                  <div className="flex items-center justify-between text-[10px] font-mono font-extrabold">
                    <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      🔧 REQUIRED MAINTENANCE BY
                    </span>
                    {activeRUL.hours <= 120 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-black text-white block tracking-tight leading-snug">
                      {activeRUL.hours <= 120 ? activeTelemetry.timestamp.replace('T', ' ') : maintenancePrediction.date}
                    </span>
                    <span className={`text-[11px] block font-bold font-mono ${
                      activeRUL.hours <= 120 ? 'text-rose-400 font-extrabold animate-pulse' : 'text-emerald-400'
                    }`}>
                      {activeRUL.hours <= 120 ? "⚠️ OVERDUE (Maintenance window active now)" : maintenancePrediction.daysStr}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-normal border-t border-[#212631]/60 pt-1.5">
                    Estimated coordinate where tool carriage accuracy degrades below ISO 230 guidelines (RUL drops past 120 hours).
                  </p>
                </div>

              </div>

              {/* Maintenance checklist track */}
              <div className="mt-4 bg-[#07090E] border border-[#212631]/50 rounded-lg p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono mb-2">
                  Predictive Action Guide (Next Steps)
                </span>
                
                <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold text-[9px] ${
                      activeRUL.hours <= 120 ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-600/20 text-blue-400'
                    }`}>1</span>
                    <span>Reduce Feed Spindle Overrides</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold text-[9px] ${
                      activeRUL.hours <= 80 ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'
                    }`}>2</span>
                    <span>Dispatch Carbide Tip T-12</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold text-[9px] ${
                      activeRUL.hours <= 40 ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'
                    }`}>3</span>
                    <span>Linear Guide Flush & Lube</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Neural confidence readout */}
            <div className="mt-3.5 pt-3 border-t border-[#212631] flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>PROJECTION RATIONALIZATION CONFIDENCE:</span>
              <span className="font-extrabold text-blue-400">98.4% (RUL Gaussian-Kernel)</span>
            </div>
          </div>

        </div>

        {/* MAIN PANEL GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT OVERVIEW: MAIN HEALTH GAUGE, RISK & RUL SNAPSHOT */}
          <div className="lg:col-span-5 space-y-6 flex flex-col">
            
            {/* COMPACT MAIN CONDITION STATUS CARD */}
            <div id="machine-condition-moment-card" className={`bg-[#10141D] rounded-xl p-6 relative overflow-hidden flex flex-col justify-between flex-1 transition-all duration-300 border ${
              isFlashActive 
                ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.25)] scale-[1.015] ring-1 ring-blue-500/30' 
                : 'border-[#212631] shadow-none ring-0'
            }`}>
              {/* Abstract decorative ambient backing */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-[#212631] pb-4 mb-4">
                <div className="flex items-center space-x-2">
                  <Wrench className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ACTIVE MOMENT DIAGNOSTICS</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">CNC-NODE-EDGE-01</span>
              </div>

              {/* SEMI-RADIAL HEALTH INDEX GAUGE */}
              <div className="flex flex-col items-center justify-center my-4">
                <div className={`relative w-56 h-36 flex items-center justify-center transition-all duration-300 ${isFlashActive ? 'scale-105' : ''}`}>
                  <svg viewBox="0 0 220 120" className="w-full h-full">
                    <defs>
                      <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#EF4444" /> {/* Fault / Critical Red */}
                        <stop offset="45%" stopColor="#F59E0B" /> {/* Degraded Amber */}
                        <stop offset="100%" stopColor="#10B981" /> {/* Optimal Emerald */}
                      </linearGradient>
                    </defs>
                    
                    {/* Gauge background trail */}
                    <path 
                      d="M 35,95 A 75,75 0 0,1 185,95" 
                      fill="none" 
                      stroke="#181E29" 
                      strokeWidth="14" 
                      strokeLinecap="round" 
                    />
                    
                    {/* Gauge dynamic value curve */}
                    <path 
                      d="M 35,95 A 75,75 0 0,1 185,95" 
                      fill="none" 
                      stroke="url(#gaugeGrad)" 
                      strokeWidth="14" 
                      strokeLinecap="round" 
                      strokeDasharray="235" 
                      strokeDashoffset={235 - (activeTelemetry.healthIndex / 100) * 235} 
                      className="transition-all duration-1000 ease-out"
                    />

                    {/* Rotating Indicator Needle */}
                    <line 
                      x1="110" 
                      y1="95" 
                      x2="110" 
                      y2="30" 
                      stroke="#FFFFFF" 
                      strokeWidth="4" 
                      strokeLinecap="round" 
                      transform={`rotate(${(activeTelemetry.healthIndex / 100) * 180 - 90}, 110, 95)`}
                      className="origin-[110px_95px] transition-transform duration-1000 ease-out"
                    />
                    
                    <circle cx="110" cy="95" r="9" fill="#0A0C10" stroke="#FFFFFF" strokeWidth="3" />
                  </svg>

                  {/* Large absolute-centered numeric readout */}
                  <div className="absolute bottom-1.5 text-center">
                    <span className={`text-4xl font-extrabold tracking-tight leading-none transition-all duration-300 block ${
                      isFlashActive ? 'text-blue-400 scale-110 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'text-white'
                    }`}>
                      {activeTelemetry.healthIndex}%
                    </span>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">HEALTH RATING</span>
                  </div>
                </div>

                {/* Subcategory assessment tag */}
                <div className="mt-3">
                  <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold tracking-wider border uppercase ${getHealthMeta(activeTelemetry.healthIndex).color}`}>
                    <span className={`w-2 h-2 rounded-full ${getHealthMeta(activeTelemetry.healthIndex).glow} mr-2`} />
                    CNC MACHINE CONDITION: {getHealthMeta(activeTelemetry.healthIndex).text}
                  </span>
                </div>
              </div>

              {/* ESTIMATED REMAINING USEFUL LIFE (RUL) PANEL */}
              <div className="bg-[#07090E] border border-[#212631] rounded-xl p-4.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-[#E2E8F0] font-semibold text-xs">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span>FORECASTED RUL VALUE</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">RUL EST-M1</span>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className={`text-2xl font-black font-mono tracking-tight ${activeRUL.color}`}>
                    {activeRUL.hours} Hours
                  </span>
                  <span className="text-xs text-[#94A3B8]">
                    Est. {Math.round(activeRUL.hours / 24 * 10) / 10} Operating Days
                  </span>
                </div>

                {/* Simulated health status timeline progress */}
                <div className="space-y-1">
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        activeRUL.hours < 25 ? 'bg-rose-500' : activeRUL.hours < 70 ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${activeRUL.ratio * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono font-bold">
                    <span>REPLACEMENT LEVEL</span>
                    <span>NOMINAL LIFETIME (150H)</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-normal italic">
                  *RUL estimate represents neural model projection calculated from spindle vibration shear metrics and flank tooling friction coefficients.
                </p>
              </div>

            </div>

            {/* QUICK ALARM SENSITIVITY CALIBRATION */}
            <div className="bg-[#10141D] border border-[#212631] rounded-xl p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4.5 h-4.5 text-blue-400" />
                <h3 className="font-bold text-white text-xs uppercase tracking-wider">Calibration Alarm Thresholds</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tune the anomaly alert limit boundaries. Telemetry scores breaching these coordinates trigger instant priority alerts and deplete machine health metrics.
              </p>

              <div className="space-y-3.5">
                {/* Vibration Limit slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">Vibration Critical Alarm (mm/s)</span>
                    <span className="text-blue-400 font-mono font-bold">{vibrationAlertLimit} mm/s</span>
                  </div>
                  <input 
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    value={vibrationAlertLimit}
                    onChange={(e) => setVibrationAlertLimit(parseFloat(e.target.value))}
                    className="w-full accent-blue-500 h-1 bg-[#0A0C10] rounded border border-slate-800 cursor-pointer"
                  />
                </div>

                {/* Temp Limit Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">Thermal Fault Temperature (°C)</span>
                    <span className="text-blue-400 font-mono font-bold">{temperatureAlertLimit}°C</span>
                  </div>
                  <input 
                    type="range"
                    min="45.0"
                    max="90.0"
                    step="0.5"
                    value={temperatureAlertLimit}
                    onChange={(e) => setTemperatureAlertLimit(parseFloat(e.target.value))}
                    className="w-full accent-blue-500 h-1 bg-[#0A0C10] rounded border border-slate-800 cursor-pointer"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: INTERACTIVE TREND MAP & TELEMETRY INSIGHTS */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* HEALTH INDEX TREND OVERTIME GRID (around date) */}
            <div className="bg-[#10141D] border border-[#212631] rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <div>
                    <h3 className="font-bold text-white text-xs uppercase tracking-wider">Health Index Trend Analyzer</h3>
                    <p className="text-[11px] text-slate-500">Showing historical timeline trajectory with highlighted active window</p>
                  </div>
                </div>

                {/* Presets and data toggles */}
                <span className="text-[10px] font-mono text-slate-400 bg-[#07090E] border border-[#212631] px-2.5 py-1 rounded">
                  {isLiveMode ? 'Streaming past 15 increments' : '24-Hour Historical Interval'}
                </span>
              </div>

              {/* HIGH FIDELITY SVG TREND LINE GRAPH COMPONENT */}
              <div className="relative bg-[#07090E] border border-[#212631] rounded-lg p-3 h-56 flex flex-col justify-between overflow-hidden">
                <div className="absolute top-2 left-2 flex items-center space-x-1 text-[9px] font-mono text-slate-500 bg-[#10141D]/80 border border-[#2D3139]/30 px-1.5 py-0.5 rounded">
                  <span>Y-AXIS: Health %</span>
                </div>

                {/* GRAPH SVG CANVAS */}
                <div className="w-full flex-1">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 130" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Background Grid Horizontal Lines */}
                    {[20, 50, 80, 110].map((yVal, i) => (
                      <line 
                        key={i} 
                        x1="0" 
                        y1={yVal} 
                        x2="500" 
                        y2={yVal} 
                        stroke="#212631" 
                        strokeWidth="0.75" 
                        strokeDasharray="4 4" 
                      />
                    ))}

                    {/* SVG Curve Plot */}
                    {(() => {
                      const pointsPool = isLiveMode ? liveStreamData : historicalData;
                      if (pointsPool.length === 0) return null;
                      
                      const widthInterval = 500 / (pointsPool.length - 1 || 1);
                      const getSvgY = (val: number) => 130 - (val / 100) * 110 - 5; // bounds clamping
                      
                      // Map points to SVG coordinates
                      const coords = pointsPool.map((p, i) => {
                        return { x: i * widthInterval, y: getSvgY(p.healthIndex), data: p };
                      });

                      const pathD = coords.reduce((acc, curr, i) => {
                        return i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
                      }, "");

                      // Area polygon path for glowing filled gradient under line
                      const areaD = `${pathD} L ${coords[coords.length - 1].x} 130 L 0 130 Z`;

                      // Find index of currently highlighted timestamp
                      const highlightIdx = pointsPool.findIndex(p => p.timestamp === selectedTimestamp);
                      const activeCoord = highlightIdx !== -1 ? coords[highlightIdx] : coords[coords.length - 1];

                      return (
                        <>
                          {/* Shaded Area */}
                          <path d={areaD} fill="url(#chartGradient)" />

                          {/* Line Curve */}
                          <path 
                            d={pathD} 
                            fill="none" 
                            stroke="#3B82F6" 
                            strokeWidth="2.5" 
                            strokeLinecap="round" 
                            className="transition-all duration-300"
                          />

                          {/* Vertical Highlight Bar for selectedTimestamp */}
                          {activeCoord && (
                            <line 
                              x1={activeCoord.x} 
                              y1="5" 
                              x2={activeCoord.x} 
                              y2="130" 
                              stroke="#60A5FA" 
                              strokeWidth="1.5" 
                              strokeDasharray="3 2"
                            />
                          )}

                          {/* Hot interactive circles for each coordinate */}
                          {coords.map((c, i) => {
                            const isSelected = c.data.timestamp === selectedTimestamp;
                            return (
                              <g key={i} className="group/dot cursor-pointer">
                                <circle 
                                  cx={c.x} 
                                  cy={c.y} 
                                  r={isSelected ? "5.5" : "3.5"} 
                                  fill={isSelected ? "#EF4444" : "#3B82F6"}
                                  stroke={isSelected ? "#FFFFFF" : "#0A0C10"}
                                  strokeWidth="1.5"
                                  onClick={() => setSelectedTimestamp(c.data.timestamp)}
                                  onMouseEnter={() => setActiveTrendPoint(c.data)}
                                  onMouseLeave={() => setActiveTrendPoint(null)}
                                  className="transition-all duration-200 hover:scale-150"
                                />
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                </div>

                {/* Trend Chart Hover Popover / Tooltip */}
                {activeTrendPoint && (
                  <div className="absolute top-1.5 right-1.5 bg-[#10141D] border border-blue-500 rounded p-2 text-[11px] space-y-1 z-30 shadow-xl max-w-xs transition">
                    <div className="flex items-center justify-between gap-4 font-mono font-bold text-white">
                      <span>Time: {activeTrendPoint.timestamp.replace('T', ' ')}</span>
                      <span className="text-blue-400">Health: {activeTrendPoint.healthIndex}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 text-slate-400 font-mono text-[10px]">
                      <span>Vibration: {activeTrendPoint.vibration}mm/s</span>
                      <span>Temp: {activeTrendPoint.temperature}°C</span>
                    </div>
                  </div>
                )}

                {/* X-AXIS Chronology labels */}
                <div className="flex justify-between text-[9px] text-slate-500 font-mono pt-1.5 border-t border-[#212631]">
                  {(() => {
                    const pointsPool = isLiveMode ? liveStreamData : historicalData;
                    if (pointsPool.length < 2) return <span>-</span>;
                    return (
                      <>
                        <span>{pointsPool[0].timestamp.substring(11, 16)} hrs</span>
                        <span>{pointsPool[Math.floor(pointsPool.length / 2)].timestamp.substring(11, 16)} hrs (midpoint)</span>
                        <span>{pointsPool[pointsPool.length - 1].timestamp.substring(11, 16)} hrs (current)</span>
                      </>
                    );
                  })()}
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic text-right">
                *Click any circle node coordinate along the line to inspect and lock telemetry conditions for that moment.
              </p>
            </div>

            {/* DEVIATION SNAPSHOT METRIC BLOCKS */}
            <div className="bg-[#10141D] border border-[#212631] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">Sub-Parameter Deviation Ledger</h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Total metrics: 6 vectors</span>
              </div>

              {/* Comprehensive parameters layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Vibration */}
                <div className={`p-3.5 rounded-lg border text-left space-y-1 transition-all duration-300 ${
                  activeTelemetry.vibration >= vibrationAlertLimit 
                    ? isFlashActive ? 'bg-rose-950/20 border-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.25)] scale-[1.015]' : 'bg-rose-950/10 border-rose-900/40' 
                    : isFlashActive ? 'bg-blue-950/15 border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.15)] scale-[1.015]' : 'bg-[#07090E] border-[#212631]'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                      <span>🌀</span> Spindle Vibration
                    </span>
                    {activeTelemetry.vibration >= vibrationAlertLimit && (
                      <span className="text-[9px] font-bold text-rose-400 uppercase bg-rose-500/10 border border-rose-500/20 px-1 rounded">HIGH ALARM</span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className={`text-lg font-black font-mono transition-colors duration-300 ${isFlashActive ? 'text-blue-400' : 'text-white'}`}>{activeTelemetry.vibration} <span className="text-xs font-normal text-slate-500">mm/s</span></span>
                    <span className="text-[10px] text-slate-500 font-mono">Limit: {vibrationAlertLimit}</span>
                  </div>
                </div>

                {/* 2. Thermal Load */}
                <div className={`p-3.5 rounded-lg border text-left space-y-1 transition-all duration-300 ${
                  activeTelemetry.temperature >= temperatureAlertLimit 
                    ? isFlashActive ? 'bg-rose-950/20 border-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.25)] scale-[1.015]' : 'bg-rose-950/10 border-rose-900/40' 
                    : isFlashActive ? 'bg-blue-950/15 border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.15)] scale-[1.015]' : 'bg-[#07090E] border-[#212631]'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                      <span>🌡️</span> Bearing Temperature
                    </span>
                    {activeTelemetry.temperature >= temperatureAlertLimit && (
                      <span className="text-[9px] font-bold text-rose-400 uppercase bg-rose-500/10 border border-rose-500/20 px-1 rounded">THERMAL SPIKE</span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className={`text-lg font-black font-mono transition-colors duration-300 ${isFlashActive ? 'text-blue-400' : 'text-white'}`}>{activeTelemetry.temperature} <span className="text-xs font-normal text-slate-500">°C</span></span>
                    <span className="text-[10px] text-slate-500 font-mono">Limit: {temperatureAlertLimit}</span>
                  </div>
                </div>

                {/* 3. Tool Flank Wear */}
                <div className={`p-3.5 rounded-lg border text-left space-y-1 transition-all duration-300 ${
                  activeTelemetry.toolWear >= 300 
                    ? isFlashActive ? 'bg-amber-950/20 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.25)] scale-[1.015]' : 'bg-amber-950/10 border-amber-900/40' 
                    : isFlashActive ? 'bg-blue-950/15 border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.15)] scale-[1.015]' : 'bg-[#07090E] border-[#212631]'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                      <span>💎</span> Tool Cutter wear
                    </span>
                    {activeTelemetry.toolWear >= 300 && (
                      <span className="text-[9px] font-bold text-amber-400 uppercase bg-amber-500/10 border border-amber-500/20 px-1 rounded">REPLACE TIP</span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className={`text-lg font-black font-mono transition-colors duration-300 ${isFlashActive ? 'text-blue-400' : 'text-white'}`}>{activeTelemetry.toolWear} <span className="text-xs font-normal text-slate-500">µm</span></span>
                    <span className="text-[10px] text-slate-500 font-mono">Max Lifespan: 500</span>
                  </div>
                </div>

                {/* 4. Coolant PSI */}
                <div className={`p-3.5 rounded-lg border text-left space-y-1 transition-all duration-300 ${
                  activeTelemetry.coolantPressure < 25 
                    ? isFlashActive ? 'bg-rose-950/20 border-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.25)] scale-[1.015]' : 'bg-rose-950/10 border-rose-900/40' 
                    : isFlashActive ? 'bg-blue-950/15 border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.15)] scale-[1.015]' : 'bg-[#07090E] border-[#212631]'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                      <span>💧</span> Coolant Pump Pressure
                    </span>
                    {activeTelemetry.coolantPressure < 25 && (
                      <span className="text-[9px] font-bold text-rose-400 uppercase bg-rose-500/10 border border-rose-500/20 px-1 rounded">PRESSURE FLOW FAULT</span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className={`text-lg font-black font-mono transition-colors duration-300 ${isFlashActive ? 'text-blue-400' : 'text-white'}`}>{activeTelemetry.coolantPressure} <span className="text-xs font-normal text-slate-500">PSI</span></span>
                    <span className="text-[10px] text-slate-500 font-mono">Baseline: 45.0</span>
                  </div>
                </div>

                {/* 5. Sound envelope */}
                <div className={`p-3.5 rounded-lg border text-left space-y-1 transition-all duration-300 ${
                  isFlashActive ? 'bg-blue-950/15 border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.15)] scale-[1.015]' : 'bg-[#07090E] border-[#212631]'
                }`}>
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                    <span>🔊</span> Acoustic Emission
                  </span>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className={`text-lg font-black font-mono transition-colors duration-300 ${isFlashActive ? 'text-blue-400' : 'text-white'}`}>{activeTelemetry.acousticNoise} <span className="text-xs font-normal text-slate-500">dB</span></span>
                    <span className="text-[10px] text-slate-500 font-mono">Nominal: &lt; 78.0</span>
                  </div>
                </div>

                {/* 6. Drive Current */}
                <div className={`p-3.5 rounded-lg border text-left space-y-1 transition-all duration-300 ${
                  isFlashActive ? 'bg-blue-950/15 border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.15)] scale-[1.015]' : 'bg-[#07090E] border-[#212631]'
                }`}>
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                    <span>⚡</span> Spindle Drive Load
                  </span>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className={`text-lg font-black font-mono transition-colors duration-300 ${isFlashActive ? 'text-blue-400' : 'text-white'}`}>{activeTelemetry.motorCurrent} <span className="text-xs font-normal text-slate-500">A</span></span>
                    <span className="text-[10px] text-slate-500 font-mono">Max Limit: 35.0</span>
                  </div>
                </div>

              </div>

              {/* PRIMARY FAULT SPOTLIGHT ANALYSIS */}
              <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start space-x-3 min-w-0">
                  <div className="w-10 h-10 rounded bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 text-lg mt-0.5">
                    🔎
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[9px] uppercase font-bold text-blue-400 block font-mono">Primary Stress Contributor Detected</span>
                    <h4 className="font-extrabold text-white text-xs uppercase tracking-wide truncate">
                      {primaryAnomalyMetric.icon} {primaryAnomalyMetric.name} is deviating by {(primaryAnomalyMetric.ratio * 100).toFixed(0)}%
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Analytical telemetry confirms {primaryAnomalyMetric.name} has the largest relative delta gap offset against nominal operating parameters.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-left md:text-right border-t md:border-t-0 md:border-l border-blue-500/20 pt-2.5 md:pt-0 md:pl-4">
                  <span className="text-[9px] font-mono text-slate-400 block uppercase">STRESS COEFFICIENT</span>
                  <span className="text-base font-black font-mono text-blue-300">{(primaryAnomalyMetric.ratio).toFixed(2)}x Max Norm</span>
                </div>
              </div>
            </div>

            {/* RECOMMENDED MAINTENANCE ACTIONS CARD */}
            <div className="bg-[#10141D] border border-[#212631] rounded-xl p-5 space-y-4">
              <div className="flex items-center space-x-2.5">
                <Wrench className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">Edge Advisory & Recommendations</h3>
                  <p className="text-[10px] text-slate-500">Automated maintenance copilot instructions</p>
                </div>
              </div>

              <div className={`p-4 rounded-lg border text-xs leading-relaxed space-y-2.5 ${recommendation.color}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[10px]">
                    ⚠️ ADVISORY TARGET URGENCY: {recommendation.urgency}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {recommendation.code}
                  </span>
                </div>
                <p className="text-[#E2E8F0] font-medium leading-relaxed">
                  {recommendation.action}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* COMPREHENSIVE SIDE-BY-SIDE DATES COMPARATOR MODULE */}
        <div className="bg-[#10141D] border border-[#212631] rounded-xl overflow-hidden">
          
          {/* HEADER HEADER */}
          <div 
            onClick={() => setShowComparator(!showComparator)}
            className="p-5 flex items-center justify-between hover:bg-[#151a25] transition cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <ArrowLeftRight className="w-5.5 h-5.5 text-blue-400" />
              <div>
                <h3 className="font-bold text-white text-sm uppercase tracking-wide">Dynamic Side-By-Side Moment Comparator</h3>
                <p className="text-xs text-slate-500">Compare health status indices, stress quotients, and RUL scores across distinct historical frames</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/40">
                {showComparator ? 'Hide Module' : 'Expand Module'}
              </span>
              <span className="text-lg">{showComparator ? '▲' : '▼'}</span>
            </div>
          </div>

          {showComparator && (
            <div className="p-5 border-t border-[#212631] bg-[#07090E] space-y-6">
              
              {/* CHRONOLOGY COORDINATE SELECTION GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#10141D] p-4 rounded-lg border border-[#212631]">
                
                {/* REFERENCE TIMEFRAME A */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-blue-400 uppercase tracking-wide">REFERENCE TIMEFRAME A (BASELINE)</label>
                  <select 
                    value={compareDateA}
                    onChange={(e) => setCompareDateA(e.target.value)}
                    className="w-full bg-[#07090E] border border-[#2D3139] rounded text-xs p-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {/* Add default high incidents */}
                    <option value="2026-07-19T10:26:00">2026-07-19 10:26 - Nominal Baseline</option>
                    <option value="2026-07-18T14:30:00">2026-07-18 14:30 - Spindle Unbalance</option>
                    <option value="2026-07-17T03:15:00">2026-07-17 03:15 - Coolant Starvation</option>
                    <option value="2026-07-15T22:00:00">2026-07-15 22:00 - Cutter Blade Wear Out</option>
                    <option value="2026-07-14T08:45:00">2026-07-14 08:45 - Motor Over-current</option>
                    {historicalData.map(p => (
                      <option key={p.timestamp} value={p.timestamp}>{p.timestamp.replace('T', ' ')} - Archived Snapshot</option>
                    ))}
                  </select>
                </div>

                {/* TARGET TIMEFRAME B */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-blue-400 uppercase tracking-wide">TARGET TIMEFRAME B (DEGRADATION COMPARATOR)</label>
                  <select 
                    value={compareDateB}
                    onChange={(e) => setCompareDateB(e.target.value)}
                    className="w-full bg-[#07090E] border border-[#2D3139] rounded text-xs p-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="2026-07-18T14:30:00">2026-07-18 14:30 - Spindle Unbalance</option>
                    <option value="2026-07-19T10:26:00">2026-07-19 10:26 - Nominal Baseline</option>
                    <option value="2026-07-17T03:15:00">2026-07-17 03:15 - Coolant Starvation</option>
                    <option value="2026-07-15T22:00:00">2026-07-15 22:00 - Cutter Blade Wear Out</option>
                    <option value="2026-07-14T08:45:00">2026-07-14 08:45 - Motor Over-current</option>
                    {historicalData.map(p => (
                      <option key={p.timestamp} value={p.timestamp}>{p.timestamp.replace('T', ' ')} - Archived Snapshot</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* SIDE BY SIDE METRIC BREAKDOWN TABLE */}
              <div className="overflow-x-auto border border-[#212631] rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  
                  {/* HEADER */}
                  <thead>
                    <tr className="bg-[#10141D] text-slate-400 font-mono text-[10px] uppercase tracking-wider border-b border-[#212631]">
                      <th className="p-4">Telemetry Parameter</th>
                      <th className="p-4 border-l border-[#212631] text-blue-400">Timeframe A (Reference)</th>
                      <th className="p-4 border-l border-[#212631] text-amber-400">Timeframe B (Target)</th>
                      <th className="p-4 border-l border-[#212631]">Performance Shift Delta</th>
                    </tr>
                  </thead>

                  {/* TABLE BODY */}
                  <tbody className="divide-y divide-[#212631] font-mono">
                    
                    {/* Timestamp */}
                    <tr className="bg-[#0A0C10]/40">
                      <td className="p-4 font-bold text-white">Coordinate Timestamp</td>
                      <td className="p-4 border-l border-[#212631] text-slate-300 font-bold">{compPointA.timestamp.replace('T', ' ')}</td>
                      <td className="p-4 border-l border-[#212631] text-slate-300 font-bold">{compPointB.timestamp.replace('T', ' ')}</td>
                      <td className="p-4 border-l border-[#212631] text-slate-500 italic">Timeline Anchor Coordinates</td>
                    </tr>

                    {/* Health Index */}
                    <tr className="hover:bg-slate-900/10">
                      <td className="p-4 font-bold text-white">Aggregated Health Rating</td>
                      <td className="p-4 border-l border-[#212631]">
                        <span className={`px-2 py-0.5 rounded font-bold ${getHealthMeta(compPointA.healthIndex).color}`}>
                          {compPointA.healthIndex}%
                        </span>
                      </td>
                      <td className="p-4 border-l border-[#212631]">
                        <span className={`px-2 py-0.5 rounded font-bold ${getHealthMeta(compPointB.healthIndex).color}`}>
                          {compPointB.healthIndex}%
                        </span>
                      </td>
                      <td className="p-4 border-l border-[#212631]">
                        {(() => {
                          const diff = compPointB.healthIndex - compPointA.healthIndex;
                          if (diff === 0) return <span className="text-slate-500">No shift</span>;
                          return diff > 0 
                            ? <span className="text-emerald-400 font-bold">+{diff}% (Improved)</span> 
                            : <span className="text-rose-400 font-bold">{diff}% (Degraded)</span>;
                        })()}
                      </td>
                    </tr>

                    {/* Vibration */}
                    <tr className="hover:bg-slate-900/10">
                      <td className="p-4 font-medium text-slate-300">Spindle Vibration</td>
                      <td className="p-4 border-l border-[#212631] font-bold text-white">{compPointA.vibration} mm/s</td>
                      <td className="p-4 border-l border-[#212631] font-bold text-white">{compPointB.vibration} mm/s</td>
                      <td className="p-4 border-l border-[#212631]">
                        {(() => {
                          const diff = parseFloat((compPointB.vibration - compPointA.vibration).toFixed(2));
                          return diff > 0 
                            ? <span className="text-rose-400 font-bold">+{diff} mm/s 📈</span> 
                            : <span className="text-emerald-400 font-bold">{diff} mm/s 📉</span>;
                        })()}
                      </td>
                    </tr>

                    {/* Temperature */}
                    <tr className="hover:bg-slate-900/10">
                      <td className="p-4 font-medium text-slate-300">Bearing Temperature</td>
                      <td className="p-4 border-l border-[#212631] font-bold text-white">{compPointA.temperature} °C</td>
                      <td className="p-4 border-l border-[#212631] font-bold text-white">{compPointB.temperature} °C</td>
                      <td className="p-4 border-l border-[#212631]">
                        {(() => {
                          const diff = parseFloat((compPointB.temperature - compPointA.temperature).toFixed(1));
                          return diff > 0 
                            ? <span className="text-rose-400 font-bold">+{diff}°C 📈</span> 
                            : <span className="text-emerald-400 font-bold">{diff}°C 📉</span>;
                        })()}
                      </td>
                    </tr>

                    {/* Tool Wear */}
                    <tr className="hover:bg-slate-900/10">
                      <td className="p-4 font-medium text-slate-300">Tool Cutting Wear</td>
                      <td className="p-4 border-l border-[#212631] font-bold text-white">{compPointA.toolWear} µm</td>
                      <td className="p-4 border-l border-[#212631] font-bold text-white">{compPointB.toolWear} µm</td>
                      <td className="p-4 border-l border-[#212631]">
                        {(() => {
                          const diff = compPointB.toolWear - compPointA.toolWear;
                          return diff > 0 
                            ? <span className="text-rose-400 font-bold">+{diff} µm 📈</span> 
                            : <span className="text-emerald-400 font-bold">{diff} µm 📉</span>;
                        })()}
                      </td>
                    </tr>

                    {/* Coolant Pressure */}
                    <tr className="hover:bg-slate-900/10">
                      <td className="p-4 font-medium text-slate-300">Coolant Pressure</td>
                      <td className="p-4 border-l border-[#212631] font-bold text-white">{compPointA.coolantPressure} PSI</td>
                      <td className="p-4 border-l border-[#212631] font-bold text-white">{compPointB.coolantPressure} PSI</td>
                      <td className="p-4 border-l border-[#212631]">
                        {(() => {
                          const diff = parseFloat((compPointB.coolantPressure - compPointA.coolantPressure).toFixed(1));
                          return diff > 0 
                            ? <span className="text-emerald-400 font-bold">+{diff} PSI</span> 
                            : <span className="text-rose-400 font-bold">{diff} PSI</span>;
                        })()}
                      </td>
                    </tr>

                    {/* Remaining Useful Life */}
                    <tr className="hover:bg-slate-900/10">
                      <td className="p-4 font-bold text-white">Forensic RUL Projections</td>
                      <td className="p-4 border-l border-[#212631] text-blue-300 font-bold">{calculateRUL(compPointA).hours} Hours</td>
                      <td className="p-4 border-l border-[#212631] text-amber-300 font-bold">{calculateRUL(compPointB).hours} Hours</td>
                      <td className="p-4 border-l border-[#212631]">
                        {(() => {
                          const diff = parseFloat((calculateRUL(compPointB).hours - calculateRUL(compPointA).hours).toFixed(1));
                          if (diff === 0) return <span className="text-slate-500">Identical</span>;
                          return diff > 0 
                            ? <span className="text-emerald-400 font-bold">+{diff} Hours Life Gains</span> 
                            : <span className="text-rose-400 font-bold">{diff} Hours Life Loss</span>;
                        })()}
                      </td>
                    </tr>

                    {/* Primary Culprit */}
                    <tr className="hover:bg-slate-900/10">
                      <td className="p-4 font-bold text-white">Dominant Degradation Vector</td>
                      <td className="p-4 border-l border-[#212631] text-slate-400">{getAnomalousRanking(compPointA)[0].icon} {getAnomalousRanking(compPointA)[0].name}</td>
                      <td className="p-4 border-l border-[#212631] text-slate-400">{getAnomalousRanking(compPointB)[0].icon} {getAnomalousRanking(compPointB)[0].name}</td>
                      <td className="p-4 border-l border-[#212631] text-slate-400 italic">Structural Stress Core</td>
                    </tr>

                  </tbody>
                </table>
              </div>

            </div>
          )}
        </div>

        {/* TELEMETRY DECK UTILITIES & FILE DRAWER */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* OFFLINE MANIFEST DISK: UPLOAD FILE SCANNERS */}
          <div className="bg-[#10141D] border border-[#212631] rounded-xl p-5 space-y-4">
            <div className="flex items-center space-x-2">
              <FileUp className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-white text-xs uppercase tracking-wider">Auxiliary Diagnostic Upload Portal</h3>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload custom high-frequency diagnostic datasets in JSON or CSV format from client loggers. The neural model will instantly parse and chart raw sensor readings.
            </p>

            <div className="flex items-center space-x-3 pt-1">
              {/* Styled upload anchor button */}
              <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded cursor-pointer transition flex items-center space-x-1.5">
                <FileUp className="w-4 h-4" />
                <span>Upload Custom .json / .csv</span>
                <input 
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={triggerTemplateDownload}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 text-xs font-bold rounded transition cursor-pointer flex items-center space-x-1"
                title="Get standard telemetry upload sample"
              >
                <FileDown className="w-4 h-4" />
                <span>Download Sample Template</span>
              </button>
            </div>
          </div>

          {/* HELP SYSTEM EXPLAINER */}
          <div className="bg-[#10141D] border border-[#212631] rounded-xl p-5 space-y-3.5">
            <div className="flex items-center space-x-2">
              <HelpCircle className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-white text-xs uppercase tracking-wider">Predictive Diagnostics Legend</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <span className="font-bold text-white block">🌀 Vibration (mm/s)</span>
                <p className="text-slate-500 leading-normal text-[11px]">Normal is below 1.5. Spindle imbalance or bearing chip wear causes high shear vibrations.</p>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-white block">🌡️ Thermal Load (°C)</span>
                <p className="text-slate-500 leading-normal text-[11px]">Optimal operating heat is 35-55°C. Starvation of coolant leads to runaway thermal expansions.</p>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-white block">💎 Tool Cutter (µm)</span>
                <p className="text-slate-500 leading-normal text-[11px]">Tool wear accrues steadily. Reaching 500µm risks structural carbide fracturing.</p>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-white block">💧 Coolant (PSI)</span>
                <p className="text-slate-500 leading-normal text-[11px]">Standard pressurization is 45 PSI. Low pressure means pump leaks or system cavitation.</p>
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* FOOTER METADATA */}
      <footer className="bg-[#07090E] border-t border-[#1C212E] p-4 text-center shrink-0">
        <p className="text-[11px] text-slate-500 font-mono">
          OKUMA CNC MACHINE EDGE MONITORING UNIT // LOCALIZED COGNITIVE MODEL ACTIVE // NO EXTERNAL INGRESS PORTS OPENED
        </p>
      </footer>
    </div>
  );
}
