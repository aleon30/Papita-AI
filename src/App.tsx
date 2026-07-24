/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Home,
  PlusCircle,
  User,
  Send,
  Mic,
  MicOff,
  Check,
  Moon,
  Battery,
  Smile,
  Sparkles,
  Award,
  Activity,
  Trash2,
  Calendar,
  AlertCircle,
  Stethoscope,
  MessageSquare,
  Sparkle,
  History,
  Save,
  HardDrive,
  FileText,
  CloudUpload,
  RefreshCw,
  Loader2,
  Clock
} from "lucide-react";
import { ChatMessage, DailyLog, MoodType, DoctorProfile } from "./types";
import { googleSignIn, initAuth, logoutGoogle, getAccessToken } from "./lib/firebase";
import { listDriveFiles, uploadTextFile, getFileContentText, DriveFile } from "./lib/drive";
import { User as FirebaseUser } from "firebase/auth";

// Import the generated mascot image
import papitaMascotImg from "./assets/images/papita_mascot_1781301818513.png";

// Helper to format Spanish Date
const getSpanishDate = () => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long"
  };
  return new Date().toLocaleDateString("es-ES", options);
};

// Available standard hobbies
const ALL_HOBBIES = ["música", "baile", "caminar", "lectura", "deporte", "cine", "cocina", "meditación"];

// Initial logs for dummy history
const INITIAL_LOGS: DailyLog[] = [
  {
    id: "log-1",
    date: "2026-06-11",
    sleepHours: 5,
    energyPercent: 50,
    mood: "cansado",
    notes: "Turno nocturno muy cansador en urgencia. Llegaron múltiples urgencias pediátricas.",
    timestamp: "2026-06-11T08:00:00Z"
  },
  {
    id: "log-2",
    date: "2026-06-10",
    sleepHours: 7.5,
    energyPercent: 85,
    mood: "feliz",
    notes: "Día libre. Dormí excelente, comí bien y salí a correr un rato.",
    timestamp: "2026-06-10T21:30:00Z"
  },
  {
    id: "log-3",
    date: "2026-06-09",
    sleepHours: 6,
    energyPercent: 65,
    mood: "neutro",
    notes: "Turno regular en consulta externa. Muchos controles.",
    timestamp: "2026-06-09T18:00:00Z"
  }
];

const DR_GREETINGS = [
  "espero que te hayas levantado con buena energía para esta mañana.",
  "espero que te sientas listo y con la mente descansada para atender a tus pequeños pacientes.",
  "deseo que tengas una mañana increíble y con tus energías recargadas en el hospital.",
  "espero que arranques tu guardia con la mejor actitud y un ánimo excepcional hoy.",
  "deseo que este día te reciba con mucha luz, paz y vitalidad clínica para las consultas.",
  "espero que te sientas fresco y motivado para tu labor con tus consultantes hoy."
];

function generateDynamicWelcomeGreeting(doctorName: string): string {
  const choice = DR_GREETINGS[new Date().getDay() % DR_GREETINGS.length];
  return `Buenos días ${doctorName}, ${choice} ¿cómo pudiste descansar hoy?`;
}

const SLEEP_CHOICES = [
  "Menos de 4 horas",
  "4 a 5 horas",
  "5 a 6 horas",
  "6 a 7 horas",
  "7 a 8 horas",
  "8 a 9 horas",
  "Más de 9 horas"
];

function getSleepClassificationDetail(choice: string): { classification: string; emoji: string; status: string } {
  if (choice === "Menos de 4 horas") {
    return { classification: "🔴 <4h sueño (deprivación crítica)", emoji: "🔴", status: "deprivación crítica" };
  } else if (choice === "4 a 5 horas") {
    return { classification: "🟠 4–5h (deprivación alta)", emoji: "🟠", status: "deprivación alta" };
  } else if (choice === "5 a 6 horas") {
    return { classification: "🟡 5–6h (deprivación leve)", emoji: "🟡", status: "deprivación leve" };
  } else if (choice === "6 a 7 horas") {
    return { classification: "🟡 5–6h (deprivación leve)", emoji: "🟡", status: "deprivación leve" };
  } else if (choice === "7 a 8 horas") {
    return { classification: "🟢 7–8h (óptimo)", emoji: "🟢", status: "óptimo" };
  } else if (choice === "8 a 9 horas") {
    return { classification: "🟢 7–8h (óptimo)", emoji: "🟢", status: "óptimo" };
  } else {
    return { classification: "🟢🟢 >9h (posible compensación)", emoji: "🟢🟢", status: "posible compensación" };
  }
}

function formatMessageText(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split("\n");
  
  return (
    <div className="space-y-1 font-sans text-left leading-relaxed text-inherit">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        // Check if the source line starts with a bullet point
        const isBullet = trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ");
        const cleanLine = isBullet ? trimmed.replace(/^[\*\-•]\s+/, "") : line;
        
        // Loop and match **text** in cleanLine to format as bold
        const parts: React.ReactNode[] = [];
        let lastIdx = 0;
        const boldRegex = /\*\*([^*]+)\*\*/g;
        let match;
        
        while ((match = boldRegex.exec(cleanLine)) !== null) {
          const matchStart = match.index;
          const matchText = match[1];
          
          if (matchStart > lastIdx) {
            parts.push(cleanLine.substring(lastIdx, matchStart));
          }
          parts.push(
            <strong key={`b-${matchStart}`} className="font-extrabold text-inherit">
              {matchText}
            </strong>
          );
          lastIdx = boldRegex.lastIndex;
        }
        
        if (lastIdx < cleanLine.length) {
          parts.push(cleanLine.substring(lastIdx));
        }

        const isEmpty = trimmed === "";

        if (isBullet) {
          return (
            <div key={lineIdx} className="flex items-start space-x-1.5 pl-2 text-[11.5px] leading-relaxed text-inherit">
              <span className="text-[#E28E14] select-none text-[9.5px] mt-1 shrink-0">●</span>
              <span className="flex-1 text-inherit">{parts.length > 0 ? parts : cleanLine}</span>
            </div>
          );
        } else {
          return (
            <div key={lineIdx} className={`text-[11.5px] leading-relaxed text-inherit ${isEmpty ? "h-2" : ""}`}>
              {parts.length > 0 ? parts : cleanLine}
            </div>
          );
        }
      })}
    </div>
  );
}

const getMbiQuestionAndCode = (dayNum: number, currentPhase: "inicio" | "mitad" | "final") => {
  let dimension: "AE" | "DP" | "RP" = "AE";
  let dimensionLabel = "Agotamiento Emocional";
  
  if (dayNum === 2 || dayNum === 5) {
    dimension = "DP";
    dimensionLabel = "Despersonalización";
  } else if (dayNum === 3 || dayNum === 6) {
    dimension = "RP";
    dimensionLabel = "Realización Personal";
  }

  let questionText = "";
  let activeMbiCode = "";

  if (dimension === "AE") {
    activeMbiCode = `AE_${currentPhase}`;
    if (currentPhase === "inicio") {
      questionText = "¿Llegaste a tu turno (guardia, posta o piso) ya sintiéndote fatigado?";
    } else if (currentPhase === "final") {
      questionText = "Al concluir tu turno hoy, ¿te has sentido extremadamente cansado?";
    } else {
      questionText = "¿Sientes que el ritmo continuo de atención a pacientes y coordinación con colegas durante tu turno hoy te resultó agotador?";
    }
  } else if (dimension === "DP") {
    activeMbiCode = `DP_${currentPhase}`;
    if (currentPhase === "inicio") {
      questionText = "¿Te preocupa que hoy la fatiga o sobrecarga del turno te dificulte conectar con el dolor o necesidad de tus pacientes?";
    } else if (currentPhase === "final") {
      questionText = "Al terminar tu turno, ¿sientes que te cuesta mostrar empatía o preocupación real por lo que les pasa a tus pacientes?";
    } else {
      questionText = "¿Sientes que estás tratando a tus pacientes de manera despersonalizada, más robótica o fría por la prisa de la consulta?";
    }
  } else {
    activeMbiCode = `RP_${currentPhase}`;
    if (currentPhase === "inicio") {
      questionText = "¿Te sientes con energía y motivación hoy para generar un impacto positivo en tus pacientes?";
    } else if (currentPhase === "final") {
      questionText = "Al finalizar tu guardia hoy, ¿sientes una sensación valiosa de logro y realización con el cuidado que brindaste?";
    } else {
      questionText = "¿Sientes una satisfacción genuina en el consultorio al ver que logras entender de forma cercana lo que tus pacientes sienten?";
    }
  }

  return { questionText, activeMbiCode, dimension, dimensionLabel };
};

export default function App() {
  // ---- STATE ----
  const [activeTab, setActiveTab] = useState<"inicio" | "historial" | "registro" | "perfil">("inicio");
  const [currentMood, setCurrentMood] = useState<MoodType>("cansado");
  const [sleepHours, setSleepHours] = useState<number>(6);
  const [energyPercent, setEnergyPercent] = useState<number>(70);
  const [isRecommendationDone, setIsRecommendationDone] = useState<boolean>(false);
  
  // Custom suggestion state (updated by Gemini/Foundry response dynamically!)
  const [recommendation, setRecommendation] = useState<string>("3 minutos de respiración profunda");

  // Profile info
  const [profile, setProfile] = useState<DoctorProfile>(() => {
    const saved = localStorage.getItem("papita_profile");
    return saved ? JSON.parse(saved) : {
      name: "Dr. Diego",
      specialty: "Urgencias Pediátricas",
      hospital: "Hospital Clínico Central",
      avatarSeed: "di"
    };
  });

  // Additional Profiling States
  const [profileAge, setProfileAge] = useState<string>(() => localStorage.getItem("profile_age") || "");
  const [profileGender, setProfileGender] = useState<string>(() => localStorage.getItem("profile_gender") || "Prefiero no decirlo");
  const [profileWorkArea, setProfileWorkArea] = useState<string>(() => localStorage.getItem("profile_work_area") || "Medicina general");
  const [profileConnectingActivities, setProfileConnectingActivities] = useState<string[]>(() => {
    const saved = localStorage.getItem("profile_connecting_activities");
    return saved ? JSON.parse(saved) : ["meditación", "lectura"];
  });
  const [profileMotivation, setProfileMotivation] = useState<string[]>(() => {
    const saved = localStorage.getItem("profile_motivation");
    return saved ? JSON.parse(saved) : ["Ayudar y generar impacto en otras personas", "Poder ofrecer una mejor atención a mis pacientes"];
  });
  const [profileShiftType, setProfileShiftType] = useState<string>(() => localStorage.getItem("profile_shift_type") || "Fijos");
  const [profileHealthIssue, setProfileHealthIssue] = useState<string>(() => localStorage.getItem("profile_health_issue") || "Ninguno");
  const [profileCustomHealthIssue, setProfileCustomHealthIssue] = useState<string>(() => localStorage.getItem("profile_custom_health_issue") || "");
  const [profileWorkHours, setProfileWorkHours] = useState<string>(() => localStorage.getItem("profile_work_hours") || "8");
  const [profileIdealSleepHours, setProfileIdealSleepHours] = useState<string>(() => localStorage.getItem("profile_ideal_sleep_hours") || "8");

  // Selected Hobbies (Synchronized with profileConnectingActivities per instructions)
  const selectedHobbies = profileConnectingActivities;

  // Active weekly day tracker (starts at Day 1 of 7, i.e., "Lunes")
  const [weeklyDayNumber, setWeeklyDayNumber] = useState<number>(() => {
    const saved = localStorage.getItem("weekly_day_number");
    return saved ? parseInt(saved, 10) : 1;
  });

  // Demo Mode Unlock for Simulador de Guardia
  const [demoUser, setDemoUser] = useState("");
  const [demoPass, setDemoPass] = useState("");
  const [isSimulatorUnlocked, setIsSimulatorUnlocked] = useState(() => {
    return localStorage.getItem("is_simulator_unlocked") === "true";
  });
  const [demoError, setDemoError] = useState("");

  // Sleep history from Azure (sueno_dr_diego.txt)
  const [azureSleepData, setAzureSleepData] = useState<any>(null);
  const [isLoadingAzureSleep, setIsLoadingAzureSleep] = useState(false);
  const [selectedAzureWeek, setSelectedAzureWeek] = useState<string>("Semana 1");
  const [activeAzureChartIndex, setActiveAzureChartIndex] = useState<number | null>(null);
  const [graphMode, setGraphMode] = useState<"mis_registros" | "sueno_azure">("mis_registros");

  // MBI dimension questions summary from Azure (resumen_preguntas_dimension.txt)
  const [azureMbiData, setAzureMbiData] = useState<any>(null);
  const [isLoadingAzureMbi, setIsLoadingAzureMbi] = useState(false);

  // AI-generated MBI recommendations
  const [mbiRecommendations, setMbiRecommendations] = useState<{ AE: string, DP: string, RP: string } | null>(null);
  const [isLoadingMbiRecs, setIsLoadingMbiRecs] = useState(false);

  // Fetch AI-generated MBI recommendations when MBI data or profile changes (Debounced)
  useEffect(() => {
    const fetchMbiRecommendations = async () => {
      setIsLoadingMbiRecs(true);
      try {
        const bodyObj = {
          profile,
          profileAge,
          profileGender,
          profileWorkArea,
          profileConnectingActivities,
          profileMotivation,
          profileShiftType,
          profileHealthIssue,
          profileCustomHealthIssue,
          profileWorkHours,
          profileIdealSleepHours,
          mbiData: azureMbiData
        };

        const response = await fetch("/api/mbi-recommendations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(bodyObj)
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.recommendations) {
            setMbiRecommendations(result.recommendations);
          }
        }
      } catch (err) {
        console.error("Error loading MBI recommendations from AI:", err);
      } finally {
        setIsLoadingMbiRecs(false);
      }
    };

    const timer = setTimeout(() => {
      fetchMbiRecommendations();
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    azureMbiData,
    profile,
    profileAge,
    profileGender,
    profileWorkArea,
    profileConnectingActivities,
    profileMotivation,
    profileShiftType,
    profileHealthIssue,
    profileCustomHealthIssue,
    profileWorkHours,
    profileIdealSleepHours
  ]);

  // Fetch sleep history from Azure
  useEffect(() => {
    const fetchAzureSleep = async () => {
      setIsLoadingAzureSleep(true);
      try {
        const res = await fetch("/api/sleep-diego");
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data) {
            setAzureSleepData(result);
          }
        }
      } catch (err) {
        console.error("Error loading Azure sleep history:", err);
      } finally {
        setIsLoadingAzureSleep(false);
      }
    };
    fetchAzureSleep();
  }, []);

  // Fetch MBI daily questions summary from Azure
  useEffect(() => {
    const fetchAzureMbiData = async () => {
      setIsLoadingAzureMbi(true);
      try {
        const res = await fetch("/api/mbi-summary");
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data) {
            setAzureMbiData(result.data);
          }
        }
      } catch (err) {
        console.error("Error loading Azure MBI summary:", err);
      } finally {
        setIsLoadingAzureMbi(false);
      }
    };
    fetchAzureMbiData();
  }, []);

  // Sync chosen Day Number to Schedule selected day
  useEffect(() => {
    localStorage.setItem("weekly_day_number", weeklyDayNumber.toString());
    const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const targetDay = DAYS[weeklyDayNumber - 1] || "Lunes";
    setScheduleSelectedDay(targetDay);
  }, [weeklyDayNumber]);

  // Sync calendar selections back to weekly day number
  const handleSelectDay = (dayName: string) => {
    setScheduleSelectedDay(dayName);
    const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const index = DAYS.indexOf(dayName);
    if (index !== -1) {
      setWeeklyDayNumber(index + 1);
    }
  };

  // Diego Clinic Schedule States (Azure Search RAG synchronized)
  const [scheduleData, setScheduleData] = useState<Record<string, Array<{ shift: string; start: string; end: string; patientName: string; hcId: string; age: string; gender: string; motive: string }>>>({});
  const [scheduleSelectedDay, setScheduleSelectedDay] = useState<string>("Lunes");
  const [isScheduleLoading, setIsScheduleLoading] = useState<boolean>(true);

  // ---- GOOGLE DRIVE INTEGRATION STATE ----
  const [driveUser, setDriveUser] = useState<FirebaseUser | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [isDriveLoading, setIsDriveLoading] = useState<boolean>(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState<boolean>(false);
  const [driveSearch, setDriveSearch] = useState<string>("");
  const [isDrivePanelOpen, setIsDrivePanelOpen] = useState<boolean>(false);
  const [driveStatusMessage, setDriveStatusMessage] = useState<string | null>(null);
  const [activeImportedContent, setActiveImportedContent] = useState<{name: string, text: string} | null>(null);
  
  // Custom folder configuration defaults to the user's requested project: 1TThfr1Lbnyv86Bip5ukNf2Gzc-rFJoFH
  const [driveFolderId, setDriveFolderId] = useState<string>(() => {
    return localStorage.getItem("connected_drive_folder_id") || "1TThfr1Lbnyv86Bip5ukNf2Gzc-rFJoFH";
  });
  const [driveFolderUrl, setDriveFolderUrl] = useState<string>(() => {
    return localStorage.getItem("connected_drive_folder_url") || "https://drive.google.com/drive/u/1/project/1TThfr1Lbnyv86Bip5ukNf2Gzc-rFJoFH";
  });

  // History & logs (Kept for state tracking background logic)
  const [logs, setLogs] = useState<DailyLog[]>(() => {
    const saved = localStorage.getItem("papita_logs");
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  });

  // General Chat conversation (Wellness Chat)
  const [chatInput, setChatInput] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("papita_chat");
    return saved ? JSON.parse(saved) : [
      {
        id: "welcome-1",
        role: "model",
        text: "¡Hola! 👋 Qué gusto saludarte hoy. Veo que andas con el ánimo algo desgastado del hospital. ¿Cómo estuvo tu guardia? Cuéntame lo que sientas, aquí estoy para escucharte sin juicios.",
        timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' }),
        detectedMood: "cansado"
      }
    ];
  });
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);

  // Patient Chat conversation (Patient Consultation Tab)
  const [patientInput, setPatientInput] = useState<string>("");
  const [sleepSliderVal, setSleepSliderVal] = useState<number>(4);
  const [isWeeklySummaryOpen, setIsWeeklySummaryOpen] = useState<boolean>(false);

  // Active clinical consultation state tracking
  const [activeConsultation, setActiveConsultation] = useState<{
    index: number;
    total: number;
    patientName: string;
    day: string;
  } | null>(() => {
    const saved = localStorage.getItem("active_patient_consultation");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    if (activeConsultation) {
      localStorage.setItem("active_patient_consultation", JSON.stringify(activeConsultation));
    } else {
      localStorage.removeItem("active_patient_consultation");
    }
  }, [activeConsultation]);

  const [patientMessages, setPatientMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("papita_patient_chat");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // continue to default
      }
    }
    let savedProfileName = "Dr. Diego";
    try {
      const savedProf = localStorage.getItem("papita_profile");
      if (savedProf) {
        savedProfileName = JSON.parse(savedProf).name || "Dr. Diego";
      }
    } catch (e) {}

    return [
      {
        id: "patient-welcome-1",
        role: "model",
        text: generateDynamicWelcomeGreeting(savedProfileName),
        timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });
  const [isPatientTyping, setIsPatientTyping] = useState<boolean>(false);
  const [isPatientMicActive, setIsPatientMicActive] = useState<boolean>(false);

  // Stats / Streak state
  const [streak, setStreak] = useState<number>(5);
  const [points, setPoints] = useState<number>(145);

  // New log creation states (Registro tab)
  const [regSleep, setRegSleep] = useState<number>(6);
  const [regEnergy, setRegEnergy] = useState<number>(70);
  const [regMood, setRegMood] = useState<MoodType>("cansado");
  const [regNotes, setRegNotes] = useState<string>("");

  // Past Clinical Chats
  const [pastClinicalChats, setPastClinicalChats] = useState<any[]>(() => {
    const saved = localStorage.getItem("papita_past_clinical_chats");
    return saved ? JSON.parse(saved) : [
      {
        id: "past-1",
        title: "Dosis Amoxicilina (Lactante 12kg)",
        date: "11 Jun",
        messages: [
          { id: "p1-m1", role: "user", text: "¿Cuál es la dosis recomendada de amoxicilina en neumonía típica para lactante de 12kg?", timestamp: "10:30" },
          { id: "p1-m2", role: "model", text: "Dr. Diego, para neumonía típica en pediatría, la dosis recomendada es de 80-90 mg/kg/día dividida en 3 tomas.\n\nPara un lactante de 12 kg:\n- Dosis total diaria: 12 kg x 80 mg = 960 mg/día.\n- Usando suspensión de 250mg/5ml (50mg/ml), requiere 19.2 ml al día.\n- División: 6.4 ml cada 8 horas por 7 a 10 días.\n\n⚠️ Por favor, evalúa siempre la tolerancia vía oral y estado general del lactante.", timestamp: "10:31" }
        ]
      },
      {
        id: "past-2",
        title: "Diferencial Meningitis Citoquímico",
        date: "10 Jun",
        messages: [
          { id: "p2-m1", role: "user", text: "Parámetros de LCR para diferenciar meningitis bacteriana vs viral", timestamp: "15:20" },
          { id: "p2-m2", role: "model", text: "Aquí tienes los parámetros diferenciales estándar en pediatría:\n\n1. Aspecto: Turbio en bacteriana vs claro ('agua de roca') en viral.\n2. Células: >1000 leucocitos/mm³ con predominio PMN en bacteriana, vs <500 leucocitos con predominio de mononucleares en viral.\n3. Proteínas: Muy elevadas (>100 mg/dl) en bacteriana vs normales/leves (<100 mg/dl) en viral.\n4. Glucosa: Muy disminuida (<40% de la central o <40 mg/dl) en bacteriana vs normal en viral.", timestamp: "15:22" }
        ]
      }
    ];
  });
  
  const [isPastChatsOpen, setIsPastChatsOpen] = useState<boolean>(false);
  const [pastChatsSearch, setPastChatsSearch] = useState<string>("");

  // Sub-tabs inside Registro view ("grafico" vs "monitoreo")
  const [regSubTab, setRegSubTab] = useState<"grafico" | "monitoreo">("grafico");

  // Chart visibility toggles
  const [showSleepLine, setShowSleepLine] = useState<boolean>(true);
  const [showEnergyLine, setShowEnergyLine] = useState<boolean>(true);
  const [showMoodLine, setShowMoodLine] = useState<boolean>(true);

  // Active hover point index for interactive tooltips
  const [activeChartIndex, setActiveChartIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const patientMessagesEndRef = useRef<HTMLDivElement>(null);

  // ---- EFFECTS ----
  useEffect(() => {
    let isMounted = true;
    setIsScheduleLoading(true);
    fetch("/api/doctor-schedule")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data && data.success && data.schedule) {
          setScheduleData(data.schedule);
          console.log("[Schedule] Horario de consultas cargado con éxito.");
        }
      })
      .catch((err) => {
        console.error("[Schedule] Error al solicitar el horario de consultas:", err);
      })
      .finally(() => {
        if (isMounted) setIsScheduleLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("papita_logs", JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem("papita_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem("profile_age", profileAge);
  }, [profileAge]);

  useEffect(() => {
    localStorage.setItem("profile_gender", profileGender);
  }, [profileGender]);

  useEffect(() => {
    localStorage.setItem("profile_work_area", profileWorkArea);
  }, [profileWorkArea]);

  useEffect(() => {
    localStorage.setItem("profile_connecting_activities", JSON.stringify(profileConnectingActivities));
  }, [profileConnectingActivities]);

  useEffect(() => {
    localStorage.setItem("profile_motivation", JSON.stringify(profileMotivation));
  }, [profileMotivation]);

  useEffect(() => {
    localStorage.setItem("profile_shift_type", profileShiftType);
  }, [profileShiftType]);

  useEffect(() => {
    localStorage.setItem("profile_health_issue", profileHealthIssue);
  }, [profileHealthIssue]);

  useEffect(() => {
    localStorage.setItem("profile_custom_health_issue", profileCustomHealthIssue);
  }, [profileCustomHealthIssue]);

  useEffect(() => {
    localStorage.setItem("profile_work_hours", profileWorkHours);
  }, [profileWorkHours]);

  useEffect(() => {
    localStorage.setItem("profile_ideal_sleep_hours", profileIdealSleepHours);
  }, [profileIdealSleepHours]);

  useEffect(() => {
    localStorage.setItem("papita_past_clinical_chats", JSON.stringify(pastClinicalChats));
  }, [pastClinicalChats]);

  useEffect(() => {
    localStorage.setItem("papita_chat", JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("papita_patient_chat", JSON.stringify(patientMessages));
    setTimeout(() => {
      patientMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  }, [patientMessages]);

  // ---- GOOGLE DRIVE INTEGRATION HANDLERS ----
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setDriveUser(user);
        setDriveToken(token);
        // Load initial files on page mount if already authenticated
        loadDriveFiles(token);
      },
      () => {
        setDriveUser(null);
        setDriveToken(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleUpdateConnectedFolder = (urlOrId: string) => {
    if (!urlOrId.trim()) return;
    const match = urlOrId.match(/[-\w]{25,}/);
    const resolvedId = match ? match[0] : urlOrId.trim();
    setDriveFolderId(resolvedId);
    setDriveFolderUrl(urlOrId.trim());
    localStorage.setItem("connected_drive_folder_id", resolvedId);
    localStorage.setItem("connected_drive_folder_url", urlOrId.trim());
    
    // Refresh files list with the brand new folder focus!
    if (driveToken) {
      loadDriveFiles(driveToken, driveSearch, resolvedId);
    }
  };

  const loadDriveFiles = async (
    tokenString: string | null = null, 
    searchString: string = "", 
    folderIdInput: string | null = null
  ) => {
    const activeToken = tokenString || driveToken;
    if (!activeToken) return;

    setIsDriveLoading(true);
    setDriveStatusMessage(null);
    try {
      const activeFolderId = folderIdInput || driveFolderId;
      // Fetch files filtering by specific parent folder
      const files = await listDriveFiles(activeToken, searchString, activeFolderId);
      setDriveFiles(files);
    } catch (err: any) {
      console.error("No se pudieron cargar archivos de la carpeta de Google Drive:", err);
      // Clean fallback: list general root files so client experiences zero crashes or locks
      try {
        const files = await listDriveFiles(activeToken, searchString);
        setDriveFiles(files);
        setDriveStatusMessage("Mostrando archivos de raíz. (La carpeta de guardia no devolvió archivos)");
      } catch (innerErr) {
        setDriveStatusMessage("Error al cargar archivos de Google Drive");
      }
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleDriveLogin = async () => {
    setIsDriveLoading(true);
    setDriveStatusMessage("Iniciando sesión con Google...");
    try {
      const result = await googleSignIn();
      if (result) {
        setDriveUser(result.user);
        setDriveToken(result.accessToken);
        setDriveStatusMessage("¡Conexión de Google Drive exitosa!");
        loadDriveFiles(result.accessToken);
      }
    } catch (err: any) {
      if (err?.code === "auth/popup-closed-by-user" || err?.message?.includes("popup-closed-by-user")) {
        console.warn("Autenticación cancelada: El usuario cerró la ventana emergente.");
        setDriveStatusMessage("Inicio de sesión cancelado de guardia. Vuelve a intentarlo manteniendo la ventana de Google abierta.");
      } else if (err?.code === "auth/cancelled-popup-request" || err?.message?.includes("cancelled-popup-request")) {
        console.warn("Autenticación cancelada de forma automática.");
        setDriveStatusMessage("Se interrumpió la solicitud por un nuevo intento. Inténtalo otra vez.");
      } else {
        console.error("Autenticación con Google Drive fallida:", err);
        setDriveStatusMessage(`Error: ${err?.message || "No se pudo conectar Google Drive"}`);
      }
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleDriveLogout = async () => {
    if (window.confirm("¿Estás seguro de que deseas desconectar Google Drive de esta sesión?")) {
      await logoutGoogle();
      setDriveUser(null);
      setDriveToken(null);
      setDriveFiles([]);
      setDriveStatusMessage("Google Drive desconectado");
    }
  };

  const handleBackupActiveConsultation = async () => {
    const activeToken = driveToken || (await getAccessToken());
    if (!activeToken) {
      alert("Por favor conecta tu cuenta de Google Drive primero.");
      return;
    }

    if (patientMessages.length <= 1) {
      alert("No hay mensajes clínicos o consultas para respaldar.");
      return;
    }

    const firstUserMsg = patientMessages.find(m => m.role === "user")?.text || "Consulta";
    const cleanTitle = firstUserMsg.length > 20 ? firstUserMsg.substring(0, 20) + "..." : firstUserMsg;
    const safeFileName = `Papita_Consulta_${cleanTitle.replace(/[\\/:*?"<>|]/g, "_")}_${new Date().toISOString().split('T')[0]}.txt`;

    setIsUploadingToDrive(true);
    setDriveStatusMessage("Respaldando consulta clínica en Google Drive...");

    let reportText = `==================================================\n`;
    reportText += `🩺 DRA. PAPITA - COMPAÑERO DE GUARDIA HOSPITALARIA\n`;
    reportText += `==================================================\n\n`;
    reportText += `Ficha Médico: ${profile.name} (${profile.specialty})\n`;
    reportText += `Establecimiento: ${profile.hospital}\n`;
    reportText += `Fecha Respaldo: ${new Date().toLocaleDateString("es-ES")} ${new Date().toLocaleTimeString("es-ES")}\n\n`;
    reportText += `---------------- HISTORIAL CONSULTA PEDIÁTRICA ----------------\n\n`;

    patientMessages.forEach((msg) => {
      const actor = msg.role === "user" ? `Doctor Diego` : `Dra. Papita AI`;
      reportText += `[${msg.timestamp || "--:--"}] ${actor}:\n${msg.text}\n\n`;
    });

    reportText += `----------------------------------------------------------\n`;
    reportText += `Fin del reporte. Recetario/Hábito actual: ${recommendation}\n`;

    try {
      const fileData = await uploadTextFile(activeToken, safeFileName, reportText);
      setDriveStatusMessage(`¡Excelente! Consulta respaldada como: "${fileData.name}"`);
      loadDriveFiles(activeToken);
    } catch (err: any) {
      console.error("Error al subir archivo a Drive:", err);
      setDriveStatusMessage("Fallo al subir el reporte a Drive");
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleBackupPastSession = async (session: any) => {
    const activeToken = driveToken || (await getAccessToken());
    if (!activeToken) {
      alert("Conecta tu cuenta de Google Drive para archivar esta sesión.");
      return;
    }

    setIsUploadingToDrive(true);
    setDriveStatusMessage(`Archivando en Google Drive...`);

    const safeFileName = `Respaldo_Papita_${session.title.replace(/[\\/:*?"<>|]/g, "_")}_${new Date().toISOString().split('T')[0]}.txt`;

    let reportText = `==================================================\n`;
    reportText += `🩺 DRA. PAPITA - CONSULTA CLÍNICA ARCHIVADA\n`;
    reportText += `==================================================\n\n`;
    reportText += `Caso: ${session.title}\n`;
    reportText += `Fecha Sesión: ${session.date}\n`;
    reportText += `Pediatra: ${profile.name} (${profile.specialty})\n\n`;
    reportText += `---------------- HISTORIAL CLÍNICO COMPLEMENTARIO ----------------\n\n`;

    session.messages.forEach((msg: any) => {
      const actor = msg.role === "user" ? `Doctor` : `Dra. Papita AI`;
      reportText += `[${msg.timestamp || "--:--"}] ${actor}:\n${msg.text}\n\n`;
    });

    try {
      const uploaded = await uploadTextFile(activeToken, safeFileName, reportText);
      setDriveStatusMessage(`¡Archivado con éxito! Guardado en Drive: "${uploaded.name}"`);
      loadDriveFiles(activeToken);
    } catch (err: any) {
      console.error("Error backing up past session:", err);
      setDriveStatusMessage("Fallo al archivar en Drive");
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleImportDocAsContext = async (file: DriveFile) => {
    const activeToken = driveToken || (await getAccessToken());
    if (!activeToken) {
      alert("Por favor conecta tu cuenta de Google Drive primero.");
      return;
    }

    setIsDriveLoading(true);
    setDriveStatusMessage(`Procesando archivo "${file.name}" en Papita AI (soporta PDFs, guías TXT, Docs)...`);
    try {
      const response = await fetch("/api/drive-read-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: file.id,
          mimeType: file.mimeType,
          accessToken: activeToken
        })
      });

      if (!response.ok) {
        throw new Error("No se pudo extraer o parsear el contenido en el servidor backend.");
      }

      const data = await response.json();
      const content = data.contentText || "";
      
      setActiveImportedContent({
        name: file.name,
        text: content
      });

      // Autofills input context with custom instructions to allow easy summarization
      const headerPrefix = `[Archivo Google Drive: ${file.name}]\n`;
      const excerpt = content.substring(0, 400);
      
      setPatientInput(`${headerPrefix}\n${excerpt}${content.length > 400 ? "..." : ""}\n\nPor favor resume esta guía o responde a la consulta basándote en ella: `);
      setDriveStatusMessage(`"${file.name}" cargado con éxito en Papita AI.`);
    } catch (err: any) {
      console.error("Error reading file:", err);
      // Fallback client-side for general text or word Docs
      try {
        const content = await getFileContentText(activeToken, file.id, file.mimeType);
        setActiveImportedContent({
          name: file.name,
          text: content
        });
        const headerPrefix = `[Archivo Google Drive: ${file.name}]\n`;
        const excerpt = content.substring(0, 400);
        setPatientInput(`${headerPrefix}\n${excerpt}${content.length > 400 ? "..." : ""}\n\nPor favor resume esta guía: `);
        setDriveStatusMessage(`"${file.name}" cargado en cuadro.`);
      } catch (innerErr) {
        setDriveStatusMessage("No se pudo leer el archivo. Asegúrate de que sea un PDF, TXT o Google Doc legible.");
      }
    } finally {
      setIsDriveLoading(false);
    }
  };

  const getMoodBadgeColor = (m: MoodType) => {
    switch (m) {
      case "feliz": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "cansado": return "bg-blue-100 text-blue-800 border-blue-200";
      case "estresado": return "bg-rose-100 text-rose-800 border-rose-200";
      case "triste": return "bg-sky-100 text-sky-800 border-sky-200";
      case "neutro": default: return "bg-slate-100 text-gray-700 border-gray-200";
    }
  };

  const getMoodEmoji = (m: MoodType) => {
    switch (m) {
      case "feliz": return "😊";
      case "cansado": return "🥱";
      case "estresado": return "🤯";
      case "triste": return "🥺";
      case "neutro": default: return "😐";
    }
  };

  // ---- CHAT SUBMISSION (REDISTRIBUTION TO CLINICAL PATIENT CHAT) ----
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsgText = chatInput.trim();
    setChatInput(""); 
    
    // Switch to clinical patient consultation tab
    setActiveTab("historial");

    // Send directly into patient chat
    const userMessage: ChatMessage = {
      id: `pat-${Date.now()}`,
      role: "user",
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
    };

    setPatientMessages((prev) => [...prev, userMessage]);
    setIsPatientTyping(true);

    // Track active patient context from user query
    detectAndSetActivePatient(userMsgText);

    try {
      const response = await fetch("/api/chat-paciente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsgText,
          history: patientMessages.map(m => ({ role: m.role, text: m.text })),
          driveContext: activeImportedContent ? {
            fileName: activeImportedContent.name,
            fileText: activeImportedContent.text
          } : undefined,
          doctorInterests: profileConnectingActivities
        })
      });

      if (!response.ok) {
        throw new Error("Error consultando al agente clínico de Papita.");
      }

      const data = await response.json();

      setTimeout(() => {
        const papitaMessage: ChatMessage = {
          id: `pat-${Date.now() + 1}`,
          role: "model",
          text: data.reply || data,
          timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
        };
        setPatientMessages((prev) => [...prev, papitaMessage]);
        setIsPatientTyping(false);

        if (data.suggestedHabit) {
          setRecommendation(`Dosis/Guía: ${data.suggestedHabit}`);
          setIsRecommendationDone(false);
        }
      }, 700);

    } catch (err) {
      console.error(err);
      setIsPatientTyping(false);

      const errMsg: ChatMessage = {
        id: `pat-err-${Date.now()}`,
        role: "model",
        text: "Dra. Papita está evaluando pacientes en el consultorio de enlace clínico 🥔 Clinically error. Por seguridad, verifica siempre con tu vademécum de pediatría de referencia.",
        timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
      };
      setPatientMessages((prev) => [...prev, errMsg]);
    }
  };

  // ---- CHAT SUBMISSION (PATIENT CONSULTATION) ----
  const handleSendPatientMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!patientInput.trim()) return;

    const userMsgText = patientInput;
    setPatientInput("");

    const userMessage: ChatMessage = {
      id: `pat-${Date.now()}`,
      role: "user",
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
    };

    setPatientMessages((prev) => [...prev, userMessage]);
    setIsPatientTyping(true);

    // Track active patient context from user query
    detectAndSetActivePatient(userMsgText);

    try {
      const response = await fetch("/api/chat-paciente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsgText,
          history: patientMessages.map(m => ({ role: m.role, text: m.text })),
          driveContext: activeImportedContent ? {
            fileName: activeImportedContent.name,
            fileText: activeImportedContent.text
          } : undefined,
          doctorInterests: profileConnectingActivities
        })
      });

      if (!response.ok) {
        throw new Error("Error consultando al agente clínico de Papita.");
      }

      const data = await response.json();

      setTimeout(() => {
        const papitaMessage: ChatMessage = {
          id: `pat-${Date.now() + 1}`,
          role: "model",
          text: data.reply || data,
          timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
        };
        setPatientMessages((prev) => [...prev, papitaMessage]);
        setIsPatientTyping(false);

        if (data.suggestedHabit) {
          setRecommendation(`Dosis/Guía: ${data.suggestedHabit}`);
          setIsRecommendationDone(false);
        }
      }, 700);

    } catch (err) {
      console.error(err);
      setIsPatientTyping(false);

      const errMsg: ChatMessage = {
        id: `pat-err-${Date.now()}`,
        role: "model",
        text: "Dra. Papita está evaluando pacientes en el consultorio de enlace clínico 🥔 Clinically error. Por seguridad, verifica siempre con tu vademécum de pediatría de referencia.",
        timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
      };
      setPatientMessages((prev) => [...prev, errMsg]);
    }
  };

  // Helper to automatically identify and set the active patient in evaluation
  const detectAndSetActivePatient = (messageText: string) => {
    if (!scheduleData || Object.keys(scheduleData).length === 0) return null;
    const lowercaseText = messageText.toLowerCase();
    
    const days = [scheduleSelectedDay, "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    for (const day of days) {
      const list = scheduleData[day];
      if (list) {
        const foundIdx = list.findIndex(p => lowercaseText.includes(p.patientName.toLowerCase()));
        if (foundIdx !== -1) {
          const act = {
            index: foundIdx,
            total: list.length,
            patientName: list[foundIdx].patientName,
            day: day
          };
          setActiveConsultation(act);
          return act;
        }
      }
    }
    return null;
  };

  // Requested extra summary workflow (Si, dame más información)
  const handleRequestMoreInfo = async () => {
    const userMsgText = "Sí, dame más información sobre el paciente";
    
    const userMessage: ChatMessage = {
      id: `pat-${Date.now()}`,
      role: "user",
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
    };

    setPatientMessages((prev) => [...prev, userMessage]);
    setIsPatientTyping(true);

    try {
      const contextPatient = activeConsultation ? activeConsultation.patientName : "";
      const extraPrompt = contextPatient 
        ? `Por favor, genera un resumen clínico DIFERENTE y extendido sobre el paciente ${contextPatient} en base a su historial clínico, enfocándote en otros aspects (como examen físico, antecedentes, plan terapéutico o detalles de su ficha de Azure) sin dar recomendaciones de diagnóstico ni tratamientos que rompan las reglas de diagnóstico. Al final, por favor incluye textualmente la pregunta exacta: '¿Deseas más información sobre el paciente?'`
        : `Por favor, genera un resumen clínico DIFERENTE y extendido sobre el paciente en evaluación en base a su historial clínico, enfocándote en otros aspectos sin dar recomendaciones de diagnóstico o diferencial. Al final, incluye textualmente la pregunta exacta: '¿Deseas más información sobre el paciente?'`;

      const response = await fetch("/api/chat-paciente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: extraPrompt,
          history: patientMessages.map(m => ({ role: m.role, text: m.text })),
          driveContext: activeImportedContent ? {
            fileName: activeImportedContent.name,
            fileText: activeImportedContent.text
          } : undefined,
          doctorInterests: profileConnectingActivities
        })
      });

      if (!response.ok) {
        throw new Error("Error consultando al agente clínico de Papita.");
      }

      const data = await response.json();

      setTimeout(() => {
        const papitaMessage: ChatMessage = {
          id: `pat-${Date.now() + 1}`,
          role: "model",
          text: data.reply || data,
          timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
        };
        setPatientMessages((prev) => [...prev, papitaMessage]);
        setIsPatientTyping(false);

        if (data.suggestedHabit) {
          setRecommendation(`Dosis/Guía: ${data.suggestedHabit}`);
          setIsRecommendationDone(false);
        }
      }, 700);

    } catch (err) {
      console.error(err);
      setIsPatientTyping(false);
      const errMsg: ChatMessage = {
        id: `pat-err-${Date.now()}`,
        role: "model",
        text: "Dra. Papita está evaluando pacientes en el consultorio de enlace clínico 🥔 Clinically error. Por seguridad, verifica siempre con tu vademécum de pediatría de referencia.",
        timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
      };
      setPatientMessages((prev) => [...prev, errMsg]);
    }
  };

  // Finished consultation workflow (No, ya terminé la consulta)
  const handleFinishConsultation = () => {
    const userMsgText = "No, ya terminé la consulta";
    
    const userMessage: ChatMessage = {
      id: `pat-${Date.now()}`,
      role: "user",
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
    };

    setPatientMessages((prev) => [...prev, userMessage]);
    setIsPatientTyping(true);

    setTimeout(() => {
      const day = activeConsultation?.day || scheduleSelectedDay;
      const list = scheduleData[day] || [];
      const totalPatients = activeConsultation?.total || list.length || 4;
      const currentIndex = activeConsultation?.index !== undefined ? activeConsultation.index : 0;
      
      let phase: "inicio" | "mitad" | "final" = "mitad";
      if (currentIndex === 0) {
        phase = "inicio";
      } else if (currentIndex === totalPatients - 1) {
        phase = "final";
      }

      const baseKey = "asked_" + day;
      const askedInicio = localStorage.getItem(baseKey + "_inicio") === "true";
      const askedMitad = localStorage.getItem(baseKey + "_mitad") === "true";
      const askedFinal = localStorage.getItem(baseKey + "_final") === "true";

      let replyText = "";
      let showMbiScale = false;
      let activeMbiCode = "";

      const info = getMbiQuestionAndCode(weeklyDayNumber, phase);
      activeMbiCode = info.activeMbiCode;

      if (phase === "inicio") {
        if (!askedInicio) {
          replyText = `Entendido, doctor. Por favor, responde a la siguiente pregunta:\n\n**${info.questionText}**`;
          showMbiScale = true;
        } else {
          replyText = `¡Perfecto! Has terminado esta consulta con éxito. ¡Sigue adelante con mucho ánimo, colega! 🥔✨`;
        }
      } else if (phase === "final") {
        if (!askedFinal) {
          replyText = `¡Excelente labor con este paciente hoy, doctor! Por favor, responde a la siguiente pregunta:\n\n**${info.questionText}**`;
          showMbiScale = true;
        } else {
          replyText = `¡Excelente labor hoy! Has terminado tu jornada de consultas con éxito. ¡A descansar y desconectar para recargar tus energías, doctor! 🥔💤`;
        }
      } else {
        if (!askedMitad) {
          replyText = `¡Bien hecho, doctor! Por favor, responde a la siguiente pregunta:\n\n**${info.questionText}**`;
          showMbiScale = true;
        } else {
          replyText = `¡Buen trabajo! Has completado la consulta del paciente de forma excelente. ¡Sigue adelante con tu jornada! 💧🥔`;
        }
      }

      const papitaMessage: ChatMessage = {
        id: `pat-${Date.now() + 1}`,
        role: "model",
        text: replyText,
        timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' }),
        showMbiScale: showMbiScale,
        mbiCode: activeMbiCode
      };

      setPatientMessages((prev) => [...prev, papitaMessage]);
      setIsPatientTyping(false);
    }, 700);
  };

  // MBI Answer submission helper
  const handleRegisterMbiAnswer = async (score: number, mbiCode: string) => {
    const day = activeConsultation?.day || scheduleSelectedDay;
    const baseKey = "asked_" + day;
    const phasePart = mbiCode.split("_")[1];
    localStorage.setItem(`${baseKey}_${phasePart}`, "true");

    const userMessage: ChatMessage = {
      id: `pat-${Date.now()}`,
      role: "user",
      text: `Registré mi respuesta en escala MBI: ${score}`,
      timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
    };

    setPatientMessages((prev) => 
      prev.map(m => m.mbiCode === mbiCode ? { ...m, showMbiScale: false } : m)
    );
    setPatientMessages((prev) => [...prev, userMessage]);
    setIsPatientTyping(true);

    // Find the saved time suffix from chat history
    const findSavedTime = () => {
      for (let i = patientMessages.length - 1; i >= 0; i--) {
        const txt = patientMessages[i].text;
        if (txt && txt.includes("ahorrado")) {
          const match = txt.match(/ahorrado\s+([^\n.]+)/i);
          if (match) {
            return match[1].trim();
          }
        }
      }
      return "9 minutos y 45 segundos"; // Perfect fallback
    };

    const savedTime = findSavedTime();

    try {
      const pNum = weeklyDayNumber;
      const phaseVal = phasePart as "inicio" | "mitad" | "final";
      const info = getMbiQuestionAndCode(pNum, phaseVal);

      // Call/Trigger backend Gemini API for beautifully tailored three-paragraph coaching response
      const response = await fetch("/api/chat-paciente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `El doctor ha respondido con un puntaje de ${score}/6 a la pregunta de monitoreo diario (${info.questionText}) para la dimensión "${info.dimensionLabel}".`,
          history: [], 
          isMbiRegistration: true,
          mbiScore: score,
          mbiCode: mbiCode,
          mbiDimension: info.dimensionLabel,
          mbiQuestion: info.questionText,
          savedTime: savedTime,
          doctorProfile: {
            name: profile.name || "Dr. Diego",
            specialty: profile.specialty || "Pediatra",
            hospital: profile.hospital || "Hospital General de Niños",
            age: profileAge,
            gender: profileGender,
            workArea: profileWorkArea,
            shiftType: profileShiftType,
            workHours: profileWorkHours,
            idealSleepHours: profileIdealSleepHours,
            connectingActivities: profileConnectingActivities,
            motivations: [profileMotivation]
          }
        })
      });

      if (!response.ok) {
        throw new Error("No response from Papita wellness API.");
      }

      const data = await response.json();
      setTimeout(() => {
        let replyText = data.reply || "¡Hola, doctor! sigamos adelante con tu jornada laboral de forma saludable.";
        const papitaMessage: ChatMessage = {
          id: `pat-${Date.now() + 1}`,
          role: "model",
          text: replyText,
          timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
        };
        setPatientMessages((prev) => [...prev, papitaMessage]);
        setIsPatientTyping(false);
      }, 500);

    } catch (err) {
      console.error(err);
      setIsPatientTyping(false);
      // Fallback
      const pNum = weeklyDayNumber;
      const phaseVal = phasePart as "inicio" | "mitad" | "final";
      const info = getMbiQuestionAndCode(pNum, phaseVal);
      const papitaMessage: ChatMessage = {
        id: `pat-${Date.now() + 1}`,
        role: "model",
        text: `¡Excelente registro, doctor! He guardado tu respuesta de **${score}/6** para la dimensión de **${info.dimensionLabel}**. 🌟 Con los **${savedTime}** que te acabas de ahorrar gracias a los resúmenes de Papita AI, tómate un momento especial para una micro pausa regeneradora hoy. ¡Te lo mereces muchísimo, colega de gran corazón! 🤗🥔`,
        timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
      };
      setPatientMessages((prev) => [...prev, papitaMessage]);
    }
  };

  // Handler for sleep selection registration
  const handleRegisterSleep = async (choice: string) => {
    const detail = getSleepClassificationDetail(choice);
    // User message should only contain the sleep hours amount, not the classification!
    const userMsgText = choice;
    
    const userMessage: ChatMessage = {
      id: `pat-sleep-${Date.now()}`,
      role: "user",
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
    };

    setPatientMessages((prev) => [...prev, userMessage]);
    setIsPatientTyping(true);

    const workArea = profileWorkArea || profile.specialty || "Medicina general";
    const shiftsText = `turnos ${profileShiftType.toLowerCase()}`;
    const shiftsOrAreaText = `turnos ${profileShiftType.toLowerCase()} de ${workArea}`;
    const userInterests = profileConnectingActivities.length > 0
      ? profileConnectingActivities.join(", ")
      : "meditar o leer";

    try {
      const promptText = `El médico de guardia reporta que descansó: "${choice}".
Su estado de salud según sus horas de descanso se clasifica en esta categoría: ${detail.classification}.
Intereses/Hobbies registrados en el perfil de este médico: [${userInterests}].

Por favor, genera un comentario u opinión como Papita AI, ofreciendo un feedback clínico, cariñoso y de bienestar de manera sumamente CONCISA, BREVE y DIRECTA (máximo 120-150 palabras en total). Evita introducciones o explicaciones largas y rellena con los datos de su perfil de la siguiente manera:

Recomendaciones obligatorias según la categoría:
- Si el sueño es bajo (categorías 🔴 deprivación crítica, 🟠 deprivación alta, o 🟡 deprivación leve):
  Debes proponer estrictamente SOLO 1 ACTIVIDAD CONCRETA y breve para realizar como una MICROPUSA entre consultas con tus pacientes, para reducir/evitar la fatiga, MENCIONAR EL TIEMPO exacto de dedicación que le demorará (ej. 2, 3 o 4 minutos) y dar un PASO A PASO detallado pero súper compacto de cómo realizar esa única actividad entre paciente y paciente. Estructura el paso a paso en una lista numerada, usando negritas y emojis vistosos. No sugieras opciones secundarias.
  Sigue esta guía base y hazla sumamente compacta enfocándote en pausas entre consultas:
  * 🔴 deprivación crítica (<4h): “Hoy dormiste muy pocas horas. Considerando tu trabajo en ${workArea}, aquí tienes una micropausa concreta de [tiempo] minutos para hacer entre consultas de pacientes: [Añade el paso a paso numerado cortito con emojis y negritas]”
  * 🟠 deprivación alta (4–5h): “Tu descanso fue bajo en un contexto de ${shiftsText}. Te aconsejo realizar esta micropausa de [tiempo] minutos entre tus próximas consultas: [Añade el paso a paso numerado cortito con emojis y negritas]”
  * 🟡 deprivación leve (5–6h o 6–7h): “Estás cerca de un rango funcional, pero el trabajo en ${workArea} agota tu energía. Prueba esta micropausa de [tiempo] minutos entre consultas: [Añade el paso a paso numerado cortito con emojis y negritas]”

- Si el sueño es óptimo (categorías 🟢 óptimo o 🟢🟢 posible compensación):
  Debes felicitar cariñosamente al doctor y motivarlo activamente a realizar estrictamente SOLO 1 ACTIVIDAD o micropausa breve entre consultas, en base a sus intereses registrados [${userInterests}], dando un PASO A PASO dinámico, breve y alegre con negritas y emojis.
  Sigue esta guía base y hazla sumamente compacta:
  * 🟢 óptimo (7–8h o 8–9h): “¡Felicidades por priorizar tu higiene de sueño! Mantener esta estabilidad en ${shiftsOrAreaText} protegerá tu energía. Hoy que tienes las pilas cargadas, disfruta de tu interés por [un interés de los registrados] con esta micropausa rápida de bienestar entre consultas: [Paso a paso cortito con emojis y negritas]”
  * 🟢🟢 posible compensación (>9h): “¡Excelente recarga reparadora para contrarrestar la alta carga en ${workArea}! Activa hoy tu vitalidad gozando de [un interés de los registrados] mediante una provechosa micropausa entre consultas con esta idea rápida: [Paso a paso cortito con emojis y negritas]”

¡IMPORTANTE!: La frase "Tiempo ahorrado:" NO debe aparecer en esta recomendación de descanso bajo ninguna circunstancia. Termina con una pregunta breve y cariñosa de una sola línea sobre qué caso clínico consultaremos hoy.`;

      const response = await fetch("/api/chat-paciente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: promptText,
          history: [], // start clean for sleep advice so it focuses 100% on it
          isSleepRegistration: true,
          doctorInterests: profileConnectingActivities
        })
      });

      if (!response.ok) {
        throw new Error("No response from Papita");
      }

      const data = await response.json();
      setTimeout(() => {
        let replyText = data.reply || data;
        if (replyText && typeof replyText === "string") {
          // Remove any accidental "Tiempo ahorrado" from the response text
          replyText = replyText.replace(/Tiempo ahorrado:.*$/im, "").trim();
        }

        const papitaMessage: ChatMessage = {
          id: `pat-${Date.now() + 1}`,
          role: "model",
          text: replyText,
          timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' }),
          isSleepRegistration: true
        };
        setPatientMessages((prev) => [...prev, papitaMessage]);
        setIsPatientTyping(false);
      }, 700);

    } catch (err) {
      console.error(err);
      setIsPatientTyping(false);
      
      let fallbackText = "";
      const primaryInterest = profileConnectingActivities[0] || "meditación/yoga";
      
      if (detail.status === "deprivación crítica") {
        fallbackText = `¡Hola, ${profile.name || "doctor"}! 🔴 Tu descanso fue muy bajo. Considerando tu trabajo en ${workArea}, intenta priorizar pequeñas micropausas entre tus consultas de hoy. 

Te aconsejo una **micropausa de hidratación flash** de exactamente **2 minutos** entre tu consulta actual y la siguiente:

1. 💧 **Paso 1 (0:30 min):** Lava tus antebrazos y salpica un poco de **agua fría** en tus párpados para despertar tu sistema.
2. 🧘‍♂️ **Paso 2 (0:30 min):** Haz **3 rotaciones lentas** de hombros inhalando profundamente en tu silla.
3. 🥛 **Paso 3 (1:00 min):** ¡Bebe despacio un vaso completo de **agua helada** antes de llamar al siguiente paciente!

🔬🥔 ¿Qué paciente empezamos a evaluar hoy?`;
      } else if (detail.status === "deprivación alta") {
        fallbackText = `¡Hola, ${profile.name || "doctor"}! 🟠 Dormiste poco en un contexto de ${shiftsText}. Cuida tu energía tomando espacios de desconexión corta entre consultas.

Prueba esta **respiración diafragmática de micropausa** de exactamente **3 minutos** antes de tu siguiente paciente:

1. 🧘‍♀️ **Paso 1 (0:30 min):** Siéntate erguido en la silla del consultorio y **exhala todo el aire**.
2. ⏱️ **Paso 2 (0:30 min):** Inhala por la nariz suavemente contando mentalmente **4 segundos**.
3. 🛑 **Paso 3 (1:00 min):** Sostén con calma el aire en tus pulmones por **7 segundos**.
4. 💨 **Paso 4 (1:00 min):** Exhala haciendo un silbido suave durante **8 segundos** para oxigenar tu cerebro y relajarte.

🔬🥔 ¿Qué paciente pediátrico consultaremos hoy?`;
      } else if (detail.status === "deprivación leve") {
        fallbackText = `¡Hola, ${profile.name || "doctor"}! 🟡 Estás cerca del rango ideal, pero con riesgo de fatiga residual en ${workArea}. Intenta estirarte brevemente entre citas.

Te sugiero un **re-set postural de micropausa activa** de exactamente **4 minutos** entre consultas:

1. 🙆‍♂️ **Paso 1 (1:30 min):** Al finalizar una consulta, estira los brazos entrelazando las manos hacia el techo por **30 segundos** (3 repeticiones).
2. 💆‍♂️ **Paso 2 (1:30 min):** Inclina tu cabeza arrastrando tu oreja al hombro izquierdo por **15 segundos** (repite al lado derecho).
3. 🚶‍♂️ **Paso 3 (1:00 min):** Camina un trayecto de ida y vuelta para reactivar tu circulación antes de ver al próximo paciente.

🔬🥔 ¿Qué caso pediátrico veremos hoy?`;
      } else if (detail.status === "óptimo") {
        fallbackText = `¡Espléndido, ${profile.name || "doctor"}! 🟢 Lograste un buen descanso para afrontar la exigencia de ${shiftsOrAreaText}. ¡Te felicito mucho!

Dado que estás lleno de energía hoy, disfruta una provechosa micropausa de bienestar por **${primaryInterest}** entre tus pacientes:

1. 📅 **Paso 1:** Al finalizar una consulta, reserva un micro-bloque de **5 minutos** consagrados antes de llamar al siguiente.
2. 📴 **Paso 2:** Pon tu móvil en modo silencioso y descansa tu vista por completo.
3. 🧘‍♀️ **Paso 3:** ¡Dedica esos **5 minutos** a conectar mentalmente con tu pasión por **${primaryInterest}** para recargar tu alegría clínica!

🔬🥔 ¿Cuál es el caso clínico de hoy?`;
      } else {
        fallbackText = `¡Hola, ${profile.name || "doctor"}! 🟢🟢 Dormiste más horas de lo habitual para compensar fatiga de ${workArea}. ¡Felicidades por esa recarga reparadora!

Para activar hoy tu estupenda vitalidad con una agradable micropausa de **${primaryInterest}** entre consultas:

1. 🧘‍♂️ **Paso 1 (1 min):** En las transiciones de tus citas, haz un ciclo rápido de estiramiento corporal para disipar la inercia de sueño.
2. 🎯 **Paso 2 (3 min):** Dedica **3 minutos** entre pacientes para revisar o inspirarte en tu hobby de **${primaryInterest}**.
3. 🎨 **Paso 3:** ¡Vuelve a tus atenciones médicas pediátricas con la mente totalmente unificada y fresca!

🔬🥔 ¿Qué paciente evaluamos ahora?`;
      }

      const papitaFallback: ChatMessage = {
        id: `pat-${Date.now() + 1}`,
        role: "model",
        text: fallbackText,
        timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' }),
        isSleepRegistration: true
      };
      setPatientMessages((prev) => [...prev, papitaFallback]);
    }
  };

  // Clear patient chat queries
  const handleClearPatientChat = () => {
    if (window.confirm("¿Seguro que deseas reiniciar el bot de consulta de pacientes?")) {
      const freshGreeting = generateDynamicWelcomeGreeting(profile.name || "Dr. Diego");
      setPatientMessages([
        {
          id: "patient-welcome-1",
          role: "model",
          text: freshGreeting,
          timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setSleepSliderVal(4); // Reset slider value
    }
  };

  // Archive active patient chat
  const handleArchivePatientChat = () => {
    if (patientMessages.length <= 1) {
      alert("No hay mensajes suficientes en la consulta actual para archivar.");
      return;
    }

    const firstUserMsg = patientMessages.find(m => m.role === "user")?.text || "Consulta";
    const shortTitle = firstUserMsg.length > 28 ? firstUserMsg.substring(0, 28) + "..." : firstUserMsg;

    const newSession = {
      id: `p-chat-${Date.now()}`,
      title: shortTitle,
      date: new Date().toLocaleDateString("es-ES", { day: 'numeric', month: 'short' }),
      messages: [...patientMessages]
    };

    setPastClinicalChats((prev) => [newSession, ...prev]);

    const freshGreeting = generateDynamicWelcomeGreeting(profile.name || "Dr. Diego");
    setPatientMessages([
      {
        id: "patient-welcome-1",
        role: "model",
        text: `¡Consulta archivada con éxito! 🔬🥔 ${freshGreeting}`,
        timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setSleepSliderVal(4); // Reset slider value
  };

  // Restore/load selected past chat session
  const handleLoadPastChat = (session: any) => {
    if (window.confirm(`¿Quieres cargar la conversación "${session.title}"?`)) {
      setPatientMessages(session.messages);
      setIsPastChatsOpen(false);
    }
  };

  // Delete selected past chat session
  const handleDeletePastChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Seguro que deseas eliminar esta consulta del historial?")) {
      setPastClinicalChats((prev) => prev.filter(c => c.id !== id));
    }
  };

  // ---- FAST SAVING OF MANUAL REGISTER ----
  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newLog: DailyLog = {
      id: `log-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      sleepHours: regSleep,
      energyPercent: regEnergy,
      mood: regMood,
      notes: regNotes.trim() || undefined,
      timestamp: new Date().toISOString()
    };

    setLogs((prev) => [newLog, ...prev]);
    
    setSleepHours(regSleep);
    setEnergyPercent(regEnergy);
    setCurrentMood(regMood);
    setPoints((prev) => prev + 15); 

    setRegNotes("");
    setActiveTab("inicio");
  };

  const handleQuickAdjustSleep = () => {
    const nextHours = sleepHours >= 10 ? 4 : sleepHours + 1;
    setSleepHours(nextHours);
  };

  const handleQuickAdjustEnergy = () => {
    const nextPercent = energyPercent >= 100 ? 30 : energyPercent + 10;
    setEnergyPercent(nextPercent);
  };

  const handleQuickAdjustMood = () => {
    const order: MoodType[] = ["feliz", "neutro", "cansado", "estresado", "triste"];
    const currIdx = order.indexOf(currentMood);
    const nextMood = order[(currIdx + 1) % order.length];
    setCurrentMood(nextMood);
  };

  const handleCompleteRecommendation = () => {
    if (!isRecommendationDone) {
      setIsRecommendationDone(true);
      setPoints((prev) => prev + 25);
      setStreak((prev) => prev + 1);
    }
  };

  const handleVoiceCommandToggle = () => {
    setIsMicActive(!isMicActive);
    if (!isMicActive) {
      const phrases = [
        "Me siento súper cansado tras la guardia de 24 horas",
        "Hoy el hospital estuvo muy congestionado de pacientes en urgencia",
        "Pude descansar mejor y me siento listo para el pase de sala",
        "Me siento muy estresado con tantas inter consultas"
      ];
      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      
      setTimeout(() => {
        setChatInput(randomPhrase);
        setIsMicActive(false);
      }, 1500);
    }
  };

  const handlePatientVoiceCommandToggle = () => {
    setIsPatientMicActive(!isPatientMicActive);
    if (!isPatientMicActive) {
      const clinicalPhrases = [
        "¿Cuál es el cálculo de amoxicilina de suspensión para neumonía en un lactante de 10 kg?",
        "Diagnóstico diferencial de meningitis bacteriana versus viral en pediatría",
        "Tratamiento de primera línea para crisis de asma moderada en urgencias pediátricas",
        "¿Cuáles son los criterios clínicos de hidratación para un paciente deshidratado grado 2?"
      ];
      const randomPhrase = clinicalPhrases[Math.floor(Math.random() * clinicalPhrases.length)];
      
      setTimeout(() => {
        setPatientInput(randomPhrase);
        setIsPatientMicActive(false);
      }, 1400);
    }
  };

  // Helper inside click board buttons
  const toggleHobby = (hby: string) => {
    if (profileConnectingActivities.includes(hby)) {
      setProfileConnectingActivities(profileConnectingActivities.filter(h => h !== hby));
    } else {
      setProfileConnectingActivities([...profileConnectingActivities, hby]);
    }
  };

  return (
    <div id="papita-app-wrapper" className="min-h-screen bg-[#ECEAF4] flex items-center justify-center py-0 md:py-6 px-0 md:px-4">
      {/* Interactive Mobile Simulator Container Frame */}
      <div 
        id="mobile-phone-simulator" 
        className="w-full max-w-md bg-gradient-to-b from-[#FFFDF9] to-[#FDF8EB] min-h-screen md:min-h-[812px] md:h-[812px] md:rounded-[40px] md:shadow-2xl md:border-8 md:border-gray-800 overflow-hidden relative flex flex-col justify-between"
      >
        
        {/* TOP BAR / HEADER */}
        <header id="app-top-header" className="px-5 pt-6 pb-4 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#E28E14] to-amber-600 flex items-center justify-center text-white font-sans font-bold text-sm shadow-md shadow-amber-200">
              {profile.name ? profile.name.split(" ").map(n => n[0]).join("").toUpperCase() : "DR"}
            </div>
            <div>
              <div className="flex items-center space-x-1">
                <h1 className="font-display font-bold text-[#E28E14] text-lg tracking-tight">Hola, {profile.name}</h1>
                <span>👋</span>
              </div>
              <p className="text-xs text-gray-500 font-sans capitalize">{getSpanishDate()}</p>
            </div>
          </div>
          
          {/* Wellness indicators */}
          <div className="flex items-center space-x-1 bg-amber-50 px-2 py-1.5 rounded-full border border-amber-100">
            <Award className="w-3.5 h-3.5 text-[#E28E14]" />
            <span className="font-sans text-xs font-semibold text-amber-900">{points} pts</span>
          </div>
        </header>

        {/* MAIN VIEW CONTENT AREA CONTAINER (Scrollable) */}
        <main id="app-main-content" className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4 space-y-4">
          
          {/* TAB 1: INICIO (HOME SCREEN) */}
          {activeTab === "inicio" && (
            <div id="view-inicio" className="space-y-4 animate-fade-in">
              
              {/* Mascot container with custom speech bubble */}
              <div className="bg-white rounded-2xl p-5 border border-amber-50 shadow-sm relative overflow-hidden text-center">
                
                {/* Micro badge of status */}
                <div className="w-full flex justify-end">
                  <span className={`text-[11px] font-sans font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${getMoodBadgeColor(currentMood)}`}>
                    Reflejo: {currentMood}
                  </span>
                </div>

                {/* Newly Updated Potato Mascot Picture */}
                <div className="relative inline-block my-3">
                  <div className="absolute -inset-1.5 bg-gradient-to-tr from-[#E28E14]/30 to-amber-400/20 rounded-full blur-lg animate-pulse" />
                  <img 
                    src={papitaMascotImg}
                    alt="Papita Inteligencia Artificial" 
                    className="w-36 h-36 rounded-full object-cover shadow-md border-4 border-white relative z-10 mx-auto transform hover:scale-105 transition duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-1 right-2 bg-amber-600 text-white p-1.5 rounded-full z-20 shadow-md">
                    <Sparkle className="w-3.5 h-3.5" />
                  </div>
                </div>
                
                <div className="mt-1">
                  <h3 className="font-display font-extrabold text-gray-800 text-base">PapitaAI</h3>
                  <p className="font-sans text-xs text-gray-400 italic mt-0.5">
                    "La salud mental es vital para salvar vidas pediátricas."
                  </p>
                </div>

                <div className="mt-3 bg-amber-50 rounded-xl p-3 border border-amber-100 text-center">
                  <p className="font-sans text-xs text-amber-950 font-semibold leading-relaxed">
                    🌟 "Hola {profile.name}, recuerda descansar, tomar agua y darte el tiempo para Hobbies como {selectedHobbies.slice(0, 2).join(" y ")}."
                  </p>
                </div>
              </div>

              {/* Grid or Row of 3 status tracker cards (Sueño, Energía, Ánimo) */}
              <div className="grid grid-cols-3 gap-2">
                
                {/* Card 1: Sueño */}
                <button 
                  id="card-quick-sleep"
                  title="Ajustar horas de sueño rápidamente"
                  onClick={handleQuickAdjustSleep}
                  className="bg-white hover:bg-slate-50 transition active:scale-95 text-left p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between group cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="bg-blue-50 text-blue-600 p-1.5 rounded-xl group-hover:scale-105 transition">
                      <Moon className="w-4 h-4" />
                    </span>
                    <span className="text-[9px] text-gray-400 font-sans">Ajustar</span>
                  </div>
                  <div className="mt-4">
                    <span className="text-xs text-gray-400 block font-sans">Sueño</span>
                    <span className="font-display font-extrabold text-gray-800 text-lg">{sleepHours}h</span>
                  </div>
                </button>

                {/* Card 2: Energía */}
                <button
                  id="card-quick-energy"
                  title="Ajustar energía rápidamente"
                  onClick={handleQuickAdjustEnergy}
                  className="bg-white hover:bg-slate-50 transition active:scale-95 text-left p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between group cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="bg-yellow-50 text-amber-500 p-1.5 rounded-xl group-hover:scale-105 transition">
                      <Battery className="w-4 h-4" />
                    </span>
                    <span className="text-[9px] text-gray-400 font-sans">Ajustar</span>
                  </div>
                  <div className="mt-4">
                    <span className="text-xs text-gray-400 block font-sans">Energía</span>
                    <span className="font-display font-extrabold text-gray-800 text-lg">{energyPercent}%</span>
                  </div>
                </button>

                {/* Card 3: Ánimo */}
                <button
                  id="card-quick-mood"
                  title="Ajustar ánimo rápidamente"
                  onClick={handleQuickAdjustMood}
                  className="bg-white hover:bg-slate-50 transition active:scale-95 text-left p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between group cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="bg-amber-50 text-amber-600 p-1.5 rounded-xl group-hover:scale-105 transition">
                      <Smile className="w-4 h-4" />
                    </span>
                    <span className="text-[9px] text-gray-400 font-sans">Ajustar</span>
                  </div>
                  <div className="mt-4">
                    <span className="text-xs text-gray-400 block font-sans">Ánimo</span>
                    <span className="font-display font-extrabold text-gray-800 text-sm truncate">
                      {getMoodEmoji(currentMood)} {currentMood.charAt(0).toUpperCase() + currentMood.slice(1)}
                    </span>
                  </div>
                </button>

              </div>

              {/* Dynamic wellness habit / Recommendation card */}
              <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-sm flex items-center justify-between relative overflow-hidden">
                {isRecommendationDone && (
                  <div className="absolute inset-0 bg-[#FEF3C7]/30 backdrop-blur-[1px] flex items-center justify-center z-10 transition">
                    <span className="bg-emerald-500 text-white font-sans text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>¡Hábito completado! +25 Pts</span>
                    </span>
                  </div>
                )}

                <div className="flex items-start space-x-3 pr-2">
                  <div className="bg-[#E28E14]/10 text-[#E28E14] p-2.5 rounded-xl mt-0.5 text-center shrink-0">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-[#E28E14] block">
                      Recomendación Activa
                    </span>
                    <p className="font-display font-bold text-gray-800 text-[13px] leading-snug mt-0.5">
                      {recommendation}
                    </p>
                  </div>
                </div>

                <button
                  id="btn-recommendation-done"
                  onClick={handleCompleteRecommendation}
                  className="bg-[#E28E14] hover:bg-[#C6750A] transition active:scale-95 text-white font-sans text-xs font-bold py-2 px-3 rounded-xl shrink-0 cursor-pointer shadow-sm shadow-amber-200"
                >
                  Listo
                </button>
              </div>

              {/* Ventana Tipo Calendario de Consultas del Dr. Diego - Sincronizado con Base de Datos de Azure */}
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mt-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-[#E28E14]" />
                    <div>
                      <h3 className="font-display font-extrabold text-gray-800 text-sm">Consultas de {profile.name || "Dr. Diego"}</h3>
                      <p className="text-[10px] text-gray-400 font-sans">Semana del 08/06 al 13/06 • Base de Datos Azure</p>
                    </div>
                  </div>
                  <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full font-sans font-semibold flex items-center shrink-0">
                    <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping mr-1"></span>
                    En Línea
                  </span>
                </div>

                {/* Day selector tabs (Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo) */}
                <div className="flex items-center space-x-1 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
                  {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((day) => {
                    const isSelected = scheduleSelectedDay === day;
                    return (
                      <button
                        key={day}
                        onClick={() => handleSelectDay(day)}
                        className={`text-xs px-2.5 py-1.5 rounded-xl font-sans font-bold whitespace-nowrap transition cursor-pointer select-none ${
                          isSelected
                            ? "bg-[#E28E14] text-white shadow-sm shadow-amber-200"
                            : "bg-slate-50 hover:bg-slate-100 text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {/* Consultations List */}
                {isScheduleLoading ? (
                  <div className="py-8 flex flex-col items-center justify-center space-y-2">
                    <Loader2 className="w-6 h-6 text-[#E28E14] animate-spin" />
                    <span className="text-xs text-gray-400 font-sans">Sincronizando con Azure Search...</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200">
                    {(!scheduleData || !scheduleData[scheduleSelectedDay] || scheduleData[scheduleSelectedDay].length === 0) ? (
                      <div className="py-8 text-center">
                        <p className="text-xs text-gray-400 font-sans">No hay consultas registradas para este día.</p>
                      </div>
                    ) : (
                      scheduleData[scheduleSelectedDay].map((item, index) => (
                        <div
                          key={`${item.hcId}-${index}`}
                          className="p-3 bg-slate-50 rounded-xl border border-transparent hover:border-amber-100 hover:bg-amber-50/20 transition flex items-start justify-between group"
                        >
                          <div className="flex items-start space-x-2.5 min-w-0">
                            <div className="bg-amber-100/40 text-[#E28E14] p-1.5 rounded-lg shrink-0 mt-0.5 text-center font-mono text-[9px] font-extrabold w-8">
                              #{item.shift}
                            </div>
                            <div className="min-w-0">
                              <p className="font-display font-bold text-gray-800 text-xs truncate">
                                {item.patientName}
                              </p>
                              <div className="flex items-center space-x-1.5 mt-0.5 text-[10px] text-gray-500 font-sans">
                                <span className="font-semibold text-gray-400 font-mono text-[9px]">{item.hcId}</span>
                                <span className="text-gray-300">•</span>
                                <span>{item.age} años</span>
                                <span className="text-gray-300">•</span>
                                <span>{item.gender}</span>
                              </div>
                              <p className="text-[10px] text-gray-400 font-sans italic mt-1 font-medium bg-white/60 inline-block px-1.5 py-0.5 rounded border border-slate-100/80">
                                Motivo: {item.motive}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end justify-between self-stretch shrink-0 pb-0.5">
                            <div className="flex items-center space-x-1 text-[10px] font-mono font-bold text-[#E28E14] bg-amber-50 px-1.5 py-0.5 rounded">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{item.start} - {item.end}</span>
                            </div>
                            
                            <button
                              onClick={() => {
                                setActiveTab("historial");
                                setActiveConsultation({
                                  index: index,
                                  total: scheduleData[scheduleSelectedDay].length,
                                  patientName: item.patientName,
                                  day: scheduleSelectedDay
                                });
                                setPatientInput(`Dame un resumen del historial clínico de ${item.patientName} (${item.hcId})`);
                                setTimeout(() => {
                                  const textInput = document.getElementById("clinical-chat-textarea") || document.querySelector("textarea") as HTMLTextAreaElement;
                                  if (textInput) textInput.focus();
                                }, 150);
                              }}
                              className="text-[9px] hover:underline font-sans font-extrabold text-[#E28E14] opacity-80 group-hover:opacity-100 transition cursor-pointer select-none mt-1"
                              title={`Hacer consulta sobre ${item.patientName}`}
                            >
                              Resumir
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Scroll spacer to allow content under the floating panel to be viewable */}
              <div className="h-20" />

              {/* Floating Sticky "Conversa con Papita" box at the bottom of the home screen */}
              <div className="sticky -bottom-4 z-20 bg-gradient-to-t from-[#FDF8EB] via-white/95 to-transparent pt-6 pb-4 -mx-4 px-4">
                <div className="bg-white rounded-2xl border border-amber-200/65 shadow-lg shadow-amber-900/10 flex flex-col overflow-hidden">
                  <div className="px-4 py-1.5 bg-gradient-to-r from-amber-50/50 to-white border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Activity className="w-3.5 h-3.5 text-[#E28E14]" />
                      <span className="font-display font-bold text-[11px] text-gray-700">Conversa con Papita (gpt-5.4-mini)</span>
                    </div>
                    <span className="text-[9px] text-[#E28E14] font-mono tracking-wide bg-amber-50/80 px-2 py-0.5 rounded-full font-semibold">Enlace Clínico</span>
                  </div>

                  {/* INLINE CHAT ENTRY - ONLY TEXTBOX DIRECTLY DISPLAYED AS REQUESTED */}
                  <form 
                    id="frosted-glass-chat-trigger" 
                    onSubmit={handleSendMessage}
                    className="p-3 bg-white flex items-center space-x-1.5"
                  >
                    <button
                      type="button"
                      onClick={handleVoiceCommandToggle}
                      className={`p-2 rounded-xl border transition shrink-0 cursor-pointer ${
                        isMicActive 
                          ? "bg-rose-100 text-rose-600 border-rose-300 animate-pulse" 
                          : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                      }`}
                      title="Hablar con Papita"
                    >
                      {isMicActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Cuéntale a Papita cómo te sientes…"
                      className="flex-1 bg-white/90 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#E28E14]/50 focus:border-[#E28E14] font-sans"
                    />

                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className={`p-2 rounded-xl transition shrink-0 cursor-pointer ${
                        chatInput.trim()
                          ? "bg-[#E28E14] text-white hover:bg-[#C6750A] shadow-md shadow-amber-200"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: CONSULTAR PACIENTE (CLINICAL CHATBOT) */}
          {activeTab === "historial" && (
            <div id="view-historial" className="space-y-4 animate-fade-in flex flex-col h-full">
              
              {/* Header Box */}
              <div className="bg-white rounded-2xl p-4 border border-amber-50 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="p-2 bg-amber-100/60 text-[#E28E14] rounded-xl">
                      <Stethoscope className="w-5 h-5" />
                    </span>
                    <div>
                      <h2 className="font-display font-extrabold text-[#E28E14] text-[14px] leading-tight font-sans">Consulta Clínica Pacientes</h2>
                      <p className="text-[10px] text-gray-400">Asesoría pediátrica con Dra. Papita</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsPastChatsOpen(true)}
                    className="px-2 py-1 bg-amber-100/60 hover:bg-[#E28E14]/10 text-[#E28E14] rounded-lg transition text-[10px] font-bold font-sans flex items-center space-x-1 border border-amber-200/50 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Historial ({pastClinicalChats.length})</span>
                  </button>
                </div>
                <p className="font-sans text-[11px] text-gray-500 leading-normal mb-3">
                  Resuelve dudas de dosis de medicamentos, diagnósticos y guías pediátricas de emergencia.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <button 
                    type="button"
                    onClick={handleArchivePatientChat}
                    className="text-[#E28E14] hover:text-[#C6750A] transition text-[10px] font-bold font-sans cursor-pointer flex items-center space-x-1 bg-[#E28E14]/10 px-2 py-1 rounded-lg"
                    title="Guardar consulta actual en el historial"
                  >
                    <Save className="w-3 h-3" />
                    <span>Archivar chat</span>
                  </button>
                  <button 
                    type="button"
                    onClick={handleClearPatientChat}
                    className="text-gray-400 hover:text-red-500 transition text-[10px] underline font-sans cursor-pointer"
                  >
                    Borrar chat
                  </button>
                </div>
              </div>

              {/* Dr. Weekly Resumen Banner - No "demo" keyword, matches requested image design */}
              <div id="weekly-journal-shuttle" className="bg-gradient-to-r from-[#E28E14] to-[#F1AA32] rounded-2xl p-4 flex items-center justify-between text-white shadow-sm border border-amber-500/10">
                <div className="flex items-center space-x-3">
                  <div className="bg-white/20 p-2 rounded-xl shrink-0">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="text-[9px] font-sans font-bold tracking-wider uppercase text-amber-100 block">
                      Semana de {profile.name || "Dr. Diego"}
                    </span>
                    <h3 className="font-display font-extrabold text-white text-base leading-tight mt-0.5">
                      Día {weeklyDayNumber} de 7
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWeeklySummaryOpen(true)}
                  className="bg-white/20 hover:bg-white/30 border border-white/25 text-white text-[11px] font-sans font-extrabold py-1.5 px-3.5 rounded-full transition cursor-pointer select-none whitespace-nowrap active:scale-95 shadow-sm"
                >
                  Ver resumen →
                </button>
              </div>

              {/* Chat Viewport */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1 flex flex-col overflow-hidden min-h-[380px] justify-between">
                
                {/* Messages Panel */}
                <div className="p-4 space-y-4 overflow-y-auto max-h-[310px] flex-1 hide-scrollbar bg-slate-50/50">
                  {patientMessages.map((msg) => (
                    <div key={msg.id} className="space-y-3">
                      <div
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div className="flex items-start space-x-2.5 max-w-[88%]">
                          {msg.role === "model" && (
                            <img 
                              src={papitaMascotImg} 
                              alt="Dra. Papita" 
                              className="w-9 h-9 rounded-full object-cover shrink-0 shadow-sm border border-amber-100"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div
                            className={`p-3 rounded-2xl leading-relaxed text-[11.5px] ${
                              msg.role === "user"
                                ? "bg-[#E28E14] text-white rounded-tr-none shadow-sm shadow-[#E28E14]/10"
                                : "bg-white text-gray-800 border border-gray-100 shadow-xs rounded-tl-none text-left"
                            }`}
                          >
                            {formatMessageText(msg.text)}
                            <span
                              className={`text-[8px] mt-1.5 block text-right font-medium ${
                                msg.role === "user" ? "text-amber-200" : "text-gray-400"
                              }`}
                            >
                              {msg.timestamp}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Render horizontal sleep slider ONLY on the dynamic greeting message if it is the only message */}
                      {msg.id === "patient-welcome-1" && patientMessages.length === 1 && (
                        <div className="pl-11 pr-2 animate-fade-in text-left">
                          <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200/50 space-y-3 max-w-sm">
                            <div className="flex justify-between items-center text-[11px] font-sans text-amber-950 font-bold">
                              <span>Horas de descanso:</span>
                              <span className="bg-[#E28E14] text-white text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold leading-none shadow-xs">
                                {SLEEP_CHOICES[sleepSliderVal]}
                              </span>
                            </div>
                            
                            <div className="space-y-1.5">
                              <input
                                type="range"
                                min="0"
                                max="6"
                                value={sleepSliderVal}
                                onChange={(e) => setSleepSliderVal(parseInt(e.target.value))}
                                className="w-full h-2 bg-amber-100 accent-[#E28E14] rounded-lg appearance-none cursor-pointer"
                              />
                              <div className="flex justify-between text-[8px] font-mono font-extrabold text-amber-900/60 leading-none">
                                <span>&lt;4h</span>
                                <span>4-5h</span>
                                <span>5-6h</span>
                                <span>6-7h</span>
                                <span>7-8h</span>
                                <span>8-9h</span>
                                <span>&gt;9h</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRegisterSleep(SLEEP_CHOICES[sleepSliderVal])}
                              className="w-full py-2 bg-[#E28E14] hover:bg-[#C6750A] text-white text-[11px] font-sans font-extrabold rounded-xl shadow-xs transition text-center select-none cursor-pointer flex items-center justify-center space-x-1"
                            >
                              <span>Registrar descanso →</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Render more info buttons if this message is from model and ends with the custom phrase or contains it */}
                      {msg.role === "model" && !msg.isSleepRegistration && (
                        msg.text.includes("¿Deseas más información sobre el paciente?") ||
                        msg.text.toLowerCase().includes("deseas más información sobre el paciente") ||
                        msg.text.toLowerCase().includes("desea más información sobre el paciente") ||
                        msg.text.toLowerCase().includes("más información sobre el paciente")
                      ) && msg.id === patientMessages[patientMessages.length - 1].id && (
                        <div className="pl-11 pr-2 mt-2.5 animate-fade-in text-left">
                          <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200/50 space-y-3 max-w-sm">
                            <span className="text-[11px] font-sans text-amber-950 font-bold block">
                              ¿Qué deseas hacer ahora, colega?
                            </span>
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                onClick={handleRequestMoreInfo}
                                className="flex-1 py-2 px-3 bg-[#E28E14] hover:bg-[#C6750A] text-white text-[10px] font-sans font-extrabold rounded-xl shadow-xs transition text-center select-none cursor-pointer flex items-center justify-center space-x-1"
                              >
                                <span>Sí, dame más info</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={handleFinishConsultation}
                                className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 text-gray-700 border border-gray-200 text-[10px] font-sans font-bold rounded-xl shadow-xs transition text-center select-none cursor-pointer flex items-center justify-center space-x-1"
                              >
                                <span>No, terminar consulta</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Render MBI 0-6 score selector buttons if showMbiScale is true */}
                      {msg.showMbiScale && msg.mbiCode && (
                        <div className="pl-11 pr-2 mt-2.5 animate-fade-in text-left">
                          <div className="bg-slate-50 rounded-2xl p-4 border border-gray-200/50 space-y-3 max-w-sm">
                            <span className="text-[10px] font-sans font-bold tracking-tight text-gray-700 block">
                              Grado de acuerdo (protocolo MBI-HSS - Adaptación Perú):
                            </span>
                            <div className="grid grid-cols-7 gap-1.5">
                              {[0, 1, 2, 3, 4, 5, 6].map((score) => (
                                <button
                                  key={score}
                                  type="button"
                                  onClick={() => handleRegisterMbiAnswer(score, msg.mbiCode || "")}
                                  className="py-1.5 bg-white hover:bg-amber-500 hover:text-white text-slate-800 font-mono font-extrabold text-[11px] rounded-lg border border-slate-200 transition cursor-pointer select-none text-center shadow-xs"
                                  title={`${score} puntos`}
                                >
                                  {score}
                                </button>
                              ))}
                            </div>
                            <div className="flex justify-between text-[8px] font-sans text-gray-400 font-semibold leading-tight">
                              <span>0: Totalmente en desacuerdo</span>
                              <span>6: Totalmente de acuerdo</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Typing Indicator */}
                  {isPatientTyping && (
                    <div className="flex justify-start items-center space-x-2 animate-pulse">
                      <img 
                        src={papitaMascotImg} 
                        alt="Dra. Papita" 
                        className="w-9 h-9 rounded-full object-cover shrink-0 shadow-sm border border-amber-100"
                        referrerPolicy="no-referrer"
                      />
                      <div className="bg-white text-gray-500 border border-gray-100 py-2.5 px-4 rounded-2xl rounded-tl-none flex items-center space-x-1 shadow-xs">
                        <span className="text-[10px] font-sans">Dra. Papita evaluando...</span>
                        <div className="flex space-x-0.5">
                          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={patientMessagesEndRef} />
                </div>

                {/* Pre-made quick questions chips */}
                <div className="px-3 py-2 border-t border-gray-50 bg-white flex space-x-1.5 overflow-x-auto hide-scrollbar whitespace-nowrap grow-0">
                  <button
                    onClick={() => setPatientInput("¿Dosis amoxicilina en neumonía típica lactante de 12kg?")}
                    className="bg-amber-50 text-[9.5px] cursor-pointer text-[#E28E14] font-sans px-2.5 py-1 rounded-full border border-amber-100 hover:bg-amber-100 shrink-0 transition"
                  >
                    🧪 Dosis Lactante (12kg)
                  </button>
                  <button
                    onClick={() => setPatientInput("Diagnóstico diferencial de meningitis viral vs bacteriana en pediatría")}
                    className="bg-amber-50 text-[9.5px] cursor-pointer text-[#E28E14] font-sans px-2.5 py-1 rounded-full border border-amber-100 hover:bg-amber-100 shrink-0 transition"
                  >
                    🦠 Meningitis Viral/Bact
                  </button>
                  <button
                    onClick={() => setPatientInput("Manejo urgente de estatus epiléptico en lactantes")}
                    className="bg-amber-50 text-[9.5px] cursor-pointer text-[#E28E14] font-sans px-2.5 py-1 rounded-full border border-amber-100 hover:bg-amber-100 shrink-0 transition"
                  >
                    🚨 Estatus Epiléptico
                  </button>
                </div>

                {activeImportedContent && (
                  <div className="mx-3 mt-1.5 mb-1 px-3 py-2 bg-blue-50/80 border border-blue-200/50 rounded-xl flex items-center justify-between text-[11px] text-blue-900 animate-fade-in font-sans">
                    <span className="flex items-center space-x-1.5 font-sans min-w-0">
                      <span className="text-xs">📄</span>
                      <span className="font-bold text-blue-950 truncate max-w-[150px] sm:max-w-[260px]" title={activeImportedContent.name}>
                        Analizando: {activeImportedContent.name}
                      </span>
                      <span className="text-[9px] text-blue-500 font-mono shrink-0">({Math.round(activeImportedContent.text.length / 1024)} KB)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveImportedContent(null)}
                      className="text-gray-400 hover:text-rose-600 font-bold transition px-1 cursor-pointer text-[10px] shrink-0"
                      title="Quitar de contexto"
                    >
                      Quitar ❌
                    </button>
                  </div>
                )}

                {/* Clinical Input bar */}
                <form 
                  onSubmit={handleSendPatientMessage}
                  className="p-3 bg-white/90 backdrop-blur-md border-t border-gray-100 flex items-center space-x-2 shrink-0"
                >
                  <button
                    type="button"
                    onClick={handlePatientVoiceCommandToggle}
                    className={`p-2.5 rounded-xl border transition shrink-0 cursor-pointer ${
                      isPatientMicActive 
                        ? "bg-rose-100 text-rose-600 border-rose-300 animate-pulse" 
                        : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                    }`}
                    title="Hablar por micrófono"
                  >
                    {isPatientMicActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <input
                    type="text"
                    value={patientInput}
                    onChange={(e) => setPatientInput(e.target.value)}
                    placeholder="Pregúntale a Dra. Papita sobre dosis, síntomas..."
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#E28E14]/40 font-sans"
                  />

                  <button
                    type="submit"
                    disabled={!patientInput.trim()}
                    className={`p-3 rounded-xl transition shrink-0 cursor-pointer ${
                      patientInput.trim()
                        ? "bg-[#E28E14]" : "bg-[#E28E14]"
                    } text-white hover:bg-[#C6750A] shadow-sm`}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>

              </div>

            </div>
          )}

          {/* TAB 3: REGISTRO (DIRECT INPUT FORM FOR EXHAUSTION METRICS) */}
          {activeTab === "registro" && (
            <div id="view-registro" className="space-y-4 animate-fade-in bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              
              {/* SEGMENTED TAB SELECTOR FOR STATS VS MONITOREO */}
              <div className="grid grid-cols-2 p-1 bg-amber-50/50 border border-amber-100/50 rounded-xl">
                <button
                  type="button"
                  onClick={() => setRegSubTab("grafico")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold font-sans transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    regSubTab === "grafico"
                      ? "bg-white text-[#E28E14] shadow-sm font-bold"
                      : "text-gray-500 hover:text-gray-650 hover:bg-white/50"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Evolución y Gráfico</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRegSubTab("monitoreo")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold font-sans transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    regSubTab === "monitoreo"
                      ? "bg-white text-[#E28E14] shadow-sm font-bold"
                      : "text-gray-500 hover:text-gray-650 hover:bg-white/50"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Monitoreo Diario</span>
                </button>
              </div>

              {regSubTab === "monitoreo" && (() => {
                const defaultMbiData = {
                  AE: {
                    label: "Agotamiento Emocional",
                    average: 4.89,
                    status: "Alto",
                    color: "#EF4444",
                    days: [
                      { day: "Lunes", inicio: 4.5, mitad: 4.8, final: 5.0 },
                      { day: "Martes", inicio: 5.0, mitad: 5.2, final: 5.5 },
                      { day: "Miércoles", inicio: 4.8, mitad: 5.0, final: 5.2 },
                      { day: "Jueves", inicio: 5.2, mitad: 5.4, final: 5.8 },
                      { day: "Viernes", inicio: 5.5, mitad: 5.8, final: 6.0 },
                      { day: "Sábado", inicio: 4.0, mitad: 4.2, final: 4.5 },
                      { day: "Domingo", inicio: 3.5, mitad: 3.8, final: 4.0 }
                    ],
                    questions: [
                      { phase: "Inicio", score: 4.64, text: "¿Llegaste a tu turno fatigado?" },
                      { phase: "Mitad", score: 4.88, text: "¿El ritmo de atención te resultó agotador?" },
                      { phase: "Final", score: 5.14, text: "¿Te has sentido extremadamente cansado?" }
                    ]
                  },
                  DP: {
                    label: "Despersonalización",
                    average: 2.71,
                    status: "Moderado",
                    color: "#F59E0B",
                    days: [
                      { day: "Lunes", inicio: 2.0, mitad: 2.2, final: 2.5 },
                      { day: "Martes", inicio: 2.5, mitad: 2.8, final: 3.2 },
                      { day: "Miércoles", inicio: 3.0, mitad: 3.2, final: 3.5 },
                      { day: "Jueves", inicio: 2.8, mitad: 3.0, final: 3.0 },
                      { day: "Viernes", inicio: 3.5, mitad: 3.8, final: 4.0 },
                      { day: "Sábado", inicio: 2.0, mitad: 2.2, final: 2.5 },
                      { day: "Domingo", inicio: 1.5, mitad: 1.8, final: 2.0 }
                    ],
                    questions: [
                      { phase: "Inicio", score: 2.47, text: "¿Te preocupa que la fatiga dificulte conectar?" },
                      { phase: "Mitad", score: 2.71, text: "¿Sientes que tratas de forma despersonalizada?" },
                      { phase: "Final", score: 2.96, text: "¿Te cuesta mostrar empatía al concluir?" }
                    ]
                  },
                  RP: {
                    label: "Realización Personal",
                    average: 4.15,
                    status: "Favorable",
                    color: "#10B981",
                    days: [
                      { day: "Lunes", inicio: 4.2, mitad: 4.4, final: 4.5 },
                      { day: "Martes", inicio: 3.8, mitad: 4.2, final: 4.0 },
                      { day: "Miércoles", inicio: 3.5, mitad: 4.0, final: 3.8 },
                      { day: "Jueves", inicio: 3.6, mitad: 4.1, final: 4.2 },
                      { day: "Viernes", inicio: 3.0, mitad: 3.6, final: 3.5 },
                      { day: "Sábado", inicio: 4.5, mitad: 4.6, final: 4.8 },
                      { day: "Domingo", inicio: 4.8, mitad: 5.0, final: 5.2 }
                    ],
                    questions: [
                      { phase: "Inicio", score: 3.91, text: "¿Te sientes motivado para generar un impacto?" },
                      { phase: "Mitad", score: 4.27, text: "¿Satisfacción de entender lo que sienten?" },
                      { phase: "Final", score: 4.28, text: "¿Sensación de logro y realización al terminar?" }
                    ]
                  }
                };

                const mData = azureMbiData || defaultMbiData;

                const getRecommendationForDimension = (dimCode: "AE" | "DP" | "RP") => {
                  if (mbiRecommendations && mbiRecommendations[dimCode]) {
                    return mbiRecommendations[dimCode];
                  }

                  const selected = profileConnectingActivities && profileConnectingActivities.length > 0 
                    ? profileConnectingActivities 
                    : ["Leer", "Meditación/joga"];
                  
                  const interest = selected[0] || "Leer";
                  const h = interest.toLowerCase();
                  
                  if (dimCode === "AE") {
                    if (h.includes("bail") || h.includes("cant") || h.includes("kar")) {
                      return `¡Tu nivel de desgaste emocional es alto (4.89)! Para apagar la sobrecarga y liberar tensiones en urgencias, aprovecha tu gusto por ${interest}: pon tu canción favorita de 3 minutos, cántala a viva voz o muévete libremente por tu cuarto. ¡Cantar y mover el cuerpo oxigena el alma y disminuye el cortisol! 🌟🎤`;
                    } else if (h.includes("pint") || h.includes("dib") || h.includes("tej") || h.includes("arm") || h.includes("cons")) {
                      return `Tu agotamiento emocional es alto (4.89). Para darle un descanso cognitivo profundo a tu cerebro tras la guardia, usa tu pasión por ${interest}: dedica 10 minutos a tejer, dibujar trazos libres o colocar bloques de Lego en orden. La estimulación táctil repetitiva actúa como un reset neurológico espectacular para el cansancio clínico. 🎨🧱`;
                    } else if (h.includes("ejer") || h.includes("corr")) {
                      return `Tu nivel de desgaste hoy es elevado (4.89). Aprovechando tu gusto por ${interest}, te sugerimos una micropausa activa: realiza 5 minutos de estiramientos corporales profundos o sal a correr brevemente al terminar tu turno. El movimiento acelera la liberación del cortisol del estrés acumulado en el hospital. 🏃‍♂️⚡`;
                    } else if (h.includes("med") || h.includes("jog") || h.includes("yog")) {
                      return `Agotamiento emocional elevado (4.89). Siguiendo tu preferencia por la ${interest}, te recomendamos hacer una pausa de 5 minutos en un rincón silencioso del hospital: cierra los ojos y haz respiraciones diafragmáticas (Inhala en 4s, sostén 4s, exhala en 4s). Al terminar la guardia, visualiza que dejas la carga de los pacientes ahí. 🧘‍♂️✨`;
                    } else if (h.includes("le") || h.includes("escr")) {
                      return `Tu desgaste emocional indica nivel alto (4.89). Disfruta tu conexión con ${interest}: escribe en un papel libremente todo el estrés acumulado para vaciar la mente (journaling), o sumérgete por 10 minutos en un libro de ficción antes de dormir, lejos de pantallas. ¡Te dará un descanso profundo! 📚✍️`;
                    } else {
                      return `Tu nivel de agotamiento es significativo (4.89). Para recargar fuerzas de forma rápida, integra tu afición por ${interest}: dedica una fracción pequeña de tiempo libre hoy a esa actividad preferida para crear un cortafuegos directo entre el hospital y tu espacio personal. ☕🌟`;
                    }
                  } else if (dimCode === "DP") {
                    if (h.includes("bail") || h.includes("cant") || h.includes("kar")) {
                      return `Registramos un nivel moderado de despersonalización (2.71). Para contrarrestar la frialdad clínica, déjate llevar por tu afición por ${interest}: escucha música que despierte tus emociones profundas camino al hospital. Sentir la vibra de tus canciones favoritas reaviva tu empatía afectiva natural en tus consultas. 🎵💖`;
                    } else if (h.includes("pint") || h.includes("dib") || h.includes("tej") || h.includes("arm") || h.includes("cons")) {
                      return `Se observa una despersonalización moderada (2.71). Conecta de nuevo con tu calidez humana mediante ${interest}: dibuja, pinta o teje algo que puedas regalar hoy de forma lúdica. Usar tus dotes de creación calma el sistema límbico, permitiéndote entrar al consultorio con ternura y paciencia renovadas. 🌸🧠`;
                    } else if (h.includes("ejer") || h.includes("corr")) {
                      return `Frente a tu nivel de distanciamiento clínico (2.71), activa tu energía corporal con ${interest}. Una de tus caminatas rápidas o unos estiramientos antes de tu turno te sacarán del estado mental automatizado y te anclarán en el presente, facilitando la empatía con tus pacientes. 🏃‍♂️🔋`;
                    } else if (h.includes("med") || h.includes("jog") || h.includes("yog")) {
                      return `Detectamos un distanciamiento moderado (2.71). Te proponemos usar tu camino de ${interest}: antes del turno, realiza una micropausa de compasión. Enfoca tu mente en desearle bienestar genuino y alivio a los próximos 3 pacientes que vayas a recibir. Cambiará tu calidez al instante. 🧘‍♂️❤️`;
                    } else if (h.includes("le") || h.includes("escr")) {
                      return `Se aprecia un distanciamiento moderado por sobrecarga de guardia (2.71). Estimula tu empatía natural con ${interest}: escribe tres palabras amables en la libreta para recordar lo lindo de curar niños, o lee un breve poema de conexión humana. El lenguaje escrito cálido ayuda a derretir la despersonalización. 📝✨`;
                    } else {
                      return `Tu despersonalización se encuentra en rango moderado (2.71). Para redescubrir la conexión humana en clínica, te sugerimos aprovechar tu gusto por de ${interest} compartiéndolo o comentándolo brevemente hoy con un colega de confianza, recordándote que la medicina es un esfuerzo humano. ☕🤝`;
                    }
                  } else {
                    return `¡Felicidades, tu Realización Personal en pediatría es favorable (4.15)! Tu resiliencia y el valor que le otorgas a tus logros clínicos siguen muy fuertes. Mantén vivo este orgullo profesional conectándolo con tu amor por ${interest}: regálate a ti mismo un momento de descanso celebrando lo bien que cuidaste a tus pequeños pacientes hoy con algo de ${interest}. ¡La Dra. Papita está súper orgullosa de ti y de tus pasiones! 🏆🏆✨`;
                  }
                };

                const renderMbiChart = (dimCode: "AE" | "DP" | "RP") => {
                  const dim = mData[dimCode];
                  if (!dim) return null;
                  
                  const dayScores = dim.days.map((d: any) => {
                    const avg = parseFloat(((d.inicio + d.mitad + d.final) / 3).toFixed(2));
                    return { day: d.day, score: avg };
                  });

                  const width = 340;
                  const height = 110;
                  const padLeft = 24;
                  const padRight = 12;
                  const padTop = 15;
                  const padBottom = 20;
                  const chartW = width - padLeft - padRight;
                  const chartH = height - padTop - padBottom;

                  const points = dayScores.map((pt: any, idx: number) => {
                    const x = padLeft + idx * (chartW / (dayScores.length - 1));
                    const y = height - padBottom - (pt.score / 6) * chartH;
                    return { x, y, ...pt };
                  });

                  const pathD = points.map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

                  return (
                    <div className="relative mt-2 bg-slate-50 border border-gray-100 rounded-xl p-2.5">
                      <div className="flex justify-between items-center text-[9px] text-gray-500 font-mono mb-1.5 px-0.5">
                        <span>Evolución diaria (Lunes a Domingo)</span>
                        <span className="font-bold font-sans text-xs" style={{ color: dim.color }}>Prom: {dim.average}/6</span>
                      </div>
                      
                      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible">
                        {[0, 2, 4, 6].map((gridVal) => {
                          const y = height - padBottom - (gridVal / 6) * chartH;
                          return (
                            <g key={gridVal}>
                              <line
                                x1={padLeft}
                                y1={y}
                                x2={width - padRight}
                                y2={y}
                                stroke="#E2E8F0"
                                strokeWidth={1}
                                strokeDasharray="2,2"
                              />
                              <text
                                x={padLeft - 6}
                                y={y + 3}
                                fill="#94A3B8"
                                fontSize={7.5}
                                fontFamily="monospace"
                                textAnchor="end"
                              >
                                {gridVal}
                              </text>
                            </g>
                          );
                        })}

                        <path
                          d={pathD}
                          fill="none"
                          stroke={dim.color}
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {points.map((p: any, i: number) => (
                          <g key={i}>
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={3.5}
                              fill="#FFFFFF"
                              stroke={dim.color}
                              strokeWidth={2}
                            />
                            <text
                              x={p.x}
                              y={p.y - 6}
                              fill="#4B5563"
                              fontSize={7.5}
                              fontWeight="bold"
                              fontFamily="sans-serif"
                              textAnchor="middle"
                            >
                              {p.score}
                            </text>
                            <text
                              x={p.x}
                              y={height - 6}
                              fill="#94A3B8"
                              fontSize={8}
                              fontFamily="sans-serif"
                              textAnchor="middle"
                            >
                              {p.day.substring(0, 3)}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  );
                };

                return (
                  <div className="space-y-5 pt-1 text-left animate-fade-in">
                    <div className="flex items-center space-x-2 pb-1 border-b border-gray-100">
                      <Sparkles className="w-5 h-5 text-[#E28E14]" />
                      <h2 className="font-display font-bold text-gray-800 text-[15px]">Monitoreo Diario de Escala MBI</h2>
                    </div>

                    <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-100/40 text-[11px] text-amber-900 leading-relaxed font-sans flex items-start space-x-2">
                      <span className="text-sm">☁️</span>
                      <div>
                        <strong>Live Sync:</strong> Gráficos sincronizados desde la base de datos de Azure (<code className="bg-amber-100/70 px-1 py-0.5 rounded text-[#E28E14] font-mono text-[9px]">resumen_preguntas_dimension.txt</code>).
                      </div>
                    </div>

                    {(["AE", "DP", "RP"] as const).map((dimKey) => {
                      const dim = mData[dimKey];
                      if (!dim) return null;
                      return (
                        <div key={dimKey} className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 space-y-3 relative overflow-hidden">
                          {/* Top indicator tag */}
                          <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                            <div>
                              <span className="text-[9px] font-extrabold uppercase tracking-wider font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: `${dim.color}15`, color: dim.color }}>
                                {dimKey === "AE" ? "Dimensión 1" : dimKey === "DP" ? "Dimensión 2" : "Dimensión 3"}
                              </span>
                              <h3 className="text-xs font-extrabold text-gray-800 font-sans mt-1">{dim.label}</h3>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full" style={{ backgroundColor: dim.color + "20", color: dim.color }}>
                                {dim.status}
                              </span>
                            </div>
                          </div>

                          {/* Chart rendering */}
                          {renderMbiChart(dimKey)}

                          {/* Weekly Recommendation block */}
                          <div className="bg-slate-50 border border-gray-150/50 rounded-xl p-3 space-y-1.5 text-[11px] leading-relaxed">
                            <div className="flex justify-between items-center text-[9.5px] font-extrabold uppercase tracking-wider text-gray-400 font-sans mb-1">
                              <span>🌿 Recomendación Semanal Personalizada</span>
                              {isLoadingMbiRecs && (
                                <span className="text-amber-600 animate-pulse font-bold flex items-center gap-1 text-[9px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                  Papita IA pensando...
                                </span>
                              )}
                            </div>
                            <p className="text-gray-750 font-sans transition-all duration-300">
                              {getRecommendationForDimension(dimKey)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {regSubTab === "grafico" && (() => {
            const chartData = [...logs]
              .filter(l => l.date)
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(-7);

            const moodScores: Record<MoodType, number> = {
              feliz: 100,
              neutro: 70,
              cansado: 40,
              estresado: 25,
              triste: 10
            };

            const width = 340;
            const height = 180;
            const paddingLeft = 32;
            const paddingRight = 16;
            const paddingTop = 20;
            const paddingBottom = 28;
            const chartWidth = width - paddingLeft - paddingRight;
            const chartHeight = height - paddingTop - paddingBottom;

            const pointsList = chartData.map((log, index) => {
              const x = chartData.length > 1 
                ? paddingLeft + index * (chartWidth / (chartData.length - 1))
                : paddingLeft + chartWidth / 2;
              
              // sleep (scaled 0-12)
              const ySleep = height - paddingBottom - (log.sleepHours / 12) * chartHeight;

              // energy (scaled 0-100)
              const yEnergy = height - paddingBottom - (log.energyPercent / 100) * chartHeight;

              // mood (scaled 0-100)
              const moodValue = moodScores[log.mood] || 50;
              const yMood = height - paddingBottom - (moodValue / 100) * chartHeight;

              return { x, ySleep, yEnergy, yMood, log, index };
            });

            const sleepPath = showSleepLine ? pointsList.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.ySleep}`).join(" ") : "";
            const energyPath = showEnergyLine ? pointsList.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yEnergy}`).join(" ") : "";
            const moodPath = showMoodLine ? pointsList.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yMood}`).join(" ") : "";

            // active day to inspect
            const selectedIndex = activeChartIndex !== null ? activeChartIndex : (pointsList.length > 0 ? pointsList.length - 1 : null);
            const selectedPoint = selectedIndex !== null ? pointsList[selectedIndex] : null;

            // Azure Sleep Data Calculation
            let activeAzureDays: any[] = [];
            const staticData = [
              {
                week: "Semana 1",
                days: [
                  { day: "Lunes", date: "1 jun", hours: 4.0, note: "Sueño interrumpido por emergencia médica de madrugada." },
                  { day: "Martes", date: "2 jun", hours: 5.1, note: "Noche típica de guardia, sueño corto y ligero." },
                  { day: "Miércoles", date: "3 jun", hours: 4.9, note: "Descanso regular, despertó un par de veces." },
                  { day: "Jueves", date: "4 jun", hours: 5.0, note: "Turno nocturno de pediatría estable pero breve." },
                  { day: "Viernes", date: "5 jun", hours: 5.5, note: "Noche tranquila tras consulta general exhaustiva." },
                  { day: "Sábado", date: "6 jun", hours: 5.7, note: "Jornada larga el día de hoy, descansó un poco mejor." },
                  { day: "Domingo", date: "7 jun", hours: 5.6, note: "Sueño estable el domingo antes de iniciar guardia." }
                ]
              },
              {
                week: "Semana 2",
                days: [
                  { day: "Lunes", date: "8 jun", hours: 4.2, note: "Jornada sumamente larga en consulta, cansancio acumulado." },
                  { day: "Martes", date: "9 jun", hours: 5.2, note: "Descanso justo, Dr. Diego despertó काफी fatigado." },
                  { day: "Miércoles", date: "10 jun", hours: 3.4, note: "Sueño severamente interrumpido por emergencia crítica." },
                  { day: "Jueves", date: "11 jun", hours: 4.6, note: "Baja calidad de sueño reparador por estrés clínico." },
                  { day: "Viernes", date: "12 jun", hours: 4.5, note: "Otra jornada nocturna exigente en emergencias pediátricas." },
                  { day: "Sábado", date: "13 jun", hours: 3.3, note: "Sueño muy corto interrumpido por llamada del hospital central." },
                  { day: "Domingo", date: "14 jun", hours: 5.7, note: "Noche dominguera típica, recuperando un poco de aliento." }
                ]
              },
              {
                week: "Semana 3",
                days: [
                  { day: "Lunes", date: "15 jun", hours: 4.8, note: "Noche de lunes ocupada pero manejable el hospital." },
                  { day: "Martes", date: "16 jun", hours: 7.3, note: "Día más liviano de lo usual, logró dormir provechosamente." },
                  { day: "Miércoles", date: "17 jun", hours: 5.6, note: "Faltó sueño profundo pero se mantuvo estable en guardia." },
                  { day: "Jueves", date: "18 jun", hours: 5.4, note: "Descanso justo, despertó sintiéndose cansado tras consultorios." },
                  { day: "Viernes", date: "19 jun", hours: 4.7, note: "Dormitó brevemente durante periodos pasivos de guardia." },
                  { day: "Sábado", date: "20 jun", hours: 5.2, note: "Se acostó tarde tras un turno saturado de emergencias." },
                  { day: "Domingo", date: "21 jun", hours: 8.4, note: "Día libre completo, logró recuperar valioso sueño acumulado." }
                ]
              },
              {
                week: "Semana 4",
                days: [
                  { day: "Lunes", date: "22 jun", hours: 4.8, note: "Iniciando semana corta de descanso interrumpido." },
                  { day: "Martes", date: "23 jun", hours: 5.0, note: "Descanso justo, despertó fatigado por las rutinas intensas." },
                  { day: "Miércoles", date: "24 jun", hours: 5.1, note: "Horas de sueño modestas a mitad de la semana laboral." },
                  { day: "Jueves", date: "25 jun", hours: 5.5, note: "Jornada muy larga en consultorio pediátrico de urgencia." },
                  { day: "Viernes", date: "26 jun", hours: 5.1, note: "Faltaron horas pero el cansancio fue moderado por hábitos." },
                  { day: "Sábado", date: "27 jun", hours: 4.4, note: "Exceso de pacientes derivó en guardia con bastante insomnio." },
                  { day: "Domingo", date: "28 jun", hours: 6.0, note: "Recuperación estable y sueño consistente de fin de semana." }
                ]
              }
            ];

            const dbWeeks = azureSleepData && azureSleepData.data ? azureSleepData.data : staticData;
            if (selectedAzureWeek === "Semana All") {
              activeAzureDays = dbWeeks.flatMap((w: any) => w.days);
            } else {
              const matchedWk = dbWeeks.find((w: any) => w.week === selectedAzureWeek);
              activeAzureDays = matchedWk ? matchedWk.days : dbWeeks[0].days;
            }

            const azWidth = 340;
            const azHeight = 160;
            const azPadLeft = 24;
            const azPadRight = 12;
            const azPadTop = 15;
            const azPadBottom = 22;
            const azChartW = azWidth - azPadLeft - azPadRight;
            const azChartH = azHeight - azPadTop - azPadBottom;

            const azPoints = activeAzureDays.map((item: any, idx: number) => {
              const x = activeAzureDays.length > 1
                ? azPadLeft + idx * (azChartW / (activeAzureDays.length - 1))
                : azPadLeft + azChartW / 2;
              const y = azHeight - azPadBottom - (item.hours / 10) * azChartH; // Scale hours so 10h is max
              return { x, y, item, idx };
            });

            const azPath = azPoints.map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
            const chosenAzIdx = activeAzureChartIndex !== null ? activeAzureChartIndex : (azPoints.length > 0 ? azPoints.length - 1 : null);
            const chosenAzPt = chosenAzIdx !== null ? azPoints[chosenAzIdx] : null;

            const summaryStats = azureSleepData?.monthlySummary || {
              average: 5.1,
              shortest: 3.3,
              longest: 8.4,
              nightsUnder4h: 3,
              conclusion: "Patrón irregular con predominio de sueño insuficiente (5 h promedio). Señal temprana de desgaste clínico."
            };

            return (
              <div className="space-y-4 pt-1 animate-fade-in text-left">
                {/* Switch between user clinical logs and the Azure Sleep history */}
                <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl font-sans mb-1 text-[11px] font-extrabold gap-1 border border-slate-200/50">
                  <button
                    type="button"
                    onClick={() => setGraphMode("mis_registros")}
                    className={`py-2 px-2.5 rounded-lg text-center transition cursor-pointer select-none flex items-center justify-center space-x-1 ${
                      graphMode === "mis_registros"
                        ? "bg-white text-gray-805 shadow-sm font-bold"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <span>📈 Mis Registros (Semana)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGraphMode("sueno_azure")}
                    className={`py-2 px-2.5 rounded-lg text-center transition cursor-pointer select-none flex items-center justify-center space-x-1 ${
                      graphMode === "sueno_azure"
                        ? "bg-white text-[#E28E14] shadow-sm font-bold"
                        : "text-gray-500 hover:text-[#E28E14]"
                    }`}
                  >
                    <span>☁️ Sueño Dr. Diego (Azure DB)</span>
                  </button>
                </div>

                {graphMode === "mis_registros" ? (
                  <>
                    {/* Header */}
                    <div className="flex items-center space-x-2 pb-1 border-b border-gray-100">
                      <Activity className="w-5 h-5 text-[#E28E14]" />
                      <h2 className="font-display font-bold text-gray-800 text-[15px]">Gráfico de Guardias y Evolución</h2>
                    </div>

                    {/* Toggles */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 bg-slate-50/50 rounded-xl border border-gray-100">
                      <button
                        type="button"
                        onClick={() => setShowSleepLine(!showSleepLine)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-sans flex items-center space-x-1.5 transition border cursor-pointer ${
                          showSleepLine 
                            ? "bg-blue-50 text-blue-600 border-blue-200 font-bold" 
                            : "bg-white text-gray-400 border-gray-150 hover:bg-gray-50"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span>Sueño (horas)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEnergyLine(!showEnergyLine)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-sans flex items-center space-x-1.5 transition border cursor-pointer ${
                          showEnergyLine 
                            ? "bg-amber-50 text-amber-600 border-amber-200 font-bold" 
                            : "bg-white text-gray-400 border-gray-150 hover:bg-gray-50"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Energía (%)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMoodLine(!showMoodLine)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-sans flex items-center space-x-1.5 transition border cursor-pointer ${
                          showMoodLine 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200 font-bold" 
                            : "bg-white text-gray-400 border-gray-150 hover:bg-gray-50"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>Ánimo</span>
                      </button>
                    </div>

                    {chartData.length === 0 ? (
                      <div className="py-12 text-center bg-slate-50 rounded-2xl border border-gray-100">
                        <span className="text-3xl">📊</span>
                        <p className="text-xs text-gray-400 font-sans mt-2 font-medium">Guarda tu primer registro para generar tendencias</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Main Chart Card */}
                        <div className="bg-slate-50 rounded-2xl border border-gray-100 p-2.5 relative flex flex-col items-center">
                          
                          {/* SVG Plot */}
                          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
                            
                            {/* Horizontal gridlines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                              const y = height - paddingBottom - ratio * chartHeight;
                              return (
                                <g key={ratio} className="opacity-40">
                                  <line 
                                    x1={paddingLeft} 
                                    y1={y} 
                                    x2={width - paddingRight} 
                                    y2={y} 
                                    stroke="#E5E7EB" 
                                    strokeWidth={1} 
                                    strokeDasharray="2 3"
                                  />
                                  {/* Left side axis labels */}
                                  <text 
                                    x={paddingLeft - 4} 
                                    y={y + 3} 
                                    textAnchor="end" 
                                    className="text-[8px] fill-gray-400 font-mono font-medium"
                                  >
                                    {Math.round(ratio * 100)}%
                                  </text>
                                </g>
                              );
                            })}

                            {/* Draw active indicator/hover guide line */}
                            {activeChartIndex !== null && pointsList[activeChartIndex] && (
                              <line
                                x1={pointsList[activeChartIndex].x}
                                y1={paddingTop - 5}
                                x2={pointsList[activeChartIndex].x}
                                y2={height - paddingBottom}
                                stroke="#E28E14"
                                strokeWidth={1}
                                strokeDasharray="2 2"
                                className="opacity-60"
                              />
                            )}

                            {/* Render path lines */}
                            {showSleepLine && sleepPath && (
                              <path d={sleepPath} stroke="#3B82F6" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            )}
                            {showEnergyLine && energyPath && (
                              <path d={energyPath} stroke="#F59E0B" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            )}
                            {showMoodLine && moodPath && (
                              <path d={moodPath} stroke="#10B981" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            )}

                            {/* Render node circles and touch triggers */}
                            {pointsList.map((pt) => {
                              const isHovered = selectedIndex === pt.index;
                              return (
                                <g key={pt.log.id}>
                                  {/* Dot markers */}
                                  {showSleepLine && (
                                    <circle 
                                      cx={pt.x} 
                                      cy={pt.ySleep} 
                                      r={isHovered ? 4.5 : 3} 
                                      fill="#3B82F6" 
                                      stroke="#FFF" 
                                      strokeWidth={1}
                                      className="transition-all duration-150"
                                    />
                                  )}
                                  {showEnergyLine && (
                                    <circle 
                                      cx={pt.x} 
                                      cy={pt.yEnergy} 
                                      r={isHovered ? 4.5 : 3} 
                                      fill="#F59E0B" 
                                      stroke="#FFF" 
                                      strokeWidth={1}
                                      className="transition-all duration-150"
                                    />
                                  )}
                                  {showMoodLine && (
                                    <circle 
                                      cx={pt.x} 
                                      cy={pt.yMood} 
                                      r={isHovered ? 4.5 : 3} 
                                      fill="#10B981" 
                                      stroke="#FFF" 
                                      strokeWidth={1}
                                      className="transition-all duration-150"
                                    />
                                  )}

                                  {/* Date label */}
                                  <text 
                                    x={pt.x} 
                                    y={height - paddingBottom + 12} 
                                    textAnchor="middle" 
                                    className={`text-[8px] font-mono font-bold leading-none ${
                                      isHovered ? "fill-[#E28E14]" : "fill-gray-400"
                                    }`}
                                  >
                                    {(() => {
                                      try {
                                        const parts = pt.log.date.split('-');
                                        return parts.length === 3 ? `${parts[2]}/${parts[1]}` : pt.log.date;
                                      } catch {
                                        return pt.log.date;
                                      }
                                    })()}
                                  </text>

                                  {/* Hover click block box */}
                                  <rect
                                    x={pt.x - 12}
                                    y={paddingTop - 5}
                                    width={24}
                                    height={chartHeight + 10}
                                    fill="transparent"
                                    className="cursor-pointer"
                                    onMouseEnter={() => setActiveChartIndex(pt.index)}
                                    onTouchStart={() => setActiveChartIndex(pt.index)}
                                  />
                                </g>
                              );
                            })}
                          </svg>
                          <p className="text-[8px] text-gray-400 font-sans mt-2">💡 Pasa el dedo o cursor para ver el detalle de cada día</p>
                        </div>

                        {/* Details Box */}
                        {selectedPoint && (
                          <div className="bg-amber-50/40 p-4 border border-amber-100/60 rounded-2xl animate-fade-in space-y-2 text-left">
                            <div className="flex items-center justify-between border-b border-amber-100/60 pb-1.5">
                              <span className="text-[10px] font-bold text-amber-800 uppercase font-mono tracking-wider">
                                Turno del {(() => {
                                  try {
                                    const parts = selectedPoint.log.date.split('-');
                                    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : selectedPoint.log.date;
                                  } catch {
                                    return selectedPoint.log.date;
                                  }
                                })()}
                              </span>
                              <span className="text-xl leading-none">
                                {getMoodEmoji(selectedPoint.log.mood)}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 text-center pt-0.5">
                              <div className="bg-white p-2 rounded-xl border border-gray-100">
                                <span className="text-[9px] text-gray-400 block font-sans">Dormido</span>
                                <span className="text-[11.5px] font-extrabold text-[#E28E14]">{selectedPoint.log.sleepHours} hrs</span>
                              </div>
                              <div className="bg-white p-2 rounded-xl border border-gray-100">
                                <span className="text-[9px] text-gray-400 block font-sans">Energía</span>
                                <span className="text-[11.5px] font-extrabold text-[#E28E14]">{selectedPoint.log.energyPercent}%</span>
                              </div>
                              <div className="bg-white p-2 rounded-xl border border-gray-100">
                                <span className="text-[10px] text-gray-400 block font-sans">Ánimo</span>
                                <span className="text-[10.5px] font-extrabold capitalize text-[#E28E14] truncate block">
                                  {selectedPoint.log.mood}
                                </span>
                              </div>
                            </div>

                            {selectedPoint.log.notes && (
                              <div className="bg-white p-2.5 rounded-xl border border-gray-100 text-[10.5px] text-gray-600 font-sans leading-relaxed whitespace-pre-line">
                                <div className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Notas de guardia:</div>
                                "{selectedPoint.log.notes}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Header */}
                    <div className="flex items-center space-x-2 pb-1 border-b border-gray-100">
                      <Moon className="w-5 h-5 text-indigo-500" />
                      <h2 className="font-display font-bold text-gray-850 text-[15px]">Historial consolidado de Sueño</h2>
                    </div>

                    <p className="text-[11px] font-sans text-gray-500 leading-relaxed">
                      Evolución diaria basada en el documento indexado <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono text-[9.5px]">sueno_dr_diego.txt</code> obtenido de Azure.
                    </p>

                    {/* Week Selector tabs */}
                    <div className="flex items-center justify-between gap-1 p-1 bg-slate-50 border border-gray-150 rounded-xl">
                      {["Semana 1", "Semana 2", "Semana 3", "Semana 4", "Semana All"].map((wk) => (
                        <button
                          key={wk}
                          type="button"
                          onClick={() => {
                            setSelectedAzureWeek(wk);
                            setActiveAzureChartIndex(null);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[9.5px] font-sans font-bold transition shrink-0 cursor-pointer select-none ${
                            selectedAzureWeek === wk
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                          }`}
                        >
                          {wk === "Semana All" ? "Mensual" : wk}
                        </button>
                      ))}
                    </div>

                    {isLoadingAzureSleep ? (
                      <div className="py-12 text-center">
                        <span className="text-xs text-gray-400 font-mono">Cargando sueno_dr_diego.txt de Azure...</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Interactive SVG Plot */}
                        <div className="bg-slate-50 rounded-2xl border border-gray-100 p-2.5 relative flex flex-col items-center">
                          <div className="absolute top-2 right-2 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span className="text-[9px] font-mono text-indigo-500 font-bold">Azure DB Synchronized</span>
                          </div>

                          <svg viewBox={`0 0 ${azWidth} ${azHeight}`} className="w-full h-auto overflow-visible select-none">
                            {/* Horizontal gridlines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                              const y = azHeight - azPadBottom - ratio * azChartH;
                              return (
                                <g key={ratio} className="opacity-40">
                                  <line 
                                    x1={azPadLeft} 
                                    y1={y} 
                                    x2={azWidth - azPadRight} 
                                    y2={y} 
                                    stroke="#E5E7EB" 
                                    strokeWidth={1} 
                                    strokeDasharray="2 3"
                                  />
                                  <text 
                                    x={azPadLeft - 4} 
                                    y={y + 3} 
                                    textAnchor="end" 
                                    className="text-[8px] fill-gray-400 font-mono font-medium"
                                  >
                                    {Math.round(ratio * 10)}h
                                  </text>
                                </g>
                              );
                            })}

                            {/* Active indicator */}
                            {chosenAzPt && (
                              <line
                                x1={chosenAzPt.x}
                                y1={azPadTop - 5}
                                x2={chosenAzPt.x}
                                y2={azHeight - azPadBottom}
                                stroke="#6366F1"
                                strokeWidth={1}
                                strokeDasharray="2 2"
                                className="opacity-60"
                              />
                            )}

                            {/* Indigo Path line */}
                            {azPath && (
                              <path d={azPath} stroke="#4F46E5" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            )}

                            {/* Node circles */}
                            {azPoints.map((pt: any) => {
                              const isHovered = chosenAzIdx === pt.idx;
                              return (
                                <g key={pt.idx}>
                                  <circle 
                                    cx={pt.x} 
                                    cy={pt.y} 
                                    r={isHovered ? 5.5 : 3.5} 
                                    fill="#4F46E5" 
                                    stroke="#FFF" 
                                    strokeWidth={1.5}
                                    className="transition-all duration-150"
                                  />
                                  <text 
                                    x={pt.x} 
                                    y={azHeight - azPadBottom + 12} 
                                    textAnchor="middle" 
                                    className={`text-[8px] font-mono font-bold leading-none ${
                                      isHovered ? "fill-indigo-600" : "fill-gray-400"
                                    }`}
                                  >
                                    {pt.item.date}
                                  </text>

                                  {/* Hover touch trigger */}
                                  <rect
                                    x={pt.x - 12}
                                    y={azPadTop - 5}
                                    width={24}
                                    height={azChartH + 10}
                                    fill="transparent"
                                    className="cursor-pointer"
                                    onMouseEnter={() => setActiveAzureChartIndex(pt.idx)}
                                    onTouchStart={() => setActiveAzureChartIndex(pt.idx)}
                                  />
                                </g>
                              );
                            })}
                          </svg>
                          <p className="text-[8px] text-gray-400 font-sans mt-2">💡 Desliza el puntero sobre los nodos para ver detalles diarios</p>
                        </div>

                        {/* Inspection Box */}
                        {chosenAzPt && (
                          <div className="bg-indigo-50/40 p-4 border border-indigo-100/60 rounded-2xl animate-fade-in space-y-2 text-left">
                            <div className="flex items-center justify-between border-b border-indigo-100/60 pb-1.5">
                              <span className="text-[10px] font-extrabold text-indigo-700 font-mono tracking-wider">
                                {chosenAzPt.item.day}, {chosenAzPt.item.date}
                              </span>
                              <span className="text-[9px] font-sans text-gray-500 font-bold bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100">
                                Registro de sueno_dr_diego.txt
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-0.5 text-center">
                              <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                                <span className="text-[9px] text-gray-400 block font-sans">Duración del Sueño</span>
                                <span className="text-sm font-extrabold text-[#4F46E5]">{chosenAzPt.item.hours} hrs</span>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-gray-100 flex flex-col justify-center">
                                <span className="text-[9px] text-gray-400 block font-sans">Estándar Ideal</span>
                                <span className="text-xs font-semibold text-emerald-600">8.0 hrs</span>
                              </div>
                            </div>

                            <div className="bg-white/80 p-3 rounded-xl border border-indigo-100/30 text-[11px] font-sans text-gray-600 italic">
                              " {chosenAzPt.item.note || "Sin observaciones adicionales escritas."} "
                            </div>
                          </div>
                        )}

                        {/* Monthly Summary Statistics Box */}
                        <div className="bg-slate-50 border border-gray-200/60 rounded-2xl p-4 space-y-3 font-sans text-left">
                          <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">📊 Resumen Clínico del Mes</h4>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white p-2 rounded-xl text-center border border-gray-100">
                              <span className="text-[9px] text-gray-400 block">Promedio</span>
                              <span className="text-xs font-bold text-gray-750">{summaryStats.average}h</span>
                            </div>
                            <div className="bg-white p-2 rounded-xl text-center border border-gray-100">
                              <span className="text-[9px] text-gray-400 block">Mínima</span>
                              <span className="text-xs font-bold text-red-500">{summaryStats.shortest}h</span>
                            </div>
                            <div className="bg-white p-2 rounded-xl text-center border border-gray-100">
                              <span className="text-[9px] text-gray-400 block">Máxima</span>
                              <span className="text-xs font-bold text-emerald-600">{summaryStats.longest}h</span>
                            </div>
                          </div>
                          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 text-[10.5px] text-amber-850 leading-relaxed">
                            <strong>Conclusión diagnóstica:</strong> {summaryStats.conclusion}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

          {/* TAB 4: PERFIL (DOCTOR PROFILE AND EMOTIONAL STREAKS) */}
          {activeTab === "perfil" && (
            <div id="view-perfil" className="space-y-4 animate-fade-in">
              {/* Doctor Details */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center relative overflow-hidden">
                <div className="w-20 h-20 rounded-full overflow-hidden shadow-lg mx-auto border-4 border-white mb-2">
                  <img src={papitaMascotImg} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                
                <h2 className="font-display font-extrabold text-[#E28E14] text-lg mt-1">{profile.name}</h2>
                <p className="font-sans text-xs text-gray-500 font-semibold">{profile.specialty}</p>
                <p className="font-sans text-[10px] text-gray-400 mt-0.5">{profile.hospital}</p>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-100">
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100/50">
                    <span className="text-[10px] text-amber-600 uppercase font-sans font-semibold">Racha activa</span>
                    <p className="text-lg font-display font-extrabold text-amber-950 mt-0.5">{streak} Días 🔥</p>
                  </div>
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100/50">
                    <span className="text-[10px] text-amber-600 uppercase font-sans font-semibold">Total Consultas</span>
                    <p className="text-lg font-display font-extrabold text-amber-950 mt-0.5">{patientMessages.length} Chat</p>
                  </div>
                </div>
              </div>

              {/* Editable Quick Information Settings */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-4 text-left">
                <h3 className="font-display font-bold text-gray-800 text-sm pb-1.5 border-b border-gray-100 flex items-center justify-between">
                  <span>📌 Datos Sociodemográficos</span>
                  <span className="text-[10px] text-[#E28E14] font-bold uppercase">Paso 1</span>
                </h3>
                
                <div className="space-y-4 text-xs font-sans">
                  {/* Name Input */}
                  <div>
                    <label className="block text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">¿Cómo te llamas?</label>
                    <input 
                      type="text" 
                      value={profile.name}
                      onChange={(e) => setProfile({...profile, name: e.target.value})}
                      placeholder="Ej. Dr. Diego Córdova"
                      className="w-full bg-slate-50 border border-gray-100 focus:border-amber-300 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E28E14]/40 text-xs font-semibold"
                    />
                  </div>

                  {/* Age Input */}
                  <div>
                    <label className="block text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">¿Cuántos años tienes?</label>
                    <input 
                      type="text" 
                      pattern="[0-9]*"
                      value={profileAge}
                      onChange={(e) => setProfileAge(e.target.value)}
                      placeholder="Ej. 32"
                      className="w-full bg-slate-50 border border-gray-100 focus:border-amber-300 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E28E14]/40 text-xs font-semibold"
                    />
                  </div>

                  {/* Specialty */}
                  <div>
                    <label className="block text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Especialidad Clínica</label>
                    <input 
                      type="text" 
                      value={profile.specialty}
                      onChange={(e) => setProfile({...profile, specialty: e.target.value})}
                      className="w-full bg-slate-50 border border-gray-100 focus:border-amber-300 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E28E14]/40 text-xs text-gray-600"
                    />
                  </div>

                  {/* Hospital */}
                  <div>
                    <label className="block text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Centro u Hospital</label>
                    <input 
                      type="text" 
                      value={profile.hospital}
                      onChange={(e) => setProfile({...profile, hospital: e.target.value})}
                      className="w-full bg-slate-50 border border-gray-100 focus:border-amber-300 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E28E14]/40 text-xs text-gray-600"
                    />
                  </div>

                  {/* Gender Selector */}
                  <div>
                    <label className="block text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1.5">Género</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {["Masculino", "Femenino", "Personalizado", "Prefiero no decirlo"].map((option) => {
                        const isSel = profileGender === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setProfileGender(option)}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition active:scale-95 text-left flex items-center justify-between ${
                              isSel 
                                ? "bg-amber-50 text-[#E28E14] border-amber-300 shadow-xs" 
                                : "bg-slate-50 text-gray-600 border-gray-100 hover:bg-slate-100"
                            }`}
                          >
                            <span>{option}</span>
                            {isSel && <span className="text-[#E28E14] text-[10px]">●</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Work Area Selector */}
                  <div>
                    <label className="block text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1.5">¿Cuál es tu área de trabajo?</label>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        "Emergencias / UCI",
                        "Especialidades clínicas",
                        "Especialidades quirúrgicas",
                        "Salud mental",
                        "Atención ambulatoria",
                        "Médico residente",
                        "Medicina general",
                        "Otro"
                      ].map((area) => {
                        const isSel = profileWorkArea === area;
                        return (
                          <button
                            key={area}
                            type="button"
                            onClick={() => setProfileWorkArea(area)}
                            className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold border transition active:scale-95 text-left flex items-center justify-between ${
                              isSel 
                                ? "bg-amber-50 text-[#E28E14] border-amber-300" 
                                : "bg-slate-50 text-gray-600 border-gray-100 hover:bg-slate-105"
                            }`}
                          >
                            <span>{area}</span>
                            {isSel && <span className="text-amber-600">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* FIRST PHASE CONFIGURATION */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-5 text-left">
                <h3 className="font-display font-bold text-gray-800 text-sm pb-1.5 border-b border-gray-100 flex items-center justify-between">
                  <span>🌱 Primera Fase</span>
                  <span className="text-[10px] text-emerald-600 font-bold uppercase">Paso 2</span>
                </h3>

                {/* Connecting Activities */}
                <div className="space-y-2">
                  <label className="block text-gray-600 text-[10px] uppercase font-bold tracking-wider">
                    ¿Qué actividades te ayudan a conectar contigo mismo?
                  </label>
                  <p className="text-[10px] text-gray-400">Puedes seleccionar varias actividades preferidas:</p>
                  
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      "Bailar",
                      "Cantar/karaoke",
                      "Pintar/dibujar",
                      "Hacer ejercicio",
                      "Meditación/joga",
                      "Leer",
                      "Coleccionar",
                      "Tejer",
                      "Visitar museos",
                      "Ver películas/ir al teatro",
                      "Armar/construir cosas",
                      "Escribir"
                    ].map((act) => {
                      const isSel = profileConnectingActivities.includes(act);
                      return (
                        <button
                          key={act}
                          type="button"
                          onClick={() => {
                            if (isSel) {
                              setProfileConnectingActivities(profileConnectingActivities.filter(a => a !== act));
                            } else {
                              setProfileConnectingActivities([...profileConnectingActivities, act]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 ${
                            isSel
                              ? "bg-amber-100 text-amber-800 border-amber-300 font-bold"
                              : "bg-slate-50 text-gray-600 border-gray-100 hover:bg-gray-100"
                          }`}
                        >
                          {act}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Motivations (Multi-selection) */}
                <div className="space-y-2 pt-2 border-t border-gray-50">
                  <label className="block text-gray-600 text-[10px] uppercase font-bold tracking-wider">
                    ¿Qué te motiva a seguir creciendo como médico?
                  </label>
                  <p className="text-[10px] text-gray-400">Selecciona una o varias opciones que te inspiren:</p>
                  
                  <div className="space-y-1.5 mt-2">
                    {[
                      "Ayudar y generar impacto en otras personas",
                      "Seguir aprendiendo y superándome profesionalmente",
                      "Brindar bienestar a mi familia y personas importantes",
                      "Ser reconocido por mi trabajo y esfuerzo",
                      "Inspirar o guiar a otros profesionales de salud",
                      "Sentirme realizado con mi vocación",
                      "Poder ofrecer una mejor atención a mis pacientes"
                    ].map((mot) => {
                      const isSel = profileMotivation.includes(mot);
                      return (
                        <button
                          key={mot}
                          type="button"
                          onClick={() => {
                            if (isSel) {
                              setProfileMotivation(profileMotivation.filter(m => m !== mot));
                            } else {
                              setProfileMotivation([...profileMotivation, mot]);
                            }
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium border transition-all active:scale-95 flex items-start space-x-2 ${
                            isSel
                              ? "bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold"
                              : "bg-slate-50 text-gray-600 border-gray-150 hover:bg-slate-100"
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] mt-0.5 shrink-0 ${
                            isSel ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 bg-white"
                          }`}>
                            {isSel && "✓"}
                          </span>
                          <span className="leading-tight">{mot}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Shift habit selector */}
                <div className="space-y-2 pt-2 border-t border-gray-50">
                  <label className="block text-gray-600 text-[10px] uppercase font-bold tracking-wider">
                    ¿Cómo son tus turnos habitualmente?
                  </label>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {["Fijos", "Variables", "Guardias frecuentes", "Rotativo"].map((sh) => {
                      const isSel = profileShiftType === sh;
                      return (
                        <button
                          key={sh}
                          type="button"
                          onClick={() => setProfileShiftType(sh)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition active:scale-95 text-center ${
                            isSel
                              ? "bg-amber-50 text-amber-800 border-amber-300 font-bold"
                              : "bg-slate-50 text-gray-600 border-gray-100 hover:bg-gray-105"
                          }`}
                        >
                          {sh}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Health Issue selector */}
                <div className="space-y-2 pt-2 border-t border-gray-50">
                  <label className="block text-gray-600 text-[10px] uppercase font-bold tracking-wider">
                    ¿Hay algún problema de salud que influya en cómo manejas tus jornadas laborales?
                  </label>
                  
                  <div className="space-y-1.5">
                    {[
                      "Ninguno",
                      "Enfermedad crónica (general)",
                      "Salud mental (estrés clínico, ansiedad, depresión, etc.)",
                      "Problemas musculoesqueléticos (dolor de espalda, lesiones, artritis, etc.)",
                      "Problemas cardiovasculares",
                      "Problemas respiratorios",
                      "Otra condición de salud (especificar)",
                      "Prefiero no responder"
                    ].map((issue) => {
                      const isSel = profileHealthIssue === issue;
                      return (
                        <button
                          key={issue}
                          type="button"
                          onClick={() => setProfileHealthIssue(issue)}
                          className={`w-full px-3.5 py-1.5 rounded-xl text-left text-xs font-medium border transition-all active:scale-95 flex items-center justify-between ${
                            isSel
                              ? "bg-amber-50 text-amber-900 border-amber-300 font-semibold"
                              : "bg-slate-50 text-gray-600 border-gray-100 hover:bg-slate-100"
                          }`}
                        >
                          <span>{issue}</span>
                          {isSel && <span className="text-amber-600">●</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Specification field when custom health issue is selected */}
                  {profileHealthIssue === "Otra condición de salud (especificar)" && (
                    <div className="mt-2 animate-fade-in">
                      <label className="block text-gray-400 text-[9px] uppercase font-bold mb-1">Especifica tu condición de salud:</label>
                      <input 
                        type="text"
                        value={profileCustomHealthIssue}
                        onChange={(e) => setProfileCustomHealthIssue(e.target.value)}
                        placeholder="Ej. Lesión en muñeca"
                        className="w-full bg-amber-50/50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-400 font-sans"
                      />
                    </div>
                  )}
                </div>

                {/* Daily Work Hours Selection */}
                <div className="space-y-2 pt-2 border-t border-gray-50">
                  <label className="block text-gray-600 text-[10px] uppercase font-bold tracking-wider">
                    ¿Cuántas horas trabajas aproximadamente al día?
                  </label>
                  <select
                    value={profileWorkHours}
                    onChange={(e) => setProfileWorkHours(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-150 rounded-xl px-3 py-2 text-xs text-gray-700 font-sans font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                      <option key={num} value={String(num)}>{num} hora{num > 1 ? "s" : ""}</option>
                    ))}
                    <option value="+12h">+12h horas de guardia</option>
                  </select>
                </div>

                {/* Ideal Sleep Hours Selection */}
                <div className="space-y-2 pt-2 border-t border-gray-50">
                  <label className="block text-gray-600 text-[10px] uppercase font-bold tracking-wider">
                    ¿Cuántas horas te gustaría dormir idealmente?
                  </label>
                  <select
                    value={profileIdealSleepHours}
                    onChange={(e) => setProfileIdealSleepHours(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-150 rounded-xl px-3 py-2 text-xs text-gray-700 font-sans font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <option key={num} value={String(num)}>{num} hora{num > 1 ? "s" : ""}</option>
                    ))}
                    <option value="+9h">+9h horas</option>
                  </select>
                </div>
              </div>



              {/* Support info */}
              <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100 shadow-xs">
                <div className="flex items-start space-x-2.5 text-rose-800">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-rose-600" />
                  <div>
                    <h4 className="font-display font-bold text-xs">Apoyo Profesional</h4>
                    <p className="font-sans text-[11px] leading-relaxed mt-1 text-rose-600">
                      Papita AI es un compañero de microhábitos de bienestar y no reemplaza el diagnóstico clínico clínico. Si sientes que la carga laboral te excede de forma crítica, te sugerimos contactar las redes nacionales de apoyo a profesionales de la salud. ¡Cuidar de ti es primero! En caso de que sientas sobre carga, puedes contactar al 113 (MINSA Perú).
                    </p>
                  </div>
                </div>
              </div>

              {/* Simulador de Tiempo y Monitoreo del Agente */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-gray-200/50 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-[#E28E14]">
                    <Calendar className="w-5 h-5" />
                    <h4 className="font-display font-extrabold text-xs uppercase tracking-tight text-gray-700">Simulador de Guardia (Días)</h4>
                  </div>
                  {isSimulatorUnlocked && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSimulatorUnlocked(false);
                        localStorage.removeItem("is_simulator_unlocked");
                      }}
                      className="text-[9px] text-[#E28E14] hover:underline font-bold cursor-pointer"
                    >
                      🔒 Bloquear
                    </button>
                  )}
                </div>

                {!isSimulatorUnlocked ? (
                  <div className="space-y-3 bg-white p-3 rounded-xl border border-gray-150 text-left">
                    <p className="font-sans text-[11px] font-semibold text-gray-650">
                      🔐 Acceder al Simulador en Modo Demo
                    </p>
                    <div className="space-y-1.5 font-sans">
                      <label className="block text-[9px] uppercase tracking-wider font-bold text-gray-400">Usuario</label>
                      <input
                        type="text"
                        value={demoUser}
                        onChange={(e) => {
                          setDemoUser(e.target.value);
                          setDemoError("");
                        }}
                        placeholder="grupo20"
                        className="w-full border border-gray-250 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-[#E28E14]"
                      />
                    </div>
                    <div className="space-y-1.5 font-sans">
                      <label className="block text-[9px] uppercase tracking-wider font-bold text-gray-400">Contraseña</label>
                      <input
                        type="password"
                        value={demoPass}
                        onChange={(e) => {
                          setDemoPass(e.target.value);
                          setDemoError("");
                        }}
                        placeholder="bago-hackathon"
                        className="w-full border border-gray-250 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-[#E28E14]"
                      />
                    </div>
                    {demoError && (
                      <p className="text-[10px] text-red-500 font-bold font-sans">{demoError}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (demoUser.trim() === "grupo20" && demoPass.trim() === "bago-hackathon") {
                          setIsSimulatorUnlocked(true);
                          localStorage.setItem("is_simulator_unlocked", "true");
                          setDemoError("");
                        } else {
                          setDemoError("Usuario o contraseña incorrectos en modo demo.");
                        }
                      }}
                      className="w-full py-1.5 px-3 bg-[#E28E14] hover:bg-[#C6750A] text-white text-[10px] font-bold rounded-lg shadow-xs transition cursor-pointer"
                    >
                      Desbloquear con Credenciales
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="font-sans text-[11px] leading-relaxed text-gray-500">
                      ¡Modo Demo Desbloqueado! Controla el transcurso de los días para probar el monitoreo de sueño y el bienestar de Papita en diferentes fases de la semana laboral.
                    </p>
                    <div className="flex items-center justify-between text-[11px] font-sans font-bold bg-white px-3 py-2 rounded-xl border border-gray-100 font-sans">
                      <span className="text-gray-500">Día Actual:</span>
                      <span className="text-[#E28E14] bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/40">
                        Día {weeklyDayNumber} de 7 ({["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][weeklyDayNumber - 1] || "Lunes"})
                      </span>
                    </div>
                    <div className="flex space-x-2 pt-1 font-sans">
                      <button
                        type="button"
                        onClick={() => {
                          setWeeklyDayNumber((prev) => (prev < 7 ? prev + 1 : 1));
                        }}
                        className="flex-1 py-2 px-3 bg-[#E28E14] hover:bg-[#C6750A] text-white text-[10px] font-bold rounded-xl shadow-xs transition text-center select-none cursor-pointer flex items-center justify-center space-x-1 active:scale-95"
                      >
                        <span>Avanzar Día (Día {weeklyDayNumber === 7 ? 1 : weeklyDayNumber + 1}) →</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWeeklyDayNumber(1);
                          const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
                          DAYS.forEach(d => {
                            localStorage.removeItem(`asked_${d}_inicio`);
                            localStorage.removeItem(`asked_${d}_mitad`);
                            localStorage.removeItem(`asked_${d}_final`);
                          });
                        }}
                        className="py-2 px-3.5 bg-white hover:bg-slate-50 text-gray-700 border border-gray-200 text-[10px] font-bold rounded-xl shadow-xs transition text-center select-none cursor-pointer flex items-center justify-center space-x-1 active:scale-95"
                      >
                        <span>Reiniciar Semana</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </main>

        {/* BOTTOM NAVIGATION TAB BAR */}
        <nav id="app-bottom-navbar" className="bg-white border-t border-gray-100 px-3 py-3 flex items-center justify-around sticky bottom-0 z-30 shadow-lg">
          
          <button
            id="tab-inicio"
            onClick={() => setActiveTab("inicio")}
            className={`flex flex-col items-center space-y-1 cursor-pointer transition py-1 px-3.5 rounded-2xl ${
              activeTab === "inicio" ? "text-[#E28E14] font-bold" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-sans">Inicio</span>
          </button>

          {/* Changed 'historial' to 'Consultar Paciente' visually */}
          <button
            id="tab-historial"
            onClick={() => setActiveTab("historial")}
            className={`flex flex-col items-center space-y-1 cursor-pointer transition py-1 px-3.5 rounded-2xl ${
              activeTab === "historial" ? "text-[#E28E14] font-bold" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Stethoscope className="w-5 h-5" />
            <span className="text-[10px] font-sans">Consultar Paciente</span>
          </button>

          <button
            id="tab-registro"
            onClick={() => {
              setRegSleep(sleepHours);
              setRegEnergy(energyPercent);
              setRegMood(currentMood);
              setActiveTab("registro");
            }}
            className={`flex flex-col items-center space-y-1 cursor-pointer transition py-1 px-3.5 rounded-2xl ${
              activeTab === "registro" ? "text-[#E28E14] font-bold" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <PlusCircle className="w-5 h-5" />
            <span className="text-[10px] font-sans">Registro</span>
          </button>

          <button
            id="tab-perfil"
            onClick={() => setActiveTab("perfil")}
            className={`flex flex-col items-center space-y-1 cursor-pointer transition py-1 px-3.5 rounded-2xl ${
              activeTab === "perfil" ? "text-[#E28E14] font-bold" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-sans">Perfil</span>
          </button>

        </nav>

        {isPastChatsOpen && (
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-xs flex items-end justify-center z-40 animate-fade-in">
            <div className="bg-white w-full max-h-[82%] rounded-t-3xl p-5 shadow-2xl flex flex-col relative animate-slide-up">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 shrink-0" />
              
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="flex items-center space-x-2">
                  <History className="w-4 h-4 text-[#E28E14]" />
                  <h3 className="font-display font-extrabold text-gray-800 text-[14px]">Historial de Consultas</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsPastChatsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-gray-100 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

              <p className="text-[10.5px] text-gray-400 mb-3 leading-tight font-sans shrink-0">
                Toca una consulta archivada para reanudar el hilo de conversación y cálculos clínicos con Dra. Papita.
              </p>

              {/* Search bar inside History */}
              <input 
                type="text"
                placeholder="Buscar consulta pasada..."
                value={pastChatsSearch}
                onChange={(e) => setPastChatsSearch(e.target.value)}
                className="w-full bg-slate-50 border border-gray-100 rounded-xl px-3.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 mb-3 font-sans shrink-0 animate-none"
              />

              <div className="flex-1 overflow-y-auto space-y-2 pb-4 hide-scrollbar min-h-0">
                {pastClinicalChats.filter(c => c.title.toLowerCase().includes(pastChatsSearch.toLowerCase())).length === 0 ? (
                  <div className="py-12 text-center">
                    <span className="text-2xl block">📁</span>
                    <p className="text-xs text-gray-400 font-sans mt-2">No se encontraron consultas registradas</p>
                  </div>
                ) : (
                  pastClinicalChats
                    .filter(c => c.title.toLowerCase().includes(pastChatsSearch.toLowerCase()))
                    .map((session) => (
                      <div
                        key={session.id}
                        onClick={() => handleLoadPastChat(session)}
                        className="p-3 bg-slate-50 hover:bg-amber-50/50 border border-slate-100 hover:border-amber-150 rounded-2xl cursor-pointer transition flex items-center justify-between group"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center space-x-1 flex-wrap gap-1">
                            <span className="text-[9px] text-[#E28E14] font-bold bg-amber-50 px-1.5 py-0.5 rounded font-mono">
                              {session.date}
                            </span>
                            <span className="text-[9px] text-gray-400 font-medium font-sans">
                              ({session.messages.length} mensajes)
                            </span>
                          </div>
                          <h4 className="font-bold text-[11.5px] mt-1 text-gray-700 truncate font-sans">
                            {session.title}
                          </h4>
                          {session.messages && session.messages.length > 0 && (
                            <p className="text-[10px] text-gray-400 truncate mt-0.5 font-sans italic">
                              Último: {session.messages[session.messages.length - 1].text}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 shrink-0">
                          {driveUser && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBackupPastSession(session);
                              }}
                              className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                              title="Respaldar en Google Drive"
                            >
                              <CloudUpload className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDeletePastChat(session.id, e)}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition cursor-pointer shrink-0"
                            title="Eliminar de historial"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Weekly Summary Modal */}
        {isWeeklySummaryOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-100 shadow-xl overflow-hidden animate-scale-up text-left">
              <div className="bg-gradient-to-r from-[#E28E14] to-[#F1AA32] p-4 text-white flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-white" />
                  <h3 className="font-display font-extrabold text-white text-sm">Semana de {profile.name || "Dr. Diego"}</h3>
                </div>
                <button
                  onClick={() => setIsWeeklySummaryOpen(false)}
                  className="text-white hover:text-amber-100 transition cursor-pointer font-extrabold font-sans text-xs bg-transparent border-none p-1"
                >
                  Cerrar ✕
                </button>
              </div>

              <div className="p-4 space-y-4">
                <p className="text-[10px] text-gray-400 font-sans italic">
                  Horarios consolidados y productividad extraída directamente de la base de datos de consulta de {profile.name || "Dr. Diego"} (Semana del 08/06 al 13/06).
                </p>

                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-left font-sans text-xs">
                    <thead className="bg-slate-50 text-gray-500 font-bold uppercase text-[9px] border-b border-gray-100">
                      <tr>
                        <th className="p-2.5">Día</th>
                        <th className="p-2.5">Fecha</th>
                        <th className="p-2.5">Jornada</th>
                        <th className="p-2.5 text-center">Horas</th>
                        <th className="p-2.5 text-center">Pacientes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-600 font-medium">
                      <tr>
                        <td className="p-2.5 font-bold text-gray-800">Lunes</td>
                        <td className="p-2.5 font-mono text-[9.5px]">08/06/2026</td>
                        <td className="p-2.5">08:00 - 13:20</td>
                        <td className="p-2.5 text-center font-semibold text-amber-600">5.3h</td>
                        <td className="p-2.5 text-center font-semibold">15</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-gray-800">Martes</td>
                        <td className="p-2.5 font-mono text-[9.5px]">09/06/2026</td>
                        <td className="p-2.5">08:00 - 13:20</td>
                        <td className="p-2.5 text-center font-semibold text-amber-600">5.3h</td>
                        <td className="p-2.5 text-center font-semibold">15</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-gray-800">Miércoles</td>
                        <td className="p-2.5 font-mono text-[9.5px]">10/06/2026</td>
                        <td className="p-2.5">08:00 - 14:00</td>
                        <td className="p-2.5 text-center font-semibold text-amber-600">6.0h</td>
                        <td className="p-2.5 text-center font-semibold">17</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-gray-800">Jueves</td>
                        <td className="p-2.5 font-mono text-[9.5px]">11/06/2026</td>
                        <td className="p-2.5">08:00 - 13:44</td>
                        <td className="p-2.5 text-center font-semibold text-amber-600">5.7h</td>
                        <td className="p-2.5 text-center font-semibold">18</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-gray-800">Viernes</td>
                        <td className="p-2.5 font-mono text-[9.5px]">12/06/2026</td>
                        <td className="p-2.5">08:00 - 14:00</td>
                        <td className="p-2.5 text-center font-semibold text-amber-600">6.0h</td>
                        <td className="p-2.5 text-center font-semibold">20</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-gray-800">Sábado</td>
                        <td className="p-2.5 font-mono text-[9.5px]">13/06/2026</td>
                        <td className="p-2.5">08:00 - 14:00</td>
                        <td className="p-2.5 text-center font-semibold text-amber-600">6.0h</td>
                        <td className="p-2.5 text-center font-semibold">20</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                    <span className="text-[9px] text-gray-400 uppercase font-sans font-bold">Total Horas</span>
                    <p className="text-base font-display font-black text-amber-600 mt-0.5">34.3 h</p>
                    <p className="text-[9.5px] text-gray-400 mt-0.5">Promedio: 5.7h / día</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                    <span className="text-[9px] text-gray-400 uppercase font-sans font-bold">Total Atenciones</span>
                    <p className="text-base font-display font-black text-slate-800 mt-0.5">105 pac.</p>
                    <p className="text-[9.5px] text-gray-400 mt-0.5">Promedio: 17.5 / día</p>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setIsWeeklySummaryOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-sans font-bold rounded-xl transition cursor-pointer select-none"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
